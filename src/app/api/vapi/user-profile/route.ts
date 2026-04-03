import { NextRequest, NextResponse } from "next/server";

/**
 * Vapi tool endpoint: returns the user's profile from call metadata.
 * The profile was pre-fetched client-side and passed via metadata.userProfile.
 * Vapi calls this as a POST with no parameters needed.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();

  const toolCall = body.message?.toolCallList?.[0];

  // Read the profile directly from the call metadata (pre-fetched before the call)
  const metadata =
    body.message?.call?.assistantOverrides?.metadata ||
    body.message?.call?.metadata ||
    {};

  const userProfile = metadata.userProfile;

  if (!userProfile) {
    return NextResponse.json({
      results: [
        {
          toolCallId: toolCall?.id,
          result: "Aucun profil utilisateur disponible.",
        },
      ],
    });
  }

  return NextResponse.json({
    results: [
      {
        toolCallId: toolCall?.id,
        result: `Voici le profil de l'utilisateur :\n${userProfile}`,
      },
    ],
  });
}
