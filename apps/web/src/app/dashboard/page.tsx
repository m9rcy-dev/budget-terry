"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { DashboardSummary } from "@budget-terry/types";
import { getDashboardSummary } from "@budget-terry/api-client";
import { colors } from "@budget-terry/ui";
import { AppShell } from "../../components/AppShell";
import { EmptyState } from "../../components/EmptyState";
import { LoadingState } from "../../components/LoadingState";
import { Section } from "../../components/Section";
import { StatusDot } from "../../components/StatusDot";
import { apiClient } from "../../lib/api-client";
import { useAuth } from "../../lib/auth-context";

const BILL_STATUS_COLOR: Record<string, string> = {
  UPCOMING: colors.billUpcoming,
  DUE_SOON: colors.billDueSoon,
  DUE_TODAY: colors.billDueToday,
  OVERDUE: colors.billOverdue,
};

const BILL_STATUS_LABEL: Record<string, string> = {
  UPCOMING: "Upcoming",
  DUE_SOON: "Due soon",
  DUE_TODAY: "Due today",
  OVERDUE: "Overdue",
};

function minorUnitsToDollars(value: number): string {
  return (value / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function DashboardPage() {
  const { user, isLoading } = useAuth();
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
    <AppShell>
      {!summary ? (
        <LoadingState message="Loading your dashboard…" />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4 rounded-lg border border-border bg-surface p-4 text-center">
            <div>
              <p className="text-xs text-text-secondary">Income</p>
              <p className="tabular-nums text-lg font-semibold text-financial-positive">
                ${minorUnitsToDollars(summary.incomeMinorUnits)}
              </p>
            </div>
            <div>
              <p className="text-xs text-text-secondary">Expenses</p>
              <p className="tabular-nums text-lg font-semibold text-financial-negative">
                ${minorUnitsToDollars(summary.expensesMinorUnits)}
              </p>
            </div>
            <div>
              <p className="text-xs text-text-secondary">Remaining</p>
              <p className="tabular-nums text-lg font-semibold text-text-primary">
                ${minorUnitsToDollars(summary.netMinorUnits)}
              </p>
            </div>
          </div>
          <p className="text-xs text-text-secondary">
            {summary.period.from} – {summary.period.to}
          </p>

          <Section title="Spending by category">
            <ul className="flex flex-col gap-2">
              {summary.categoryTotals.map((entry) => (
                <li key={entry.categoryId} className="flex flex-col gap-1">
                  <div className="flex justify-between text-sm text-text-primary">
                    <span>{entry.categoryName}</span>
                    <span className="tabular-nums">
                      ${minorUnitsToDollars(entry.totalMinorUnits)}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-background">
                    <div
                      className="h-2 rounded-full bg-accent-primary"
                      style={{ width: `${(entry.totalMinorUnits / maxCategoryTotal) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
              {summary.categoryTotals.length === 0 && <EmptyState message="No spending yet." />}
            </ul>
          </Section>

          <Section title="Upcoming bills">
            <ul className="flex flex-col gap-2">
              {summary.upcomingBills.map((entry) => (
                <li
                  key={entry.occurrenceId}
                  className="flex items-center justify-between text-sm text-text-primary"
                >
                  <span className="flex items-center gap-2">
                    {entry.name}
                    <StatusDot
                      color={BILL_STATUS_COLOR[entry.displayStatus] ?? colors.textSecondary}
                      label={BILL_STATUS_LABEL[entry.displayStatus] ?? entry.displayStatus}
                    />
                  </span>
                  <span className="tabular-nums">
                    {entry.date} · ${minorUnitsToDollars(entry.amountMinorUnits)}
                  </span>
                </li>
              ))}
              {summary.upcomingBills.length === 0 && (
                <EmptyState message="Nothing due in the next 7 days." />
              )}
            </ul>
          </Section>

          <Section title="Recent transactions">
            <ul className="flex flex-col gap-1">
              {summary.recentTransactions.map((transaction) => (
                <li key={transaction.id} className="flex justify-between text-sm text-text-primary">
                  <span>
                    {transaction.transactionDate.slice(0, 10)}
                    {transaction.merchant ? ` · ${transaction.merchant}` : ""}
                  </span>
                  <span
                    className={
                      transaction.type === "EXPENSE"
                        ? "tabular-nums text-financial-negative"
                        : "tabular-nums text-financial-positive"
                    }
                  >
                    {transaction.type === "EXPENSE" ? "-" : "+"}$
                    {minorUnitsToDollars(transaction.amountMinorUnits)}
                  </span>
                </li>
              ))}
              {summary.recentTransactions.length === 0 && (
                <EmptyState message="No transactions yet." />
              )}
            </ul>
          </Section>
        </>
      )}
    </AppShell>
  );
}
