"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import Vapi from "@vapi-ai/web";

const ASSISTANT_ID = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID!;
const PUBLIC_API_KEY = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY!;

const WAKE_WORD = "Papote";
const MODEL_URL = "/teachable/";
const CONFIDENCE_THRESHOLD = 0.90;

type Status = "loading" | "ready" | "listening" | "call-active" | "error";

export default function VapiAssistant({ recordId }: { recordId: string | null }) {
  const { user } = useUser();
  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const vapiRef = useRef<Vapi | null>(null);
  const recognizerRef = useRef<any>(null);
  const isCallActiveRef = useRef(false);
  const userRef = useRef(user);
  userRef.current = user;

  const stopListening = useCallback(() => {
    const recognizer = recognizerRef.current;
    if (recognizer?.isListening()) {
      recognizer.stopListening();
      console.log("🙉 Wake word listener stopped.");
    }
  }, []);

  const startListening = useCallback(() => {
    const recognizer = recognizerRef.current;
    if (isCallActiveRef.current || recognizer?.isListening()) return;

    recognizer.listen(
      (result: { scores: Float32Array }) => {
        const classLabels: string[] = recognizer.wordLabels();
        const wakeWordIndex = classLabels.indexOf(WAKE_WORD);
        if (wakeWordIndex === -1) {
          console.error(`❌ Wake word "${WAKE_WORD}" not found. Available:`, classLabels);
          recognizer.stopListening();
          setStatus("error");
          setErrorMsg("Erreur de configuration du mot-clé.");
          return;
        }
        const score = result.scores[wakeWordIndex];
        if (score > CONFIDENCE_THRESHOLD && !isCallActiveRef.current) {
          console.log("🎤 Wake word detected with confidence:", score);
          isCallActiveRef.current = true; // prevent duplicate triggers
          recognizer.stopListening();
          const u = userRef.current;
          vapiRef.current?.start(ASSISTANT_ID, {
            metadata: {
              clerkUserId: u?.id,
              userName: u?.fullName ?? u?.firstName,
              userEmail: u?.primaryEmailAddress?.emailAddress,
              airtableRecordId: recordId,
            },
          });
        }
      },
      {
        includeSpectrogram: false,
        probabilityThreshold: 0.75,
        invokeCallbackOnNoiseAndUnknown: false,
        overlapFactor: 0.75,
      }
    );
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        // 1. Import TensorFlow and speech-commands
        const tf = await import("@tensorflow/tfjs");
        await tf.ready();
        console.log("✅ TensorFlow.js loaded.");

        const speechCommands = await import("@tensorflow-models/speech-commands");
        console.log("✅ Speech commands loaded.");

        // 2. Initialize Vapi
        const vapi = new Vapi(PUBLIC_API_KEY);
        vapiRef.current = vapi;
        console.log("✅ Vapi instance created.");

        // 3. Load wake word model
        const base = new URL(MODEL_URL, window.location.href).href;
        const recognizer = speechCommands.create(
          "BROWSER_FFT",
          undefined,
          base + "model.json",
          base + "metadata.json"
        );
        await recognizer.ensureModelLoaded();
        recognizerRef.current = recognizer;
        console.log("✅ Wake word model loaded.");

        if (cancelled) return;

        // 4. Set up Vapi event listeners
        vapi.on("call-start", () => {
          console.log("📞 Call started.");
          isCallActiveRef.current = true;
          setStatus("call-active");
          if (recognizerRef.current?.isListening()) {
            recognizerRef.current.stopListening();
          }
        });

        vapi.on("call-end", () => {
          console.log("🏁 Call ended.");
          isCallActiveRef.current = false;
          setStatus("ready");
          // Restart listening after a short delay
          setTimeout(() => {
            if (!isCallActiveRef.current) {
              startListening();
            }
          }, 500);
        });

        setStatus("ready");
        startListening();
      } catch (error) {
        console.error("❌ Initialization error:", error);
        if (!cancelled) {
          setStatus("error");
          setErrorMsg("Une erreur critique est survenue.");
        }
      }
    }

    init();

    return () => {
      cancelled = true;
      stopListening();
      vapiRef.current?.stop();
    };
  }, [startListening, stopListening]);

  const handleButtonClick = () => {
    if (status === "call-active") {
      vapiRef.current?.stop();
    } else if (status === "ready") {
      vapiRef.current?.start(ASSISTANT_ID, {
        metadata: {
          clerkUserId: user?.id,
          userName: user?.fullName ?? user?.firstName,
          userEmail: user?.primaryEmailAddress?.emailAddress,
        },
      });
    }
  };

  const statusConfig = {
    loading: { text: "Chargement...", color: "bg-gray-400", pulse: true },
    ready: { text: "Prêt. Dites 'Papote' !", color: "bg-emerald-400", pulse: false },
    listening: { text: "Écoute...", color: "bg-blue-400", pulse: true },
    "call-active": { text: "Appel en cours — cliquez pour terminer", color: "bg-red-500", pulse: true },
    error: { text: errorMsg, color: "bg-red-400", pulse: false },
  };

  const { text, color, pulse } = statusConfig[status];

  return (
    <div className="flex flex-col items-center gap-8">
      <button
        onClick={handleButtonClick}
        disabled={status === "loading" || status === "error"}
        className={`w-20 h-20 rounded-full ${color} ${
          pulse ? "animate-pulse" : ""
        } shadow-lg hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center`}
      >
        {status === "call-active" ? (
          <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
        ) : (
          <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5z" />
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
          </svg>
        )}
      </button>
      <p className="text-gray-600 text-lg">{text}</p>
    </div>
  );
}
