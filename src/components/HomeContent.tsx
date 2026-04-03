"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import VapiAssistant from "./VapiAssistant";

export default function HomeContent() {
  const { isLoaded } = useUser();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;

    async function check() {
      try {
        const res = await fetch("/api/onboarding/check");
        if (res.ok) {
          const data = await res.json();
          if (!data.exists) {
            router.replace("/onboarding");
            return;
          }
        }
      } catch (err) {
        console.error("Error checking profile:", err);
      }
      setReady(true);
    }
    check();
  }, [isLoaded, router]);

  if (!ready) {
    return (
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-white/20 border-t-emerald-400 rounded-full animate-spin" />
        <p className="text-white/40 text-sm">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <h1 className="mb-2 text-4xl font-bold tracking-tight bg-gradient-to-r from-emerald-300 to-teal-200 bg-clip-text text-transparent">
        Papote
      </h1>
      <p className="mb-10 text-white/30 text-sm font-light">Assistant vocal</p>
      <VapiAssistant />
    </div>
  );
}
