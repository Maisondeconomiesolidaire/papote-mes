import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/**
 * GET /api/user-profile
 * Uses Clerk auth to identify the current user, fetches their Airtable record
 * and returns the full profile as a formatted string.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const url = new URL(process.env.AIRTABLE_BASE_URL!);
  url.searchParams.set("filterByFormula", `{userId} = '${userId}'`);
  url.searchParams.set("maxRecords", "1");

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${process.env.AIRTABLE_API_KEY!}`,
    },
  });

  if (!res.ok) {
    console.error("Airtable fetch error:", await res.text());
    return NextResponse.json({ error: "Erreur Airtable" }, { status: 500 });
  }

  const data = await res.json();
  const record = data.records?.[0];

  if (!record) {
    return NextResponse.json({ profile: null });
  }

  const fields = record.fields;
  const profile = [
    `Prénom : ${fields["Prénom"] || "Non renseigné"}`,
    `Aidants : ${fields["Aidants de huguette"] || "Non renseigné"}`,
    `Contact : ${fields["Contact"] || "Non renseigné"}`,
    `Pathologies : ${fields["Pathologie"] || "Non renseigné"}`,
    `Hobbies : ${fields["Hobbies"] || "Non renseigné"}`,
    `Localisation : ${fields["Localisation"] || "Non renseigné"}`,
    `Sujets sensibles : ${fields["Topics à appréhender avec finesse"] || "Non renseigné"}`,
    `Sujets à mettre en avant : ${fields["Topics à mettre en avant"] || "Non renseigné"}`,
    `Animaux de compagnie : ${fields["Animaux de compagnie"] || "Non renseigné"}`,
    `Événements : ${fields["Evenements"] || "Non renseigné"}`,
  ].join("\n");

  return NextResponse.json({ profile });
}
