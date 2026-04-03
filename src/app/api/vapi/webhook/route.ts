import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/vapi/webhook
 * Receives Vapi server messages, including end-of-call-report.
 * On end-of-call-report, appends the call summary to the Airtable "Resume" field.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const message = body?.message;

  // Only process end-of-call-report
  if (message?.type !== "end-of-call-report") {
    return NextResponse.json({ ok: true });
  }

  console.log("[vapi-webhook] end-of-call-report received");

  const call = message.call;
  const analysis = message.analysis;
  const artifact = message.artifact;

  // Build summary from analysis or transcript
  const summary =
    analysis?.summary ||
    artifact?.transcript ||
    "Aucun résumé disponible.";

  // Get the Airtable recordId from call metadata
  const airtableRecordId =
    call?.assistantOverrides?.metadata?.airtableRecordId ||
    call?.metadata?.airtableRecordId;

  console.log("[vapi-webhook] recordId:", airtableRecordId);
  console.log("[vapi-webhook] summary:", summary.substring(0, 200));

  if (!airtableRecordId) {
    console.error("[vapi-webhook] Missing airtableRecordId in call metadata");
    return NextResponse.json(
      { ok: false, error: "Missing Airtable recordId" },
      { status: 400 }
    );
  }

  // First, fetch the existing Resume field to append to it
  const recordUrl = `${process.env.AIRTABLE_BASE_URL!}/${encodeURIComponent(airtableRecordId)}`;

  let existingResume = "";
  try {
    const getRes = await fetch(recordUrl, {
      headers: {
        Authorization: `Bearer ${process.env.AIRTABLE_API_KEY!}`,
      },
      cache: "no-store",
    });
    if (getRes.ok) {
      const record = await getRes.json();
      existingResume = record.fields?.["Resume"] || "";
    }
  } catch (err) {
    console.error("[vapi-webhook] Error fetching existing record:", err);
  }

  // Build the new entry with date
  const date = new Date().toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const newEntry = `--- ${date} ---\n${summary}`;

  // Append to existing content
  const updatedResume = existingResume
    ? `${existingResume}\n\n${newEntry}`
    : newEntry;

  // PATCH the Airtable record
  try {
    const patchRes = await fetch(recordUrl, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${process.env.AIRTABLE_API_KEY!}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fields: {
          Resume: updatedResume,
        },
      }),
    });

    if (!patchRes.ok) {
      const errText = await patchRes.text();
      console.error("[vapi-webhook] Airtable PATCH error:", errText);
      return NextResponse.json(
        { ok: false, error: "Airtable update failed" },
        { status: 500 }
      );
    }

    console.log("[vapi-webhook] Resume updated successfully for", airtableRecordId);
  } catch (err) {
    console.error("[vapi-webhook] Error updating Airtable:", err);
    return NextResponse.json(
      { ok: false, error: "Airtable update failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
