"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import Vapi from "@vapi-ai/web";
import type {
  SpeechCommandRecognizer,
  SpeechCommandRecognizerResult,
} from "@tensorflow-models/speech-commands";
import AudioVisualizer from "./AudioVisualizer";

const ASSISTANT_ID = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID!;
const PUBLIC_API_KEY = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY!;

const WAKE_WORD = "Papote";
const MODEL_URL = "/teachable/";
const CONFIDENCE_THRESHOLD = 0.85;

type Status = "loading" | "ready" | "listening" | "connecting" | "call-active" | "error";

type VapiConversationMessage = {
  role?: string;
  message?: string;
};

type VapiMessage =
  | {
      type: "conversation-update";
      messages?: VapiConversationMessage[];
    }
  | {
      type: "transcript" | "transcript[transcriptType='final']";
      role: "assistant" | "user";
      transcriptType: "partial" | "final";
      transcript: string;
    }
  | {
      type?: string;
      [key: string]: unknown;
    };

function formatConversationHistory(messages: VapiConversationMessage[]) {
  return messages
    .filter((entry) => {
      const content = entry.message?.trim();
      const role = entry.role?.toLowerCase();
      return Boolean(
        content &&
          role &&
          (role.includes("user") || role.includes("assistant") || role.includes("bot"))
      );
    })
    .map((entry) => {
      const role = entry.role?.toLowerCase() || "";
      const speaker = role.includes("user") ? "Utilisateur" : "Papote";
      return `${speaker}: ${entry.message?.trim()}`;
    })
    .join("\n\n");
}

