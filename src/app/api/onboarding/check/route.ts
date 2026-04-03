import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/**
 * GET /api/onboarding/check
 * Returns whether the current user already has an Airtable record.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const url = new URL(process.env.AIRTABLE_BASE_URL!);
  url.searchParams.set("filterByFormula", `{userId} = '${userId}'`);
  url.searchParams.set("maxRecords", "1");
  url.searchParams.set("fields[]", "userId");

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${process.env.AIRTABLE_API_KEY!}`,
    },
  });

  if (!res.ok) {
    console.error("Airtable check error:", await res.text());
    return NextResponse.json({ exists: false, recordId: null });
  }

  const data = await res.json();
  const record = data.records?.[0];
  return NextResponse.json({
    exists: !!record,
    recordId: record?.id ?? null,
  });
}
