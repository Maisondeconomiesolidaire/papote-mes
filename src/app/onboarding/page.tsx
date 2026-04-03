"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";

interface FormData {
  prenom: string;
  aidants: string;
  contact: string;
  pathologie: string;
  hobbies: string;
  localisation: string;
  topicsFinesse: string;
  topicsAvant: string;
  animaux: string;
  evenements: string;
}

const STEPS = [
  {
    key: "prenom" as const,
    label: "Prénom",
    placeholder: "Ex : Huguette",
    description: "Comment s'appelle la personne accompagnée ?",
    multiline: false,
  },
  {
    key: "aidants" as const,
    label: "Aidants",
    placeholder: "Ex : Association Pays de Bray, aide à domicile Frédérique...",
    description: "Quels sont les aidants et services d'aide ?",
    multiline: true,
  },
  {
    key: "contact" as const,
    label: "Contact",
    placeholder: "Ex : Gendre Yohann : y.prata@email.fr",
    description: "Quel est le contact de référence ?",
    multiline: true,
  },
  {
    key: "pathologie" as const,
    label: "Pathologies",
    placeholder: "Ex : Pertes de mémoire, diabète...",
    description: "Quelles sont les pathologies ou problèmes de santé ?",
    multiline: true,
  },
  {
    key: "hobbies" as const,
    label: "Hobbies",
    placeholder: "Ex : La lecture, les chevaux, la collection de clous...",
    description: "Quels sont les centres d'intérêt et loisirs ?",
    multiline: true,
  },
  {
    key: "localisation" as const,
    label: "Localisation",
    placeholder: "Ex : Lachapelle aux Pots, France",
    description: "Où habite la personne ?",
    multiline: false,
  },
  {
    key: "topicsFinesse" as const,
    label: "Sujets sensibles",
    placeholder: "Ex : Histoires de famille, souvenirs douloureux...",
    description:
      "Quels sujets doivent être abordés avec finesse ? (histoire de vie, souvenirs importants...)",
    multiline: true,
  },
  {
    key: "topicsAvant" as const,
    label: "Sujets à mettre en avant",
    placeholder: "Ex : Date de mariage, enfants, moments heureux...",
    description: "Quels sujets positifs faut-il encourager dans la conversation ?",
    multiline: true,
  },
  {
    key: "animaux" as const,
    label: "Animaux de compagnie",
    placeholder: "Ex : Chat Milou, chien Wafwaf (yorkshire)...",
    description: "Y a-t-il des animaux de compagnie (actuels ou passés) ?",
    multiline: true,
  },
  {
    key: "evenements" as const,
    label: "Événements",
    placeholder: "Ex : Rendez-vous médecin le 12/01, promenade le mercredi...",
    description: "Quels sont les événements ou rappels importants ?",
    multiline: true,
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { user } = useUser();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    prenom: "",
    aidants: "",
    contact: "",
    pathologie: "",
    hobbies: "",
    localisation: "",
    topicsFinesse: "",
    topicsAvant: "",
    animaux: "",
    evenements: "",
  });

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const value = formData[current.key];

  const handleNext = async () => {
    if (isLast) {
      setSubmitting(true);
      try {
        const res = await fetch("/api/onboarding", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        if (!res.ok) throw new Error("Erreur serveur");

        // Mark onboarding as completed in Clerk metadata
        await user?.update({
          unsafeMetadata: { onboardingComplete: true },
        });

        router.push("/");
      } catch (err) {
        console.error("Onboarding error:", err);
        alert("Une erreur est survenue. Veuillez réessayer.");
      } finally {
        setSubmitting(false);
      }
    } else {
      setStep((s) => s + 1);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-lg">
        {/* Progress bar */}
        <div className="mb-6 flex gap-1">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i <= step ? "bg-emerald-500" : "bg-gray-200"
              }`}
            />
          ))}
        </div>

        <p className="mb-1 text-sm text-gray-400">
          Étape {step + 1} / {STEPS.length}
        </p>
        <h2 className="mb-2 text-2xl font-bold text-gray-800">{current.label}</h2>
        <p className="mb-6 text-gray-500">{current.description}</p>

        {current.multiline ? (
          <textarea
            className="w-full rounded-lg border border-gray-300 p-3 text-gray-700 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            rows={5}
            placeholder={current.placeholder}
            value={value}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, [current.key]: e.target.value }))
            }
          />
        ) : (
          <input
            type="text"
            className="w-full rounded-lg border border-gray-300 p-3 text-gray-700 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            placeholder={current.placeholder}
            value={value}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, [current.key]: e.target.value }))
            }
          />
        )}

        <div className="mt-6 flex justify-between">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="rounded-lg px-5 py-2 text-gray-500 hover:bg-gray-100 disabled:invisible"
          >
            Retour
          </button>
          <button
            onClick={handleNext}
            disabled={submitting || !value.trim()}
            className="rounded-lg bg-emerald-500 px-6 py-2 font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
          >
            {submitting ? "Envoi..." : isLast ? "Terminer" : "Suivant"}
          </button>
        </div>
      </div>
    </div>
  );
}
