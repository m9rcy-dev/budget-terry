"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Budget, Category } from "@budget-terry/types";
import {
  createBudget,
  deleteBudget,
  listBudgets,
  listCategories,
  updateBudget,
} from "@budget-terry/api-client";
import { AppShell } from "../../components/AppShell";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { Input, Select } from "../../components/Field";
import { LoadingState } from "../../components/LoadingState";
import { Section } from "../../components/Section";
import { apiClient } from "../../lib/api-client";
import { useAuth } from "../../lib/auth-context";

const PERIODS = ["WEEKLY", "FORTNIGHTLY", "MONTHLY"] as const;

function dollarsToMinorUnits(value: string): number {
  return Math.round(Number.parseFloat(value || "0") * 100);
}

function minorUnitsToDollars(value: number): string {
  return (value / 100).toFixed(2);
}

const STATUS_COLOR: Record<string, string> = {
  HEALTHY: "bg-budget-healthy",
  APPROACHING: "bg-budget-approaching",
  EXCEEDED: "bg-budget-exceeded",
};

const STATUS_LABEL: Record<string, string> = {
  HEALTHY: "Healthy",
  APPROACHING: "Approaching limit",
  EXCEEDED: "Over budget",
};

function StatusBar({ status, percentageUsed }: { status: string; percentageUsed: number }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-xs text-text-secondary">
        <span>{STATUS_LABEL[status] ?? status}</span>
        <span className="tabular-nums">{percentageUsed}%</span>
      </div>
      <div className="h-2 rounded-full bg-background">
        <div
          className={`h-2 rounded-full ${STATUS_COLOR[status] ?? "bg-text-secondary"}`}
          style={{ width: `${Math.min(100, percentageUsed)}%` }}
        />
      </div>
    </div>
  );
}

