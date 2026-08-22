import Link from "next/link";
import { Button } from "../components/Button";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background p-8 text-center">
      <h1 className="text-3xl font-semibold text-text-primary">Budget Terry</h1>
      <p className="max-w-sm text-sm text-text-secondary">
        A calm, practical way to track spending, budgets, bills, and savings goals.
      </p>
      <div className="mt-4 flex gap-3">
        <Link href="/login">
          <Button variant="primary">Log in</Button>
        </Link>
        <Link href="/register">
          <Button variant="secondary">Create an account</Button>
        </Link>
      </div>
    </main>
  );
}
