import { UserButton } from "@clerk/nextjs";
import HomeContent from "@/components/HomeContent";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50">
      <div className="absolute top-4 right-4">
        <UserButton />
      </div>
      <HomeContent />
    </main>
  );
}