export default function VapiAssistant() {
  const { user } = useUser();
  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [volume, setVolume] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const vapiRef = useRef<Vapi | null>(null);
  const recognizerRef = useRef<SpeechCommandRecognizer | null>(null);
  const isCallActiveRef = useRef(false);
  const userRef = useRef(user);
  userRef.current = user;
  const cachedProfileRef = useRef<string | null>(null);
  const cachedRecordIdRef = useRef<string | null>(null);
  const cachedFirstNameRef = useRef<string>("");
  const conversationRecordIdRef = useRef<string | null>(null);
  const liveConversationRef = useRef("");
  const elapsedSecondsRef = useRef(0);
  const durationIntervalRef = useRef<number | null>(null);
  const resumeSyncTimeoutRef = useRef<number | null>(null);

  const stopListening = useCallback(() => {
    const recognizer = recognizerRef.current;
    if (recognizer?.isListening()) {
      recognizer.stopListening();
      console.log("🙉 Wake word listener stopped.");
    }
  }, []);

  const prefetchProfile = useCallback(async () => {
    if (cachedProfileRef.current !== null) return;
    try {
      const res = await fetch("/api/user-profile");
      if (res.ok) {
        const data = await res.json();
        cachedProfileRef.current = data.profile || "";
        cachedRecordIdRef.current = data.recordId || null;
        cachedFirstNameRef.current = data.firstName || "";
      }
    } catch (err) {
      console.error("Failed to prefetch user profile:", err);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/user-profile");
      if (res.ok) {
        const data = await res.json();
        cachedProfileRef.current = data.profile || "";
        cachedRecordIdRef.current = data.recordId || null;
        cachedFirstNameRef.current = data.firstName || "";
      }
    } catch (err) {
      console.error("Failed to refresh user profile:", err);
    }
  }, []);

  const syncConversationRecord = useCallback(
    async (updates: { Resume?: string; Duree?: number }) => {
      const recordId = conversationRecordIdRef.current;
      if (!recordId) return;

      try {
        const res = await fetch(`/api/conversations/${recordId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updates),
        });

        if (!res.ok) {
          console.error("Failed to sync conversation record:", await res.text());
        }
      } catch (error) {
        console.error("Failed to sync conversation record:", error);
      }
    },
    []
  );

  const flushConversationResume = useCallback(
    async (resume: string) => {
      if (!conversationRecordIdRef.current) return;
      await syncConversationRecord({ Resume: resume });
    },
    [syncConversationRecord]
  );

  const scheduleConversationResumeSync = useCallback(
    (resume: string, immediate = false) => {
      liveConversationRef.current = resume;

      if (resumeSyncTimeoutRef.current) {
        clearTimeout(resumeSyncTimeoutRef.current);
        resumeSyncTimeoutRef.current = null;
      }

      if (!conversationRecordIdRef.current) return;

      if (immediate) {
        void flushConversationResume(resume);
        return;
      }

      resumeSyncTimeoutRef.current = window.setTimeout(() => {
        resumeSyncTimeoutRef.current = null;
        void flushConversationResume(liveConversationRef.current);
      }, 300);
    },
    [flushConversationResume]
  );

  const clearDurationTracking = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
  }, []);

  const startDurationTracking = useCallback(() => {
    clearDurationTracking();
    elapsedSecondsRef.current = 0;

    durationIntervalRef.current = window.setInterval(() => {
      elapsedSecondsRef.current += 1;

      if (conversationRecordIdRef.current) {
        void syncConversationRecord({ Duree: elapsedSecondsRef.current });
      }
    }, 1000);
  }, [clearDurationTracking, syncConversationRecord]);

  const createConversationRecord = useCallback(async () => {
    if (conversationRecordIdRef.current) return conversationRecordIdRef.current;

    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          Resume: liveConversationRef.current,
          Duree: elapsedSecondsRef.current,
        }),
      });

      if (!res.ok) {
        console.error("Failed to create conversation record:", await res.text());
        return null;
      }

      const data = await res.json();
      conversationRecordIdRef.current = data.recordId;

      if (liveConversationRef.current || elapsedSecondsRef.current > 0) {
        await syncConversationRecord({
          Resume: liveConversationRef.current,
          Duree: elapsedSecondsRef.current,
        });
      }

      return data.recordId as string;
    } catch (error) {
      console.error("Failed to create conversation record:", error);
      return null;
    }
  }, [syncConversationRecord]);

  const finalizeConversationTracking = useCallback(async () => {
    clearDurationTracking();

    if (resumeSyncTimeoutRef.current) {
      clearTimeout(resumeSyncTimeoutRef.current);
      resumeSyncTimeoutRef.current = null;
    }

    if (conversationRecordIdRef.current) {
      await syncConversationRecord({
        Resume: liveConversationRef.current,
        Duree: elapsedSecondsRef.current,
      });
    }

    conversationRecordIdRef.current = null;
    liveConversationRef.current = "";
    elapsedSecondsRef.current = 0;
  }, [clearDurationTracking, syncConversationRecord]);

  const startVapiCall = useCallback(async () => {
    const u = userRef.current;
    setStatus("connecting");
    stopListening();
    liveConversationRef.current = "";
    elapsedSecondsRef.current = 0;
    // Always refresh profile to get latest Resume/conversation history
    await refreshProfile();
    const userProfile = cachedProfileRef.current || "";

    console.log("🚀 Starting Vapi call with profile:", userProfile);

    const now = new Date();
    const currentDate = now.toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const currentDateTime = now.toLocaleString("fr-FR", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

    vapiRef.current?.start(ASSISTANT_ID, {
      variableValues: {
        userProfile,
        userName: cachedFirstNameRef.current,
        date: currentDate,
        currentDateTime,
      },
      metadata: {
        clerkUserId: u?.id,
        airtableRecordId: cachedRecordIdRef.current,
      },
      server: {
        url: `${window.location.origin}/api/vapi/webhook`,
      },
    });
  }, [refreshProfile, stopListening]);

  const startListening = useCallback(() => {
    const recognizer = recognizerRef.current;
    if (isCallActiveRef.current || recognizer?.isListening() !== false) return;

    recognizer.listen(
      async (result: SpeechCommandRecognizerResult) => {
        const classLabels = recognizer.wordLabels();
        const wakeWordIndex = classLabels.indexOf(WAKE_WORD);
        if (wakeWordIndex === -1) {
          console.error(`❌ Wake word "${WAKE_WORD}" not found. Available:`, classLabels);
          recognizer.stopListening();
          setStatus("error");
          setErrorMsg("Erreur de configuration du mot-clé.");
          return;
        }
        const score = Number(result.scores[wakeWordIndex]);
        if (score > CONFIDENCE_THRESHOLD && !isCallActiveRef.current) {
          console.log("🎤 Wake word detected with confidence:", score);
          isCallActiveRef.current = true;
          recognizer.stopListening();
          startVapiCall();
        }
      },
      {
        includeSpectrogram: false,
        probabilityThreshold: 0.60,
        invokeCallbackOnNoiseAndUnknown: false,
        overlapFactor: 0.90,
      }
    );
  }, [startVapiCall]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const tf = await import("@tensorflow/tfjs");
        await tf.ready();

        const speechCommands = await import("@tensorflow-models/speech-commands");

        const vapi = new Vapi(PUBLIC_API_KEY);
        vapiRef.current = vapi;

        const base = new URL(MODEL_URL, window.location.href).href;
        const recognizer = speechCommands.create(
          "BROWSER_FFT",
          undefined,
          base + "model.json",
          base + "metadata.json"
        );
        await recognizer.ensureModelLoaded();
        recognizerRef.current = recognizer;

        if (cancelled) return;

        vapi.on("call-start", () => {
          isCallActiveRef.current = true;
          setStatus("call-active");
          if (recognizerRef.current?.isListening()) {
            recognizerRef.current.stopListening();
          }
          startDurationTracking();
          void createConversationRecord();
        });

        vapi.on("call-end", () => {
          isCallActiveRef.current = false;
          setIsSpeaking(false);
          setVolume(0);
          void finalizeConversationTracking();
          setStatus("ready");
          setTimeout(() => {
            if (!isCallActiveRef.current) {
              startListening();
            }
          }, 500);
        });

        vapi.on("volume-level", (level: number) => {
          setVolume(level);
        });

        vapi.on("speech-start", () => {
          setIsSpeaking(true);
        });

        vapi.on("speech-end", () => {
          setIsSpeaking(false);
        });

        vapi.on("message", (message: VapiMessage) => {
          if (message.type === "conversation-update" && Array.isArray(message.messages)) {
            const formattedConversation = formatConversationHistory(message.messages);
            scheduleConversationResumeSync(formattedConversation);
          }
        });

        vapi.on("call-start-failed", () => {
          isCallActiveRef.current = false;
          void finalizeConversationTracking();
          setStatus("error");
          setErrorMsg("La connexion de l'appel a échoué.");
        });

        vapi.on("error", (error) => {
          console.error("❌ Vapi error:", error);
        });

        prefetchProfile();
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
      clearDurationTracking();
      if (resumeSyncTimeoutRef.current) {
        clearTimeout(resumeSyncTimeoutRef.current);
      }
      vapiRef.current?.stop();
    };
  }, [
    clearDurationTracking,
    createConversationRecord,
    finalizeConversationTracking,
    prefetchProfile,
    scheduleConversationResumeSync,
    startDurationTracking,
    startListening,
    stopListening,
  ]);

  const handleButtonClick = () => {
    if (status === "call-active") {
      vapiRef.current?.stop();
    } else if (status === "ready") {
      startVapiCall();
    }
    // Ignore clicks during "connecting" or other states
  };

  const isActive = status === "call-active";
  const isConnecting = status === "connecting";
  const isDisabled = status === "loading" || status === "error" || isConnecting;

  const vizColor = isActive ? "#f87171" : isConnecting ? "#fbbf24" : "#34d399";

  const statusLabel = {
    loading: "Chargement...",
    ready: "Dites « Papote » ou appuyez pour commencer",
    listening: "Écoute...",
    connecting: "Connexion en cours...",
    "call-active": isSpeaking
      ? "Papote parle..."
      : "Papote écoute...",
    error: errorMsg,
  }[status];

  const orbGradient = isActive
    ? "from-red-400 to-rose-600"
    : isConnecting
    ? "from-amber-400 to-yellow-500"
    : status === "error"
    ? "from-red-300 to-red-500"
    : "from-emerald-400 to-teal-500";

  return (
    <div className="flex flex-col items-center gap-6 select-none">
      {/* Visualizer + Orb container */}
      <div className="relative" style={{ width: 320, height: 320 }}>
        <AudioVisualizer
          isActive={isActive}
          volume={volume}
          isSpeaking={isSpeaking}
          color={vizColor}
        />

        {/* Glow behind the orb */}
        <div
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 rounded-full blur-2xl transition-opacity duration-500 ${
            isActive ? "opacity-50" : "opacity-20"
          }`}
          style={{
            background: isActive
              ? "radial-gradient(circle, #f87171 0%, transparent 70%)"
              : "radial-gradient(circle, #34d399 0%, transparent 70%)",
          }}
        />

        {/* Main orb button */}
        <button
          onClick={handleButtonClick}
          disabled={isDisabled}
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
            w-36 h-36 rounded-full bg-gradient-to-br ${orbGradient}
            shadow-[0_0_40px_rgba(0,0,0,0.15)] hover:shadow-[0_0_60px_rgba(0,0,0,0.2)]
            hover:scale-105 active:scale-95
            transition-all duration-300 ease-out
            disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100
            flex items-center justify-center
            ${isActive ? "orb-pulse" : isConnecting ? "orb-connecting" : status === "ready" ? "orb-breathe" : ""}`}
        >
          {isActive ? (
            /* Stop icon */
            <svg className="w-12 h-12 text-white/90 drop-shadow-md" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          ) : (status === "loading" || isConnecting) ? (
            /* Spinner */
            <svg className="w-10 h-10 text-white/80 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            /* Mic icon */
            <svg className="w-12 h-12 text-white/90 drop-shadow-md" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
            </svg>
          )}
        </button>
      </div>

      {/* Status label */}
      <p className={`text-sm font-medium tracking-wide transition-colors duration-300 ${
        status === "error"
          ? "text-red-400"
          : isConnecting
          ? "text-amber-300"
          : isActive
          ? "text-rose-300"
          : "text-white/60"
      }`}>
        {statusLabel}
      </p>
    </div>
  );
}
