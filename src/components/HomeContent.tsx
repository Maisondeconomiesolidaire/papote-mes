"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import VapiAssistant from "./VapiAssistant";

export default function HomeContent() {
  const { isLoaded } = useUser();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [recordId, setRecordId] = useState<string | null>(null);

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
          setRecordId(data.recordId);
        }
      } catch (err) {
        console.error("Error checking profile:", err);
      }
      setReady(true);
    }
    check();
  }, [isLoaded, router]);

  if (!ready) {
    return <p className="text-gray-500 text-lg">Chargement...</p>;
  }

  return (
    <>
      <h1 className="mb-10 text-3xl font-bold text-gray-800">
        Assistant Vocal Papote
      </h1>
      <VapiAssistant recordId={recordId} />
    </>
  );
}
