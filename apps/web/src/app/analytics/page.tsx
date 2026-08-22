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
import { colors } from "@budget-terry/ui";
import { AppShell } from "../../components/AppShell";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { Input, Select } from "../../components/Field";
import { LoadingState } from "../../components/LoadingState";
import { Section } from "../../components/Section";
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
    <AppShell>
      <h1 className="text-xl font-semibold text-text-primary">Analytics</h1>

      <Section>
        <div className="flex flex-wrap gap-3 text-sm">
          <label className="flex flex-col gap-1 text-text-secondary">
            From
            <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-text-secondary">
            To
            <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-text-secondary">
            Account
            <Select value={accountId} onChange={(event) => setAccountId(event.target.value)}>
              <option value="">All accounts</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-text-secondary">
            Category
            <Select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </label>
        </div>
      </Section>

      {errorMessage && <ErrorState message={errorMessage} />}

      {!summary ? (
        <LoadingState message="Loading analytics…" />
      ) : (
        <>
          <Section title="Spending by category">
            {spendingByCategoryData.length === 0 ? (
              <EmptyState message="No spending in this range." />
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={spendingByCategoryData} layout="vertical" margin={{ left: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={colors.border} />
                    <XAxis
                      type="number"
                      tickFormatter={formatDollars}
                      stroke={colors.textSecondary}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={100}
                      stroke={colors.textSecondary}
                    />
                    <Tooltip formatter={(value) => formatDollars(Number(value))} />
                    <Bar dataKey="amount" name="Spent" fill={colors.accentPrimary} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Section>

          <Section title="Income vs expenses">
            {incomeVsExpensesData.length === 0 ? (
              <EmptyState message="No transactions in this range." />
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={incomeVsExpensesData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={colors.border} />
                    <XAxis dataKey="month" stroke={colors.textSecondary} />
                    <YAxis tickFormatter={formatDollars} stroke={colors.textSecondary} />
                    <Tooltip formatter={(value) => formatDollars(Number(value))} />
                    <Legend />
                    <Bar dataKey="Income" fill={colors.financialPositive} />
                    <Bar dataKey="Expenses" fill={colors.financialNegative} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Section>

          <Section title="Budget vs actual (current period)">
            {budgetVsActualData.length === 0 ? (
              <EmptyState message="No overall budgets set up." />
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={budgetVsActualData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={colors.border} />
                    <XAxis dataKey="name" stroke={colors.textSecondary} />
                    <YAxis tickFormatter={formatDollars} stroke={colors.textSecondary} />
                    <Tooltip formatter={(value) => formatDollars(Number(value))} />
                    <Legend />
                    <Bar dataKey="Budgeted" fill={colors.accentSecondary} />
                    <Bar dataKey="Spent" fill={colors.accentPrimary} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Section>

          <Section title="Highest expense categories">
            <ul className="flex flex-col gap-1 text-sm text-text-primary">
              {summary.highestExpenseCategories.map((entry) => (
                <li key={entry.categoryId} className="flex justify-between">
                  <span>{entry.categoryName}</span>
                  <span className="tabular-nums">
                    ${minorUnitsToDollars(entry.totalMinorUnits).toFixed(2)}
                  </span>
                </li>
              ))}
              {summary.highestExpenseCategories.length === 0 && (
                <EmptyState message="No spending in this range." />
              )}
            </ul>
          </Section>

          <Section title="Recurring expenses (monthly equivalent)">
            <ul className="flex flex-col gap-1 text-sm text-text-primary">
              {summary.recurringExpenseSummary.map((entry) => (
                <li key={entry.billId} className="flex justify-between">
                  <span>
                    {entry.name}{" "}
                    <span className="text-xs text-text-secondary">({entry.recurrence})</span>
                  </span>
                  <span className="tabular-nums">
                    ${minorUnitsToDollars(entry.monthlyEquivalentMinorUnits).toFixed(2)}/mo
                  </span>
                </li>
              ))}
              {summary.recurringExpenseSummary.length === 0 && (
                <EmptyState message="No recurring bills." />
              )}
            </ul>
          </Section>

          <Section title="Savings contributions">
            <p className="tabular-nums text-sm text-text-primary">
              ${minorUnitsToDollars(summary.savingsContributions.totalMinorUnits).toFixed(2)} total
              in this range
            </p>
            <ul className="flex flex-col gap-1 text-sm text-text-primary">
              {summary.savingsContributions.byGoal.map((entry) => (
                <li key={entry.goalId} className="flex justify-between">
                  <span>{entry.goalName}</span>
                  <span className="tabular-nums">
                    ${minorUnitsToDollars(entry.totalMinorUnits).toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Goal progress (active goals)">
            <p className="tabular-nums text-sm text-text-primary">
              ${minorUnitsToDollars(summary.goalProgress.totalSavedMinorUnits).toFixed(2)} saved of
              ${minorUnitsToDollars(summary.goalProgress.totalTargetMinorUnits).toFixed(2)} (
              {summary.goalProgress.overallPercentage}%)
            </p>
            <ul className="flex flex-col gap-1 text-sm text-text-primary">
              {summary.goalProgress.goals.map((goal) => (
                <li key={goal.id} className="flex justify-between">
                  <span>{goal.name}</span>
                  <span className="tabular-nums">{goal.percentageComplete}%</span>
                </li>
              ))}
              {summary.goalProgress.goals.length === 0 && <EmptyState message="No active goals." />}
            </ul>
          </Section>
        </>
      )}
    </AppShell>
  );
}
