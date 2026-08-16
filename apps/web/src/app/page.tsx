import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2 p-8">
      <h1 className="text-2xl font-semibold">Budget Terry</h1>
      <p className="text-sm text-gray-500">V2 is under construction.</p>
      <Link href="/login" className="mt-4 text-sm underline">
        Log in
      </Link>
    </main>
  );
}
