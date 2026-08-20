"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Account, AnalyticsSummary, Category } from "@budget-terry/types";
import { getAnalyticsSummary, listAccounts, listCategories } from "@budget-terry/api-client";
import { apiClient } from "../../lib/api-client";
import { useAuth } from "../../lib/auth-context";

function minorUnitsToDollars(value: number): number {
  return Math.round((value / 100) * 100) / 100;
}

function formatDollars(value: number): string {
  return `$${value.toFixed(2)}`;
}

function startOfCurrentMonth(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function AnalyticsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [from, setFrom] = useState(startOfCurrentMonth);
  const [to, setTo] = useState(today);
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [isLoading, user, router]);

  useEffect(() => {
    if (!user) {
      return;
    }
    listAccounts(apiClient).then(setAccounts);
    listCategories(apiClient).then(setCategories);
  }, [user]);

  useEffect(() => {
    if (!user) {
      return;
    }
    getAnalyticsSummary(apiClient, {
      from,
      to,
      accountId: accountId || undefined,
      categoryId: categoryId || undefined,
    })
      .then(setSummary)
      .catch(() => setErrorMessage("Could not load analytics."));
  }, [user, from, to, accountId, categoryId]);

  const spendingByCategoryData = useMemo(
    () =>
      (summary?.spendingByCategory ?? []).map((entry) => ({
        name: entry.categoryName,
        amount: minorUnitsToDollars(entry.totalMinorUnits),
      })),
    [summary],
  );

  const incomeVsExpensesData = useMemo(
    () =>
      (summary?.incomeVsExpenses ?? []).map((entry) => ({
        month: entry.month,
        Income: minorUnitsToDollars(entry.incomeMinorUnits),
        Expenses: minorUnitsToDollars(entry.expensesMinorUnits),
      })),
    [summary],
  );

  const overallBudgets = useMemo(
    () => (summary?.budgetVsActual ?? []).filter((budget) => budget.totalAmountMinorUnits !== null),
    [summary],
  );
  const budgetVsActualData = useMemo(
    () =>
      overallBudgets.map((budget) => ({
        name: budget.name ?? `${budget.period} budget`,
        Budgeted: minorUnitsToDollars(budget.totalAmountMinorUnits ?? 0),
        Spent: minorUnitsToDollars(budget.spentMinorUnits ?? 0),
      })),
    [overallBudgets],
  );

  if (isLoading || !user) {
    return null;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-8">
      <h1 className="text-xl font-semibold">Analytics</h1>

      <div className="flex flex-wrap gap-2 rounded border p-4 text-sm">
        <label className="flex flex-col gap-1">
          From
          <input
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className="rounded border px-2 py-1"
          />
        </label>
        <label className="flex flex-col gap-1">
          To
          <input
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className="rounded border px-2 py-1"
          />
        </label>
        <label className="flex flex-col gap-1">
          Account
          <select
            value={accountId}
            onChange={(event) => setAccountId(event.target.value)}
            className="rounded border px-2 py-1"
          >
            <option value="">All accounts</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Category
          <select
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            className="rounded border px-2 py-1"
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}

      {summary && (
        <>
          <section>
            <h2 className="text-sm font-semibold text-gray-600">Spending by category</h2>
            {spendingByCategoryData.length === 0 ? (
              <p className="mt-2 text-sm text-gray-500">No spending in this range.</p>
            ) : (
              <div className="mt-2 h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={spendingByCategoryData} layout="vertical" margin={{ left: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tickFormatter={formatDollars} />
                    <YAxis type="category" dataKey="name" width={100} />
                    <Tooltip formatter={(value) => formatDollars(Number(value))} />
                    <Bar dataKey="amount" name="Spent" fill="#111827" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-600">Income vs expenses</h2>
            {incomeVsExpensesData.length === 0 ? (
              <p className="mt-2 text-sm text-gray-500">No transactions in this range.</p>
            ) : (
              <div className="mt-2 h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={incomeVsExpensesData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis tickFormatter={formatDollars} />
                    <Tooltip formatter={(value) => formatDollars(Number(value))} />
                    <Legend />
                    <Bar dataKey="Income" fill="#16a34a" />
                    <Bar dataKey="Expenses" fill="#b91c1c" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-600">
              Budget vs actual (current period)
            </h2>
            {budgetVsActualData.length === 0 ? (
              <p className="mt-2 text-sm text-gray-500">No overall budgets set up.</p>
            ) : (
              <div className="mt-2 h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={budgetVsActualData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={formatDollars} />
                    <Tooltip formatter={(value) => formatDollars(Number(value))} />
                    <Legend />
                    <Bar dataKey="Budgeted" fill="#9ca3af" />
                    <Bar dataKey="Spent" fill="#111827" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-600">Highest expense categories</h2>
            <ul className="mt-2 flex flex-col gap-1 text-sm">
              {summary.highestExpenseCategories.map((entry) => (
                <li key={entry.categoryId} className="flex justify-between">
                  <span>{entry.categoryName}</span>
                  <span>${minorUnitsToDollars(entry.totalMinorUnits).toFixed(2)}</span>
                </li>
              ))}
              {summary.highestExpenseCategories.length === 0 && (
                <p className="text-gray-500">No spending in this range.</p>
              )}
            </ul>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-600">
              Recurring expenses (monthly equivalent)
            </h2>
            <ul className="mt-2 flex flex-col gap-1 text-sm">
              {summary.recurringExpenseSummary.map((entry) => (
                <li key={entry.billId} className="flex justify-between">
                  <span>
                    {entry.name} <span className="text-xs text-gray-500">({entry.recurrence})</span>
                  </span>
                  <span>
                    ${minorUnitsToDollars(entry.monthlyEquivalentMinorUnits).toFixed(2)}/mo
                  </span>
                </li>
              ))}
              {summary.recurringExpenseSummary.length === 0 && (
                <p className="text-gray-500">No recurring bills.</p>
              )}
            </ul>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-600">Savings contributions</h2>
            <p className="mt-1 text-sm">
              ${minorUnitsToDollars(summary.savingsContributions.totalMinorUnits).toFixed(2)} total
              in this range
            </p>
            <ul className="mt-2 flex flex-col gap-1 text-sm">
              {summary.savingsContributions.byGoal.map((entry) => (
                <li key={entry.goalId} className="flex justify-between">
                  <span>{entry.goalName}</span>
                  <span>${minorUnitsToDollars(entry.totalMinorUnits).toFixed(2)}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-600">Goal progress (active goals)</h2>
            <p className="mt-1 text-sm">
              ${minorUnitsToDollars(summary.goalProgress.totalSavedMinorUnits).toFixed(2)} saved of
              ${minorUnitsToDollars(summary.goalProgress.totalTargetMinorUnits).toFixed(2)} (
              {summary.goalProgress.overallPercentage}%)
            </p>
            <ul className="mt-2 flex flex-col gap-1 text-sm">
              {summary.goalProgress.goals.map((goal) => (
                <li key={goal.id} className="flex justify-between">
                  <span>{goal.name}</span>
                  <span>{goal.percentageComplete}%</span>
                </li>
              ))}
              {summary.goalProgress.goals.length === 0 && (
                <p className="text-gray-500">No active goals.</p>
              )}
            </ul>
          </section>
        </>
      )}
    </main>
  );
}
