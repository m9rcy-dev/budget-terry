"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { DashboardSummary } from "@budget-terry/types";
import { getDashboardSummary } from "@budget-terry/api-client";
import { apiClient } from "../../lib/api-client";
import { useAuth } from "../../lib/auth-context";

function minorUnitsToDollars(value: number): string {
  return (value / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function DashboardPage() {
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [isLoading, user, router]);

  useEffect(() => {
    if (!user) {
      return;
    }
    getDashboardSummary(apiClient).then(setSummary);
  }, [user]);

  if (isLoading || !user) {
    return null;
  }

  const maxCategoryTotal = summary
    ? Math.max(1, ...summary.categoryTotals.map((entry) => entry.totalMinorUnits))
    : 1;

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-8">
      <div>
        <p className="text-lg">
          Logged in as {user.displayName} ({user.email})
        </p>
        <nav className="mt-2 flex gap-4 text-sm underline">
          <Link href="/transactions">Transactions</Link>
          <Link href="/accounts">Accounts</Link>
          <Link href="/categories">Categories</Link>
          <Link href="/budgets">Budgets</Link>
          <Link href="/bills">Bills</Link>
          <Link href="/calendar">Calendar</Link>
          <Link href="/goals">Goals</Link>
        </nav>
      </div>

      {summary && (
        <>
          <section className="grid grid-cols-3 gap-4 rounded border p-4 text-center">
            <div>
              <p className="text-xs text-gray-500">Income</p>
              <p className="text-lg font-semibold text-green-700">
                ${minorUnitsToDollars(summary.incomeMinorUnits)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Expenses</p>
              <p className="text-lg font-semibold text-red-700">
                ${minorUnitsToDollars(summary.expensesMinorUnits)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Remaining</p>
              <p className="text-lg font-semibold">${minorUnitsToDollars(summary.netMinorUnits)}</p>
            </div>
          </section>
          <p className="text-xs text-gray-500">
            {summary.period.from} – {summary.period.to}
          </p>

          <section>
            <h2 className="text-sm font-semibold text-gray-600">Spending by category</h2>
            <ul className="mt-2 flex flex-col gap-2">
              {summary.categoryTotals.map((entry) => (
                <li key={entry.categoryId} className="flex flex-col gap-1">
                  <div className="flex justify-between text-sm">
                    <span>{entry.categoryName}</span>
                    <span>${minorUnitsToDollars(entry.totalMinorUnits)}</span>
                  </div>
                  <div className="h-2 rounded bg-gray-100">
                    <div
                      className="h-2 rounded bg-black"
                      style={{ width: `${(entry.totalMinorUnits / maxCategoryTotal) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
              {summary.categoryTotals.length === 0 && (
                <p className="text-sm text-gray-500">No spending yet.</p>
              )}
            </ul>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-600">Recent transactions</h2>
            <ul className="mt-2 flex flex-col gap-1">
              {summary.recentTransactions.map((transaction) => (
                <li key={transaction.id} className="flex justify-between text-sm">
                  <span>
                    {transaction.transactionDate.slice(0, 10)}
                    {transaction.merchant ? ` · ${transaction.merchant}` : ""}
                  </span>
                  <span
                    className={transaction.type === "EXPENSE" ? "text-red-700" : "text-green-700"}
                  >
                    {transaction.type === "EXPENSE" ? "-" : "+"}$
                    {minorUnitsToDollars(transaction.amountMinorUnits)}
                  </span>
                </li>
              ))}
              {summary.recentTransactions.length === 0 && (
                <p className="text-sm text-gray-500">No transactions yet.</p>
              )}
            </ul>
          </section>
        </>
      )}

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
