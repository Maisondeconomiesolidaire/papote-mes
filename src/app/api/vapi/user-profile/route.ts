import { NextRequest, NextResponse } from "next/server";

/**
 * Vapi tool endpoint: fetches the user's full Airtable profile.
 * Uses clerkUserId from call metadata to find the right record.
 * No parameters needed from Vapi — everything comes from metadata.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();

  console.log("[vapi-tool] Full payload:", JSON.stringify(body, null, 2));

  const toolCall = body.message?.toolCallList?.[0];

  // Try multiple metadata paths (Vapi structure varies)
  const metadata =
    body.message?.call?.assistantOverrides?.metadata ||
    body.message?.call?.metadata ||
    body.message?.metadata ||
    {};

  const userId = metadata.clerkUserId;
  console.log("[vapi-tool] clerkUserId from metadata:", userId);

  if (!userId) {
    return NextResponse.json({
      results: [
        {
          toolCallId: toolCall?.id,
          result: "Erreur : identifiant utilisateur manquant dans les metadata.",
        },
      ],
    });
  }

  // Fetch from Airtable using the Clerk userId
  const url = new URL(process.env.AIRTABLE_BASE_URL!);
  url.searchParams.set("filterByFormula", `{userId} = '${userId}'`);
  url.searchParams.set("maxRecords", "1");

  console.log("[vapi-tool] Airtable query:", url.toString());

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${process.env.AIRTABLE_API_KEY!}`,
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("[vapi-tool] Airtable error:", errText);
    return NextResponse.json({
      results: [
        {
          toolCallId: toolCall?.id,
          result: "Erreur lors de la récupération du profil.",
        },
      ],
    });
  }

  const data = await res.json();
  const record = data.records?.[0];
  console.log("[vapi-tool] Airtable record found:", record?.id, "fields:", JSON.stringify(record?.fields));

  if (!record) {
    return NextResponse.json({
      results: [
        {
          toolCallId: toolCall?.id,
          result: "Aucun profil trouvé pour cet utilisateur.",
        },
      ],
    });
  }

  // Return ALL fields from the record
  const f = record.fields;
  const lines: string[] = [];
  for (const [key, value] of Object.entries(f)) {
    if (key === "userId") continue; // skip internal field
    lines.push(`- ${key} : ${value || "Non renseigné"}`);
  }

  const profile = `Voici le profil complet de l'utilisateur :\n${lines.join("\n")}`;

  return NextResponse.json({
    results: [
      {
        toolCallId: toolCall?.id,
        result: profile,
      },
    ],
  });
}
