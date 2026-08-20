"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Account, SavingsGoal } from "@budget-terry/types";
import {
  addGoalContribution,
  archiveGoal,
  completeGoal,
  createGoal,
  listAccounts,
  listGoals,
  restoreGoal,
} from "@budget-terry/api-client";
import { apiClient } from "../../lib/api-client";
import { useAuth } from "../../lib/auth-context";

function dollarsToMinorUnits(value: string): number {
  return Math.round(Number.parseFloat(value || "0") * 100);
}

function minorUnitsToDollars(value: number): string {
  return (value / 100).toFixed(2);
}

export default function GoalsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [accountId, setAccountId] = useState("");

  const [contributionAmounts, setContributionAmounts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [isLoading, user, router]);

  const refresh = async (): Promise<void> => {
    setGoals(await listGoals(apiClient, { includeArchived: showArchived }));
  };

  useEffect(() => {
    if (!user) {
      return;
    }
    refresh().catch(() => setErrorMessage("Could not load goals."));
    listAccounts(apiClient).then(setAccounts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, showArchived]);

  const onCreate = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setErrorMessage(null);
    try {
      await createGoal(apiClient, {
        name,
        targetAmountMinorUnits: dollarsToMinorUnits(targetAmount),
        currency: "NZD",
        targetDate: targetDate || undefined,
        accountId: accountId || undefined,
      });
      setName("");
      setTargetAmount("");
      setTargetDate("");
      setAccountId("");
      await refresh();
    } catch {
      setErrorMessage("Could not create the goal.");
    }
  };

  const onContribute = async (goalId: string): Promise<void> => {
    setErrorMessage(null);
    try {
      await addGoalContribution(apiClient, goalId, {
        amountMinorUnits: dollarsToMinorUnits(contributionAmounts[goalId] ?? "0"),
      });
      setContributionAmounts((current) => ({ ...current, [goalId]: "" }));
      await refresh();
    } catch {
      setErrorMessage("Could not add the contribution — does this goal have an account?");
    }
  };

  const onComplete = async (goalId: string): Promise<void> => {
    await completeGoal(apiClient, goalId);
    await refresh();
  };

  const onArchiveToggle = async (goal: SavingsGoal): Promise<void> => {
    if (goal.status === "ARCHIVED") {
      await restoreGoal(apiClient, goal.id);
    } else {
      await archiveGoal(apiClient, goal.id);
    }
    await refresh();
  };

  if (isLoading || !user) {
    return null;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-8">
      <h1 className="text-xl font-semibold">Savings Goals</h1>

      <form onSubmit={onCreate} className="flex flex-col gap-2 rounded border p-4">
        <p className="text-sm font-medium">New goal</p>
        <input
          placeholder="Name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="rounded border px-3 py-2"
          required
        />
        <div className="flex gap-2">
          <input
            type="number"
            step="0.01"
            placeholder="Target amount"
            value={targetAmount}
            onChange={(event) => setTargetAmount(event.target.value)}
            className="rounded border px-3 py-2"
            required
          />
          <input
            type="date"
            value={targetDate}
            onChange={(event) => setTargetDate(event.target.value)}
            className="rounded border px-3 py-2"
          />
        </div>
        <select
          value={accountId}
          onChange={(event) => setAccountId(event.target.value)}
          className="rounded border px-3 py-2"
        >
          <option value="">No default account</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded bg-black px-3 py-2 text-white">
          Add goal
        </button>
        {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
      </form>

      <div className="flex items-center gap-2 text-sm">
        <input
          id="show-archived"
          type="checkbox"
          checked={showArchived}
          onChange={(event) => setShowArchived(event.target.checked)}
        />
        <label htmlFor="show-archived">Show archived</label>
      </div>

      <ul className="flex flex-col gap-4">
        {goals.map((goal) => {
          const percentage = Math.min(100, goal.percentageComplete);
          return (
            <li key={goal.id} className="rounded border p-4">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <p className="font-medium">
                    {goal.name}
                    {goal.status !== "ACTIVE" ? ` — ${goal.status}` : ""}
                  </p>
                  {goal.targetDate && (
                    <p className="text-xs text-gray-500">
                      Target date: {goal.targetDate.slice(0, 10)}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 text-sm">
                  {goal.status === "ACTIVE" && (
                    <button type="button" onClick={() => onComplete(goal.id)} className="underline">
                      Complete
                    </button>
                  )}
                  <button type="button" onClick={() => onArchiveToggle(goal)} className="underline">
                    {goal.status === "ARCHIVED" ? "Restore" : "Archive"}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-xs">
                  <span>
                    ${minorUnitsToDollars(goal.savedMinorUnits)} of $
                    {minorUnitsToDollars(goal.targetAmountMinorUnits)}
                  </span>
                  <span>{goal.percentageComplete}%</span>
                </div>
                <div className="h-2 rounded bg-gray-100">
                  <div className="h-2 rounded bg-black" style={{ width: `${percentage}%` }} />
                </div>
                <p className="text-xs text-gray-500">
                  ${minorUnitsToDollars(goal.remainingMinorUnits)} remaining
                  {goal.suggestedMonthlyContributionMinorUnits !== null &&
                    ` · suggested $${minorUnitsToDollars(goal.suggestedMonthlyContributionMinorUnits)}/month`}
                </p>
              </div>

              {goal.status === "ACTIVE" && (
                <div className="mt-3 flex gap-2">
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Contribute"
                    value={contributionAmounts[goal.id] ?? ""}
                    onChange={(event) =>
                      setContributionAmounts((current) => ({
                        ...current,
                        [goal.id]: event.target.value,
                      }))
                    }
                    className="w-32 rounded border px-2 py-1 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => onContribute(goal.id)}
                    className="rounded border px-3 py-1 text-sm"
                  >
                    Add contribution
                  </button>
                </div>
              )}

              {goal.contributions.length > 0 && (
                <ul className="mt-3 flex flex-col gap-1 text-xs text-gray-500">
                  {goal.contributions.map((contribution) => (
                    <li key={contribution.id}>
                      {contribution.contributionDate.slice(0, 10)} — $
                      {minorUnitsToDollars(contribution.amountMinorUnits)}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
        {goals.length === 0 && <p className="text-sm text-gray-500">No goals yet.</p>}
      </ul>
    </main>
  );
}
