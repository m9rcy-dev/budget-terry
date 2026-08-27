"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  createAccount,
  createBill,
  createBudget,
  createGoal,
  listAccounts,
} from "@budget-terry/api-client";
import { Button } from "../../components/Button";
import { ErrorState } from "../../components/ErrorState";
import { Input, Select } from "../../components/Field";
import { apiClient } from "../../lib/api-client";
import { useAuth } from "../../lib/auth-context";

const ACCOUNT_TYPES = ["CHEQUE", "SAVINGS", "CREDIT_CARD", "OTHER"] as const;
const PERIODS = ["WEEKLY", "FORTNIGHTLY", "MONTHLY"] as const;
const RECURRENCES = ["ONE_OFF", "WEEKLY", "FORTNIGHTLY", "MONTHLY", "QUARTERLY", "YEARLY"] as const;

type Step = "loading" | "account" | "checklist" | "budget" | "bill" | "goal" | "finishing";

function dollarsToMinorUnits(value: string): number {
  return Math.round(Number.parseFloat(value || "0") * 100);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function OnboardingPage() {
  const { user, isLoading, completeOnboarding } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<Step>("loading");
  const [queue, setQueue] = useState<Step[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [accountName, setAccountName] = useState("");
  const [accountType, setAccountType] = useState<(typeof ACCOUNT_TYPES)[number]>("CHEQUE");

  const [wantsBudget, setWantsBudget] = useState(false);
  const [wantsBills, setWantsBills] = useState(false);
  const [wantsGoal, setWantsGoal] = useState(false);

  const [budgetPeriod, setBudgetPeriod] = useState<(typeof PERIODS)[number]>("MONTHLY");
  const [budgetAmount, setBudgetAmount] = useState("");

  const [billName, setBillName] = useState("");
  const [billAmount, setBillAmount] = useState("");
  const [billRecurrence, setBillRecurrence] = useState<(typeof RECURRENCES)[number]>("MONTHLY");

  const [goalName, setGoalName] = useState("");
  const [goalTarget, setGoalTarget] = useState("");

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [isLoading, user, router]);

  useEffect(() => {
    if (!user) {
      return;
    }
    // A user who already has an account (e.g. resuming after leaving
    // mid-flow last time) skips straight to the optional checklist.
    listAccounts(apiClient)
      .then((accounts) => setStep(accounts.length > 0 ? "checklist" : "account"))
      .catch(() => setStep("account"));
  }, [user]);

  const advance = (remaining: Step[]): void => {
    if (remaining.length === 0) {
      void finish();
      return;
    }
    const [next, ...rest] = remaining;
    setQueue(rest);
    setStep(next!);
  };

  const finish = async (): Promise<void> => {
    setStep("finishing");
    try {
      await completeOnboarding();
      router.push("/dashboard");
    } catch {
      setErrorMessage("Could not finish setup. Please try again.");
      setStep("checklist");
    }
  };

  const onCreateAccount = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setErrorMessage(null);
    try {
      await createAccount(apiClient, { name: accountName, type: accountType, currency: "NZD" });
      setStep("checklist");
    } catch {
      setErrorMessage("Could not create the account. Please try again.");
    }
  };

  const onChecklistContinue = (): void => {
    setErrorMessage(null);
    const next: Step[] = [];
    if (wantsBudget) next.push("budget");
    if (wantsBills) next.push("bill");
    if (wantsGoal) next.push("goal");
    advance(next);
  };

  const onCreateBudget = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setErrorMessage(null);
    try {
      await createBudget(apiClient, {
        period: budgetPeriod,
        anchorDate: todayIso(),
        currency: "NZD",
        totalAmountMinorUnits: dollarsToMinorUnits(budgetAmount),
      });
      advance(queue);
    } catch {
      setErrorMessage("Could not create the budget. Please try again.");
    }
  };

  const onCreateBill = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setErrorMessage(null);
    try {
      await createBill(apiClient, {
        name: billName,
        amountMinorUnits: dollarsToMinorUnits(billAmount),
        currency: "NZD",
        recurrence: billRecurrence,
        firstDueDate: todayIso(),
        autoPay: false,
      });
      advance(queue);
    } catch {
      setErrorMessage("Could not add the bill. Please try again.");
    }
  };

  const onCreateGoal = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setErrorMessage(null);
    try {
      await createGoal(apiClient, {
        name: goalName,
        targetAmountMinorUnits: dollarsToMinorUnits(goalTarget),
        currency: "NZD",
      });
      advance(queue);
    } catch {
      setErrorMessage("Could not create the goal. Please try again.");
    }
  };

  if (isLoading || !user || step === "loading" || step === "finishing") {
    return null;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-8">
      <div className="flex w-full max-w-sm flex-col gap-4">
        {step === "account" && (
          <form onSubmit={onCreateAccount} className="flex flex-col gap-4">
            <div>
              <h1 className="text-xl font-semibold text-text-primary">
                Let&apos;s set up your first account
              </h1>
              <p className="mt-1 text-sm text-text-secondary">
                Every transaction needs an account it belongs to.
              </p>
            </div>
            <Input
              aria-label="Account name"
              placeholder="e.g. Everyday Account"
              value={accountName}
              onChange={(event) => setAccountName(event.target.value)}
              required
            />
            <Select
              aria-label="Account type"
              value={accountType}
              onChange={(event) =>
                setAccountType(event.target.value as (typeof ACCOUNT_TYPES)[number])
              }
            >
              {ACCOUNT_TYPES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
            {errorMessage && <ErrorState message={errorMessage} />}
            <Button type="submit">Continue</Button>
          </form>
        )}

        {step === "checklist" && (
          <div className="flex flex-col gap-4">
            <div>
              <h1 className="text-xl font-semibold text-text-primary">
                Want to set up anything else?
              </h1>
              <p className="mt-1 text-sm text-text-secondary">You can always do this later.</p>
            </div>
            <label className="flex items-center gap-2 text-sm text-text-primary">
              <input
                type="checkbox"
                checked={wantsBudget}
                onChange={(event) => setWantsBudget(event.target.checked)}
              />
              A monthly budget
            </label>
            <label className="flex items-center gap-2 text-sm text-text-primary">
              <input
                type="checkbox"
                checked={wantsBills}
                onChange={(event) => setWantsBills(event.target.checked)}
              />
              Upcoming bills
            </label>
            <label className="flex items-center gap-2 text-sm text-text-primary">
              <input
                type="checkbox"
                checked={wantsGoal}
                onChange={(event) => setWantsGoal(event.target.checked)}
              />
              A savings goal
            </label>
            {errorMessage && <ErrorState message={errorMessage} />}
            <Button type="button" onClick={onChecklistContinue}>
              Continue
            </Button>
            <button
              type="button"
              onClick={() => void finish()}
              className="text-sm text-accent-primary underline underline-offset-2"
            >
              Skip for now
            </button>
          </div>
        )}

        {step === "budget" && (
          <form onSubmit={onCreateBudget} className="flex flex-col gap-4">
            <h1 className="text-xl font-semibold text-text-primary">Set up a budget</h1>
            <Select
              aria-label="Budget period"
              value={budgetPeriod}
              onChange={(event) => setBudgetPeriod(event.target.value as (typeof PERIODS)[number])}
            >
              {PERIODS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
            <Input
              aria-label="Total amount"
              placeholder="Total amount"
              inputMode="decimal"
              value={budgetAmount}
              onChange={(event) => setBudgetAmount(event.target.value)}
              required
            />
            {errorMessage && <ErrorState message={errorMessage} />}
            <Button type="submit">Continue</Button>
            <button
              type="button"
              onClick={() => advance(queue)}
              className="text-sm text-accent-primary underline underline-offset-2"
            >
              Skip this
            </button>
          </form>
        )}

        {step === "bill" && (
          <form onSubmit={onCreateBill} className="flex flex-col gap-4">
            <h1 className="text-xl font-semibold text-text-primary">Add an upcoming bill</h1>
            <Input
              aria-label="Bill name"
              placeholder="Bill name"
              value={billName}
              onChange={(event) => setBillName(event.target.value)}
              required
            />
            <Input
              aria-label="Amount"
              placeholder="Amount"
              inputMode="decimal"
              value={billAmount}
              onChange={(event) => setBillAmount(event.target.value)}
              required
            />
            <Select
              aria-label="Recurrence"
              value={billRecurrence}
              onChange={(event) =>
                setBillRecurrence(event.target.value as (typeof RECURRENCES)[number])
              }
            >
              {RECURRENCES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
            {errorMessage && <ErrorState message={errorMessage} />}
            <Button type="submit">Continue</Button>
            <button
              type="button"
              onClick={() => advance(queue)}
              className="text-sm text-accent-primary underline underline-offset-2"
            >
              Skip this
            </button>
          </form>
        )}

        {step === "goal" && (
          <form onSubmit={onCreateGoal} className="flex flex-col gap-4">
            <h1 className="text-xl font-semibold text-text-primary">Set up a savings goal</h1>
            <Input
              aria-label="Goal name"
              placeholder="Goal name"
              value={goalName}
              onChange={(event) => setGoalName(event.target.value)}
              required
            />
            <Input
              aria-label="Target amount"
              placeholder="Target amount"
              inputMode="decimal"
              value={goalTarget}
              onChange={(event) => setGoalTarget(event.target.value)}
              required
            />
            {errorMessage && <ErrorState message={errorMessage} />}
            <Button type="submit">Continue</Button>
            <button
              type="button"
              onClick={() => advance(queue)}
              className="text-sm text-accent-primary underline underline-offset-2"
            >
              Skip this
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
