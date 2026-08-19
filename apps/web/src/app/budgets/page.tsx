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
  HEALTHY: "bg-green-600",
  APPROACHING: "bg-amber-500",
  EXCEEDED: "bg-red-600",
};

const STATUS_LABEL: Record<string, string> = {
  HEALTHY: "Healthy",
  APPROACHING: "Approaching limit",
  EXCEEDED: "Over budget",
};

function StatusBar({ status, percentageUsed }: { status: string; percentageUsed: number }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-xs">
        <span>{STATUS_LABEL[status] ?? status}</span>
        <span>{percentageUsed}%</span>
      </div>
      <div className="h-2 rounded bg-gray-100">
        <div
          className={`h-2 rounded ${STATUS_COLOR[status] ?? "bg-gray-400"}`}
          style={{ width: `${Math.min(100, percentageUsed)}%` }}
        />
      </div>
    </div>
  );
}

export default function BudgetsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [budgets, setBudgets] = useState<Budget[]>([]);
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
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-8">
      <h1 className="text-xl font-semibold">Budgets</h1>

      <form onSubmit={onSubmit} className="flex flex-col gap-2 rounded border p-4">
        <p className="text-sm font-medium">{editingId ? "Edit budget" : "New budget"}</p>
        <input
          placeholder="Name (optional)"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="rounded border px-3 py-2"
        />
        <div className="flex gap-2">
          <select
            value={period}
            onChange={(event) => setPeriod(event.target.value as (typeof PERIODS)[number])}
            className="rounded border px-3 py-2"
          >
            {PERIODS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={anchorDate}
            onChange={(event) => setAnchorDate(event.target.value)}
            className="rounded border px-3 py-2"
            required
          />
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode("overall")}
            className={`rounded px-3 py-1 text-sm ${mode === "overall" ? "bg-black text-white" : "border"}`}
          >
            Overall
          </button>
          <button
            type="button"
            onClick={() => setMode("perCategory")}
            className={`rounded px-3 py-1 text-sm ${mode === "perCategory" ? "bg-black text-white" : "border"}`}
          >
            Per category
          </button>
        </div>

        {mode === "overall" ? (
          <input
            type="number"
            step="0.01"
            placeholder="Total amount"
            value={totalAmount}
            onChange={(event) => setTotalAmount(event.target.value)}
            className="rounded border px-3 py-2"
            required
          />
        ) : (
          <div className="flex flex-col gap-1">
            {categories.map((category) => (
              <div key={category.id} className="flex items-center gap-2">
                <span className="w-32 text-sm">{category.name}</span>
                <input
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
                  className="w-28 rounded border px-2 py-1 text-sm"
                />
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <button type="submit" className="rounded bg-black px-3 py-2 text-white">
            {editingId ? "Save changes" : "Create budget"}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm} className="rounded border px-3 py-2 text-sm">
              Cancel
            </button>
          )}
        </div>
        {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
      </form>

      <ul className="flex flex-col gap-4">
        {budgets.map((budget) => (
          <li key={budget.id} className="rounded border p-4">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <p className="font-medium">{budget.name ?? `${budget.period} budget`}</p>
                <p className="text-xs text-gray-500">
                  {budget.currentPeriod.start} – {budget.currentPeriod.end}
                </p>
              </div>
              <div className="flex gap-2 text-sm">
                <button type="button" onClick={() => onEdit(budget)} className="underline">
                  Edit
                </button>
                <button type="button" onClick={() => onDelete(budget.id)} className="underline">
                  Delete
                </button>
              </div>
            </div>

            {budget.status !== null && (
              <StatusBar status={budget.status} percentageUsed={budget.percentageUsed ?? 0} />
            )}
            {budget.status !== null && (
              <p className="mt-1 text-xs text-gray-500">
                ${minorUnitsToDollars(budget.spentMinorUnits ?? 0)} of $
                {minorUnitsToDollars(budget.totalAmountMinorUnits ?? 0)}
              </p>
            )}

            {budget.categories.length > 0 && (
              <div className="mt-2 flex flex-col gap-3">
                {budget.categories.map((entry) => (
                  <div key={entry.categoryId}>
                    <p className="text-sm">{entry.categoryName}</p>
                    <StatusBar status={entry.status} percentageUsed={entry.percentageUsed} />
                    <p className="mt-1 text-xs text-gray-500">
                      ${minorUnitsToDollars(entry.spentMinorUnits)} of $
                      {minorUnitsToDollars(entry.amountMinorUnits)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </li>
        ))}
        {budgets.length === 0 && <p className="text-sm text-gray-500">No budgets yet.</p>}
      </ul>
    </main>
  );
}
