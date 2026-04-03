import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const body = await req.json();

  const airtablePayload = {
    fields: {
      userId,
      "Prénom": body.prenom,
      "Aidants de huguette": body.aidants,
      "Contact": body.contact,
      "Pathologie": body.pathologie,
      "Hobbies": body.hobbies,
      "Localisation": body.localisation,
      "Topics à appréhender avec finesse": body.topicsFinesse,
      "Topics à mettre en avant": body.topicsAvant,
      "Animaux de compagnie": body.animaux,
      "Evenements": body.evenements,
    },
  };

  const res = await fetch(process.env.AIRTABLE_BASE_URL!, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(airtablePayload),
  });

  if (!res.ok) {
    const error = await res.json();
    console.error("Airtable error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la création du profil" },
      { status: res.status }
    );
  }

  const data = await res.json();
  return NextResponse.json({ success: true, recordId: data.id });
}