export default function BudgetsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [budgets, setBudgets] = useState<Budget[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>("MONTHLY");
  const [anchorDate, setAnchorDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [mode, setMode] = useState<"overall" | "perCategory">("overall");
  const [totalAmount, setTotalAmount] = useState("");
  const [categoryAmounts, setCategoryAmounts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [isLoading, user, router]);

  const refresh = async (): Promise<void> => {
    setBudgets(await listBudgets(apiClient));
  };

  useEffect(() => {
    if (!user) {
      return;
    }
    refresh().catch(() => setErrorMessage("Could not load budgets."));
    listCategories(apiClient).then(setCategories);
  }, [user]);

  const resetForm = (): void => {
    setEditingId(null);
    setName("");
    setPeriod("MONTHLY");
    setAnchorDate(new Date().toISOString().slice(0, 10));
    setMode("overall");
    setTotalAmount("");
    setCategoryAmounts({});
  };

  const onSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setErrorMessage(null);
    try {
      const input =
        mode === "overall"
          ? {
              name: name || undefined,
              period,
              anchorDate,
              currency: "NZD" as const,
              totalAmountMinorUnits: dollarsToMinorUnits(totalAmount),
            }
          : {
              name: name || undefined,
              period,
              anchorDate,
              currency: "NZD" as const,
              categoryAllocations: Object.entries(categoryAmounts)
                .filter(([, amount]) => Number.parseFloat(amount || "0") > 0)
                .map(([categoryId, amount]) => ({
                  categoryId,
                  amountMinorUnits: dollarsToMinorUnits(amount),
                })),
            };

      if (editingId) {
        await updateBudget(apiClient, editingId, input);
      } else {
        await createBudget(apiClient, input);
      }
      resetForm();
      await refresh();
    } catch {
      setErrorMessage(
        "Could not save the budget — check it has either an overall amount or category amounts, not both.",
      );
    }
  };

  const onEdit = (budget: Budget): void => {
    setEditingId(budget.id);
    setName(budget.name ?? "");
    setPeriod(budget.period);
    setAnchorDate(budget.anchorDate.slice(0, 10));
    if (budget.totalAmountMinorUnits !== null) {
      setMode("overall");
      setTotalAmount(minorUnitsToDollars(budget.totalAmountMinorUnits));
      setCategoryAmounts({});
    } else {
      setMode("perCategory");
      setTotalAmount("");
      setCategoryAmounts(
        Object.fromEntries(
          budget.categories.map((entry) => [
            entry.categoryId,
            minorUnitsToDollars(entry.amountMinorUnits),
          ]),
        ),
      );
    }
  };

  const onDelete = async (id: string): Promise<void> => {
    await deleteBudget(apiClient, id);
    if (editingId === id) {
      resetForm();
    }
    await refresh();
  };

  if (isLoading || !user) {
    return null;
  }

  return (
    <AppShell>
      <h1 className="text-xl font-semibold text-text-primary">Budgets</h1>

      <Section title={editingId ? "Edit budget" : "New budget"}>
        <form onSubmit={onSubmit} className="flex flex-col gap-2">
          <Input
            aria-label="Name (optional)"
            placeholder="Name (optional)"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <div className="flex gap-2">
            <Select
              aria-label="Period"
              value={period}
              onChange={(event) => setPeriod(event.target.value as (typeof PERIODS)[number])}
            >
              {PERIODS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
            <Input
              aria-label="Anchor date"
              type="date"
              value={anchorDate}
              onChange={(event) => setAnchorDate(event.target.value)}
              required
            />
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant={mode === "overall" ? "primary" : "secondary"}
              onClick={() => setMode("overall")}
            >
              Overall
            </Button>
            <Button
              type="button"
              variant={mode === "perCategory" ? "primary" : "secondary"}
              onClick={() => setMode("perCategory")}
            >
              Per category
            </Button>
          </div>

          {mode === "overall" ? (
            <Input
              aria-label="Total amount"
              type="number"
              step="0.01"
              placeholder="Total amount"
              value={totalAmount}
              onChange={(event) => setTotalAmount(event.target.value)}
              required
            />
          ) : (
            <div className="flex flex-col gap-1">
              {categories.map((category) => (
                <div key={category.id} className="flex items-center gap-2">
                  <span className="w-32 text-sm text-text-primary">{category.name}</span>
                  <Input
                    aria-label={`${category.name} amount`}
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={categoryAmounts[category.id] ?? ""}
                    onChange={(event) =>
                      setCategoryAmounts((current) => ({
                        ...current,
                        [category.id]: event.target.value,
                      }))
                    }
                    className="w-28 text-sm"
                  />
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <Button type="submit">{editingId ? "Save changes" : "Create budget"}</Button>
            {editingId && (
              <Button type="button" variant="secondary" onClick={resetForm}>
                Cancel
              </Button>
            )}
          </div>
          {errorMessage && <ErrorState message={errorMessage} />}
        </form>
      </Section>

      {budgets === null ? (
        <LoadingState message="Loading budgets…" />
      ) : (
        <ul className="flex flex-col gap-4">
          {budgets.map((budget) => (
            <li key={budget.id} className="rounded-lg border border-border bg-surface p-4">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <p className="font-medium text-text-primary">
                    {budget.name ?? `${budget.period} budget`}
                  </p>
                  <p className="text-xs text-text-secondary">
                    {budget.currentPeriod.start} – {budget.currentPeriod.end}
                  </p>
                </div>
                <div className="flex gap-2 text-sm">
                  <button
                    type="button"
                    onClick={() => onEdit(budget)}
                    className="text-accent-primary underline underline-offset-2"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(budget.id)}
                    className="text-financial-negative underline underline-offset-2"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {budget.status !== null && (
                <StatusBar status={budget.status} percentageUsed={budget.percentageUsed ?? 0} />
              )}
              {budget.status !== null && (
                <p className="mt-1 tabular-nums text-xs text-text-secondary">
                  ${minorUnitsToDollars(budget.spentMinorUnits ?? 0)} of $
                  {minorUnitsToDollars(budget.totalAmountMinorUnits ?? 0)}
                </p>
              )}

              {budget.categories.length > 0 && (
                <div className="mt-2 flex flex-col gap-3">
                  {budget.categories.map((entry) => (
                    <div key={entry.categoryId}>
                      <p className="text-sm text-text-primary">{entry.categoryName}</p>
                      <StatusBar status={entry.status} percentageUsed={entry.percentageUsed} />
                      <p className="mt-1 tabular-nums text-xs text-text-secondary">
                        ${minorUnitsToDollars(entry.spentMinorUnits)} of $
                        {minorUnitsToDollars(entry.amountMinorUnits)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </li>
          ))}
          {budgets.length === 0 && <EmptyState message="No budgets yet." />}
        </ul>
      )}
    </AppShell>
  );
}
