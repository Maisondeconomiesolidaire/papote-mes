import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

const CONVERSATIONS_TABLE_ID = "tblTrIQ6aVfquKheT";

function getConversationsTableUrl() {
  const profileTableUrl = new URL(process.env.AIRTABLE_BASE_URL!);
  const [, baseId] = profileTableUrl.pathname.split("/").filter(Boolean);

  return `${profileTableUrl.origin}/v0/${baseId}/${CONVERSATIONS_TABLE_ID}`;
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));

  const airtablePayload = {
    fields: {
      userId,
      Resume: typeof body.Resume === "string" ? body.Resume : "",
      Duree: typeof body.Duree === "number" ? body.Duree : 0,
    },
  };

  const res = await fetch(getConversationsTableUrl(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.AIRTABLE_API_KEY!}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(airtablePayload),
  });

  if (!res.ok) {
    const error = await res.text();
    console.error("[conversations] Airtable create error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la création de la conversation" },
      { status: res.status }
    );
  }

  const data = await res.json();

  return NextResponse.json({ success: true, recordId: data.id });
}
