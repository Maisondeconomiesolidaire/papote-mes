import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)"]);
const isOnboardingRoute = createRouteMatcher(["/onboarding"]);

export default clerkMiddleware(async (auth, request) => {
  if (isPublicRoute(request)) return;

  const { userId, sessionClaims } = await auth.protect();

  // If onboarding is not complete, redirect to /onboarding (unless already there or hitting API)
  const onboardingComplete =
    (sessionClaims?.unsafe_metadata as Record<string, unknown>)?.onboardingComplete === true;

  if (!onboardingComplete && !isOnboardingRoute(request) && !request.nextUrl.pathname.startsWith("/api")) {
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }
});

export const config = {
  matcher: ["/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)", "/(api|trpc)(.*)"],
};
