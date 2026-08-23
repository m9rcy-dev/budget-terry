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
import { AppShell } from "../../components/AppShell";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { Input, Select } from "../../components/Field";
import { LoadingState } from "../../components/LoadingState";
import { Section } from "../../components/Section";
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
  const [goals, setGoals] = useState<SavingsGoal[] | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [accountId, setAccountId] = useState("");

  const [contributionAmounts, setContributionAmounts] = useState<Record<string, string>>({});
  const [pendingKey, setPendingKey] = useState<string | null>(null);

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
    setPendingKey(`contribute:${goalId}`);
    try {
      await addGoalContribution(apiClient, goalId, {
        amountMinorUnits: dollarsToMinorUnits(contributionAmounts[goalId] ?? "0"),
      });
      setContributionAmounts((current) => ({ ...current, [goalId]: "" }));
      await refresh();
    } catch {
      setErrorMessage("Could not add the contribution — does this goal have an account?");
    } finally {
      setPendingKey(null);
    }
  };

  const onComplete = async (goalId: string): Promise<void> => {
    setErrorMessage(null);
    setPendingKey(`complete:${goalId}`);
    try {
      await completeGoal(apiClient, goalId);
      await refresh();
    } catch {
      setErrorMessage("Could not complete this goal. Please try again.");
    } finally {
      setPendingKey(null);
    }
  };

  const onArchiveToggle = async (goal: SavingsGoal): Promise<void> => {
    setErrorMessage(null);
    setPendingKey(`archive:${goal.id}`);
    try {
      if (goal.status === "ARCHIVED") {
        await restoreGoal(apiClient, goal.id);
      } else {
        await archiveGoal(apiClient, goal.id);
      }
      await refresh();
    } catch {
      setErrorMessage("Could not update this goal. Please try again.");
    } finally {
      setPendingKey(null);
    }
  };

  if (isLoading || !user) {
    return null;
  }

  return (
    <AppShell>
      <h1 className="text-xl font-semibold text-text-primary">Savings Goals</h1>

      <Section title="New goal">
        <form onSubmit={onCreate} className="flex flex-col gap-2">
          <Input
            aria-label="Name"
            placeholder="Name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
          <div className="flex gap-2">
            <Input
              aria-label="Target amount"
              type="number"
              step="0.01"
              placeholder="Target amount"
              value={targetAmount}
              onChange={(event) => setTargetAmount(event.target.value)}
              required
            />
            <Input
              aria-label="Target date"
              type="date"
              value={targetDate}
              onChange={(event) => setTargetDate(event.target.value)}
            />
          </div>
          <Select
            aria-label="Default account"
            value={accountId}
            onChange={(event) => setAccountId(event.target.value)}
          >
            <option value="">No default account</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </Select>
          <Button type="submit">Add goal</Button>
          {errorMessage && <ErrorState message={errorMessage} />}
        </form>
      </Section>

      <label className="flex items-center gap-2 text-sm text-text-secondary">
        <input
          type="checkbox"
          checked={showArchived}
          onChange={(event) => setShowArchived(event.target.checked)}
        />
        Show archived
      </label>

      {goals === null ? (
        <LoadingState message="Loading goals…" />
      ) : (
        <ul className="flex flex-col gap-4">
          {goals.map((goal) => {
            const percentage = Math.min(100, goal.percentageComplete);
            return (
              <li key={goal.id} className="rounded-lg border border-border bg-surface p-4">
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-text-primary">
                      {goal.name}
                      {goal.status !== "ACTIVE" ? ` — ${goal.status}` : ""}
                    </p>
                    {goal.targetDate && (
                      <p className="text-xs text-text-secondary">
                        Target date: {goal.targetDate.slice(0, 10)}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 text-sm">
                    {goal.status === "ACTIVE" && (
                      <button
                        type="button"
                        onClick={() => onComplete(goal.id)}
                        disabled={pendingKey === `complete:${goal.id}`}
                        className="text-accent-primary underline underline-offset-2 disabled:opacity-50"
                      >
                        {pendingKey === `complete:${goal.id}` ? "Completing…" : "Complete"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onArchiveToggle(goal)}
                      disabled={pendingKey === `archive:${goal.id}`}
                      className="text-text-secondary underline underline-offset-2 disabled:opacity-50"
                    >
                      {pendingKey === `archive:${goal.id}`
                        ? "Working…"
                        : goal.status === "ARCHIVED"
                          ? "Restore"
                          : "Archive"}
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-xs text-text-secondary">
                    <span className="tabular-nums">
                      ${minorUnitsToDollars(goal.savedMinorUnits)} of $
                      {minorUnitsToDollars(goal.targetAmountMinorUnits)}
                    </span>
                    <span className="tabular-nums">{goal.percentageComplete}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-background">
                    <div
                      className="h-2 rounded-full bg-accent-primary"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <p className="tabular-nums text-xs text-text-secondary">
                    ${minorUnitsToDollars(goal.remainingMinorUnits)} remaining
                    {goal.suggestedMonthlyContributionMinorUnits !== null &&
                      ` · suggested $${minorUnitsToDollars(goal.suggestedMonthlyContributionMinorUnits)}/month`}
                  </p>
                </div>

                {goal.status === "ACTIVE" && (
                  <div className="mt-3 flex gap-2">
                    <Input
                      aria-label={`Contribute to ${goal.name}`}
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
                      className="w-32 text-sm"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => onContribute(goal.id)}
                      disabled={pendingKey === `contribute:${goal.id}`}
                    >
                      {pendingKey === `contribute:${goal.id}` ? "Adding…" : "Add contribution"}
                    </Button>
                  </div>
                )}

                {goal.contributions.length > 0 && (
                  <ul className="mt-3 flex flex-col gap-1 text-xs text-text-secondary">
                    {goal.contributions.map((contribution) => (
                      <li key={contribution.id} className="tabular-nums">
                        {contribution.contributionDate.slice(0, 10)} — $
                        {minorUnitsToDollars(contribution.amountMinorUnits)}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
          {goals.length === 0 && <EmptyState message="No goals yet." />}
        </ul>
      )}
    </AppShell>
  );
}
