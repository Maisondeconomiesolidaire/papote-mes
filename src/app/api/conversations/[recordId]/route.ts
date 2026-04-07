import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

function getConversationRecordUrl(recordId: string) {
  const profileTableUrl = new URL(process.env.AIRTABLE_BASE_URL!);
  const [, baseId] = profileTableUrl.pathname.split("/").filter(Boolean);

  return `${profileTableUrl.origin}/v0/${baseId}/tblTrIQ6aVfquKheT/${encodeURIComponent(recordId)}`;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ recordId: string }> }
) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { recordId } = await params;
  const body = await req.json().catch(() => ({}));
  const fields: Record<string, string | number> = {};

  if (typeof body.Resume === "string") {
    fields.Resume = body.Resume;
  }

  if (typeof body.Duree === "number") {
    fields.Duree = body.Duree;
  }

  if (Object.keys(fields).length === 0) {
    return NextResponse.json(
      { error: "Aucune donnée à mettre à jour" },
      { status: 400 }
    );
  }

  const res = await fetch(getConversationRecordUrl(recordId), {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${process.env.AIRTABLE_API_KEY!}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields }),
  });

  if (!res.ok) {
    const error = await res.text();
    console.error("[conversations] Airtable update error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour de la conversation" },
      { status: res.status }
    );
  }

  return NextResponse.json({ success: true });
}
