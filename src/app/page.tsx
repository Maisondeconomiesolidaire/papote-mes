import { UserButton } from "@clerk/nextjs";
import VapiAssistant from "@/components/VapiAssistant";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50">
      <div className="absolute top-4 right-4">
        <UserButton />
      </div>
      <h1 className="mb-10 text-3xl font-bold text-gray-800">
        Assistant Vocal Papote
      </h1>
      <VapiAssistant />
    </main>
  );
}
