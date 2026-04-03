import { NextRequest, NextResponse } from "next/server";

/**
 * Vapi tool endpoint: fetches a user's profile from Airtable by record ID.
 * Called by the Vapi assistant as a server-side function/tool.
 *
 * The recordId is passed via call metadata (airtableRecordId) or tool arguments.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();

  const toolCall = body.message?.toolCallList?.[0];
  const toolArgs = toolCall?.function?.arguments
    ? JSON.parse(toolCall.function.arguments)
    : {};
  const recordId =
    toolArgs.recordId || body.message?.call?.assistantOverrides?.metadata?.airtableRecordId;

  if (!recordId) {
    return NextResponse.json({
      results: [
        {
          toolCallId: toolCall?.id,
          result: "Erreur : identifiant de record manquant.",
        },
      ],
    });
  }

  // Fetch the record directly by ID
  const url = `${process.env.AIRTABLE_BASE_URL!}/${encodeURIComponent(recordId)}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${process.env.AIRTABLE_API_KEY!}`,
    },
  });

  if (!res.ok) {
    console.error("Airtable fetch error:", await res.text());
    return NextResponse.json({
      results: [
        {
          toolCallId: toolCall?.id,
          result: "Erreur lors de la récupération du profil utilisateur.",
        },
      ],
    });
  }

  const record = await res.json();

  if (!record?.fields) {
    return NextResponse.json({
      results: [
        {
          toolCallId: toolCall?.id,
          result: "Aucun profil trouvé pour cet utilisateur.",
        },
      ],
    });
  }

  const fields = record.fields;
  const profile = `Voici le profil de ${fields["Prénom"] || "l'utilisateur"} :
- Prénom : ${fields["Prénom"] || "Non renseigné"}
- Aidants : ${fields["Aidants de huguette"] || "Non renseigné"}
- Contact : ${fields["Contact"] || "Non renseigné"}
- Pathologies : ${fields["Pathologie"] || "Non renseigné"}
- Hobbies : ${fields["Hobbies"] || "Non renseigné"}
- Localisation : ${fields["Localisation"] || "Non renseigné"}
- Sujets sensibles : ${fields["Topics à appréhender avec finesse"] || "Non renseigné"}
- Sujets à mettre en avant : ${fields["Topics à mettre en avant"] || "Non renseigné"}
- Animaux de compagnie : ${fields["Animaux de compagnie"] || "Non renseigné"}
- Événements : ${fields["Evenements"] || "Non renseigné"}`;

  return NextResponse.json({
    results: [
      {
        toolCallId: toolCall?.id,
        result: profile,
      },
    ],
  });
}
