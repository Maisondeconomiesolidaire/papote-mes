import { NextRequest, NextResponse } from "next/server";

/**
 * Vapi tool endpoint: fetches a user's profile from Airtable by Clerk userId.
 * Called by the Vapi assistant as a server-side function/tool.
 *
 * Vapi sends: { message: { call: { assistantOverrides: { metadata: { clerkUserId } } }, toolCallList: [{ id, function: { name, arguments } }] } }
 */
export async function POST(req: NextRequest) {
  const body = await req.json();

  // Extract userId from tool arguments or call metadata
  const toolCall = body.message?.toolCallList?.[0];
  const toolArgs = toolCall?.function?.arguments
    ? JSON.parse(toolCall.function.arguments)
    : {};
  const userId =
    toolArgs.userId || body.message?.call?.assistantOverrides?.metadata?.clerkUserId;

  if (!userId) {
    return NextResponse.json({
      results: [
        {
          toolCallId: toolCall?.id,
          result: "Erreur : identifiant utilisateur manquant.",
        },
      ],
    });
  }

  // Query Airtable with filterByFormula to find the record matching userId
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
    return NextResponse.json({
      results: [
        {
          toolCallId: toolCall?.id,
          result: "Erreur lors de la récupération du profil utilisateur.",
        },
      ],
    });
  }

  const data = await res.json();
  const record = data.records?.[0];

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
