"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Account, Bill, Category } from "@budget-terry/types";
import {
  archiveBill,
  createBill,
  listAccounts,
  listBills,
  listCategories,
  payBillOccurrence,
  restoreBill,
  skipBillOccurrence,
} from "@budget-terry/api-client";
import { apiClient } from "../../lib/api-client";
import { useAuth } from "../../lib/auth-context";

const RECURRENCES = ["ONE_OFF", "WEEKLY", "FORTNIGHTLY", "MONTHLY", "QUARTERLY", "YEARLY"] as const;

function dollarsToMinorUnits(value: string): number {
  return Math.round(Number.parseFloat(value || "0") * 100);
}

function minorUnitsToDollars(value: number): string {
  return (value / 100).toFixed(2);
}

const STATUS_COLOR: Record<string, string> = {
  UPCOMING: "bg-gray-400",
  DUE_SOON: "bg-amber-500",
  DUE_TODAY: "bg-orange-600",
  OVERDUE: "bg-red-600",
  PAID: "bg-green-600",
  SKIPPED: "bg-gray-400",
};

const STATUS_LABEL: Record<string, string> = {
  UPCOMING: "Upcoming",
  DUE_SOON: "Due soon",
  DUE_TODAY: "Due today",
  OVERDUE: "Overdue",
  PAID: "Paid",
  SKIPPED: "Skipped",
};

export default function BillsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [bills, setBills] = useState<Bill[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [recurrence, setRecurrence] = useState<(typeof RECURRENCES)[number]>("MONTHLY");
  const [firstDueDate, setFirstDueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [categoryId, setCategoryId] = useState("");
  const [accountId, setAccountId] = useState("");

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [isLoading, user, router]);

  const refresh = async (): Promise<void> => {
    setBills(await listBills(apiClient, { includeArchived: showArchived }));
  };

  useEffect(() => {
    if (!user) {
      return;
    }
    refresh().catch(() => setErrorMessage("Could not load bills."));
    listCategories(apiClient).then(setCategories);
    listAccounts(apiClient).then(setAccounts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, showArchived]);

  const onCreate = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setErrorMessage(null);
    try {
      await createBill(apiClient, {
        name,
        amountMinorUnits: dollarsToMinorUnits(amount),
        currency: "NZD",
        recurrence,
        firstDueDate,
        categoryId: categoryId || undefined,
        accountId: accountId || undefined,
        autoPay: false,
      });
      setName("");
      setAmount("");
      setCategoryId("");
      setAccountId("");
      await refresh();
    } catch {
      setErrorMessage("Could not create the bill.");
    }
  };

  const onPay = async (billId: string, occurrenceId: string): Promise<void> => {
    setErrorMessage(null);
    try {
      await payBillOccurrence(apiClient, billId, occurrenceId);
      await refresh();
    } catch {
      setErrorMessage("Could not mark this occurrence paid — does the bill have an account?");
    }
  };

  const onSkip = async (billId: string, occurrenceId: string): Promise<void> => {
    await skipBillOccurrence(apiClient, billId, occurrenceId);
    await refresh();
  };

  const onArchiveToggle = async (bill: Bill): Promise<void> => {
    if (bill.isArchived) {
      await restoreBill(apiClient, bill.id);
    } else {
      await archiveBill(apiClient, bill.id);
    }
    await refresh();
  };

  if (isLoading || !user) {
    return null;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-8">
      <h1 className="text-xl font-semibold">Bills</h1>

      <form onSubmit={onCreate} className="flex flex-col gap-2 rounded border p-4">
        <p className="text-sm font-medium">New bill</p>
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
            placeholder="Amount"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="rounded border px-3 py-2"
            required
          />
          <select
            value={recurrence}
            onChange={(event) => setRecurrence(event.target.value as (typeof RECURRENCES)[number])}
            className="rounded border px-3 py-2"
          >
            {RECURRENCES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={firstDueDate}
            onChange={(event) => setFirstDueDate(event.target.value)}
            className="rounded border px-3 py-2"
            required
          />
        </div>
        <div className="flex gap-2">
          <select
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            className="rounded border px-3 py-2"
          >
            <option value="">No category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
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
        </div>
        <button type="submit" className="rounded bg-black px-3 py-2 text-white">
          Add bill
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
        {bills.map((bill) => (
          <li key={bill.id} className="rounded border p-4">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <p className="font-medium">
                  {bill.name}
                  {bill.isArchived ? " — Archived" : ""}
                </p>
                <p className="text-xs text-gray-500">
                  {bill.recurrence} · ${minorUnitsToDollars(bill.amountMinorUnits)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onArchiveToggle(bill)}
                className="text-sm underline"
              >
                {bill.isArchived ? "Restore" : "Archive"}
              </button>
            </div>

            <ul className="flex flex-col gap-2">
              {bill.occurrences.map((occurrence) => (
                <li key={occurrence.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 rounded-full ${STATUS_COLOR[occurrence.displayStatus]}`}
                    />
                    <span>{occurrence.dueDate.slice(0, 10)}</span>
                    <span>${minorUnitsToDollars(occurrence.amountMinorUnits)}</span>
                    <span className="text-xs text-gray-500">
                      {STATUS_LABEL[occurrence.displayStatus] ?? occurrence.displayStatus}
                    </span>
                  </div>
                  {occurrence.paymentStatus === "PENDING" && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => onPay(bill.id, occurrence.id)}
                        className="underline"
                      >
                        Pay
                      </button>
                      <button
                        type="button"
                        onClick={() => onSkip(bill.id, occurrence.id)}
                        className="underline"
                      >
                        Skip
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </li>
        ))}
        {bills.length === 0 && <p className="text-sm text-gray-500">No bills yet.</p>}
      </ul>
    </main>
  );
}
