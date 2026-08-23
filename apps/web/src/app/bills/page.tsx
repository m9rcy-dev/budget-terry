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
import { colors } from "@budget-terry/ui";
import { AppShell } from "../../components/AppShell";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { Input, Select } from "../../components/Field";
import { LoadingState } from "../../components/LoadingState";
import { Section } from "../../components/Section";
import { StatusDot } from "../../components/StatusDot";
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
  UPCOMING: colors.billUpcoming,
  DUE_SOON: colors.billDueSoon,
  DUE_TODAY: colors.billDueToday,
  OVERDUE: colors.billOverdue,
  PAID: colors.billPaid,
  SKIPPED: colors.billSkipped,
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
  const [bills, setBills] = useState<Bill[] | null>(null);
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

  // Set when a bill with no default account is paid — the occurrence whose
  // row should show an inline "which account?" picker instead of paying
  // immediately (see onPayClick).
  const [payingOccurrence, setPayingOccurrence] = useState<{
    billId: string;
    occurrenceId: string;
  } | null>(null);
  const [payAccountId, setPayAccountId] = useState("");
  const [pendingKey, setPendingKey] = useState<string | null>(null);

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

  // Bills without a default account need one chosen at pay-time — the API
  // accepts accountId on the pay call for exactly this (see
  // markBillOccurrencePaidSchema). Bills that already have one pay in a
  // single click, unchanged.
  const onPayClick = (bill: Bill, occurrenceId: string): void => {
    if (bill.accountId) {
      void onPay(bill.id, occurrenceId, bill.accountId);
    } else {
      setErrorMessage(null);
      setPayAccountId("");
      setPayingOccurrence({ billId: bill.id, occurrenceId });
    }
  };

  const onPay = async (billId: string, occurrenceId: string, accountId: string): Promise<void> => {
    setErrorMessage(null);
    setPendingKey(`pay:${occurrenceId}`);
    try {
      await payBillOccurrence(apiClient, billId, occurrenceId, { accountId });
      setPayingOccurrence(null);
      await refresh();
    } catch {
      setErrorMessage("Could not mark this occurrence as paid. Please try again.");
    } finally {
      setPendingKey(null);
    }
  };

  const onConfirmPay = (): void => {
    if (!payingOccurrence || !payAccountId) {
      return;
    }
    void onPay(payingOccurrence.billId, payingOccurrence.occurrenceId, payAccountId);
  };

  const onSkip = async (billId: string, occurrenceId: string): Promise<void> => {
    setErrorMessage(null);
    setPendingKey(`skip:${occurrenceId}`);
    try {
      await skipBillOccurrence(apiClient, billId, occurrenceId);
      await refresh();
    } catch {
      setErrorMessage("Could not skip this occurrence. Please try again.");
    } finally {
      setPendingKey(null);
    }
  };

  const onArchiveToggle = async (bill: Bill): Promise<void> => {
    setErrorMessage(null);
    setPendingKey(`archive:${bill.id}`);
    try {
      if (bill.isArchived) {
        await restoreBill(apiClient, bill.id);
      } else {
        await archiveBill(apiClient, bill.id);
      }
      await refresh();
    } catch {
      setErrorMessage("Could not update this bill. Please try again.");
    } finally {
      setPendingKey(null);
    }
  };

  if (isLoading || !user) {
    return null;
  }

  return (
    <AppShell>
      <h1 className="text-xl font-semibold text-text-primary">Bills</h1>

      <Section title="New bill">
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
              aria-label="Amount"
              type="number"
              step="0.01"
              placeholder="Amount"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              required
            />
            <Select
              aria-label="Recurrence"
              value={recurrence}
              onChange={(event) =>
                setRecurrence(event.target.value as (typeof RECURRENCES)[number])
              }
            >
              {RECURRENCES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
            <Input
              aria-label="First due date"
              type="date"
              value={firstDueDate}
              onChange={(event) => setFirstDueDate(event.target.value)}
              required
            />
          </div>
          <div className="flex gap-2">
            <Select
              aria-label="Category"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
            >
              <option value="">No category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
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
          </div>
          <Button type="submit">Add bill</Button>
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

      {bills === null ? (
        <LoadingState message="Loading bills…" />
      ) : (
        <ul className="flex flex-col gap-4">
          {bills.map((bill) => (
            <li key={bill.id} className="rounded-lg border border-border bg-surface p-4">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <p className="font-medium text-text-primary">
                    {bill.name}
                    {bill.isArchived ? " — Archived" : ""}
                  </p>
                  <p className="tabular-nums text-xs text-text-secondary">
                    {bill.recurrence} · ${minorUnitsToDollars(bill.amountMinorUnits)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onArchiveToggle(bill)}
                  disabled={pendingKey === `archive:${bill.id}`}
                  className="text-sm text-accent-primary underline underline-offset-2 disabled:opacity-50"
                >
                  {pendingKey === `archive:${bill.id}`
                    ? "Working…"
                    : bill.isArchived
                      ? "Restore"
                      : "Archive"}
                </button>
              </div>

              <ul className="flex flex-col gap-2">
                {bill.occurrences.map((occurrence) => (
                  <li
                    key={occurrence.id}
                    className="flex items-center justify-between text-sm text-text-primary"
                  >
                    <div className="flex items-center gap-2">
                      <span>{occurrence.dueDate.slice(0, 10)}</span>
                      <span className="tabular-nums">
                        ${minorUnitsToDollars(occurrence.amountMinorUnits)}
                      </span>
                      <StatusDot
                        color={STATUS_COLOR[occurrence.displayStatus] ?? colors.textSecondary}
                        label={STATUS_LABEL[occurrence.displayStatus] ?? occurrence.displayStatus}
                      />
                    </div>
                    {occurrence.paymentStatus === "PENDING" &&
                      (payingOccurrence?.occurrenceId === occurrence.id ? (
                        <div className="flex items-center gap-2">
                          <Select
                            aria-label="Account to pay from"
                            value={payAccountId}
                            onChange={(event) => setPayAccountId(event.target.value)}
                          >
                            <option value="">Pay from…</option>
                            {accounts.map((account) => (
                              <option key={account.id} value={account.id}>
                                {account.name}
                              </option>
                            ))}
                          </Select>
                          <button
                            type="button"
                            onClick={onConfirmPay}
                            disabled={!payAccountId || pendingKey === `pay:${occurrence.id}`}
                            className="text-accent-primary underline underline-offset-2 disabled:opacity-50"
                          >
                            {pendingKey === `pay:${occurrence.id}` ? "Paying…" : "Confirm"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setPayingOccurrence(null)}
                            className="text-text-secondary underline underline-offset-2"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => onPayClick(bill, occurrence.id)}
                            disabled={pendingKey === `pay:${occurrence.id}`}
                            className="text-accent-primary underline underline-offset-2 disabled:opacity-50"
                          >
                            {pendingKey === `pay:${occurrence.id}` ? "Paying…" : "Pay"}
                          </button>
                          <button
                            type="button"
                            onClick={() => onSkip(bill.id, occurrence.id)}
                            disabled={pendingKey === `skip:${occurrence.id}`}
                            className="text-text-secondary underline underline-offset-2 disabled:opacity-50"
                          >
                            {pendingKey === `skip:${occurrence.id}` ? "Skipping…" : "Skip"}
                          </button>
                        </div>
                      ))}
                  </li>
                ))}
              </ul>
            </li>
          ))}
          {bills.length === 0 && <EmptyState message="No bills yet." />}
        </ul>
      )}
    </AppShell>
  );
}
