import { UserButton } from "@clerk/nextjs";
import HomeContent from "@/components/HomeContent";

export default function Home() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 overflow-hidden">
      {/* Subtle ambient background glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-emerald-500/5 blur-3xl" />
      </div>

      <div className="absolute top-5 right-5 z-10">
        <UserButton
          appearance={{
            elements: {
              avatarBox: "w-10 h-10 ring-2 ring-white/10",
            },
          }}
        />
      </div>
      <HomeContent />
    </main>
  );
}
