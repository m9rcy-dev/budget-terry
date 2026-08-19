"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../../lib/auth-context";

export default function DashboardPage() {
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [isLoading, user, router]);

  if (isLoading || !user) {
    return null;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <p className="text-lg">
        Logged in as {user.displayName} ({user.email})
      </p>
      <nav className="flex gap-4 text-sm underline">
        <Link href="/transactions">Transactions</Link>
        <Link href="/accounts">Accounts</Link>
        <Link href="/categories">Categories</Link>
      </nav>
      <button
        type="button"
        onClick={async () => {
          await logout();
          router.push("/login");
        }}
        className="rounded bg-black px-3 py-2 text-white"
      >
        Log out
      </button>
    </main>
  );
}
