"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Account, CalendarEntry } from "@budget-terry/types";
import {
  getCalendarEntries,
  listAccounts,
  payBillOccurrence,
  skipBillOccurrence,
} from "@budget-terry/api-client";
import { colors } from "@budget-terry/ui";
import { AppShell } from "../../components/AppShell";
import { Button } from "../../components/Button";
import { ErrorState } from "../../components/ErrorState";
import { Select } from "../../components/Field";
import { LoadingState } from "../../components/LoadingState";
import { StatusDot } from "../../components/StatusDot";
import { apiClient } from "../../lib/api-client";
import { useAuth } from "../../lib/auth-context";

const BILL_STATUS_COLOR: Record<string, string> = {
  UPCOMING: colors.billUpcoming,
  DUE_SOON: colors.billDueSoon,
  DUE_TODAY: colors.billDueToday,
  OVERDUE: colors.billOverdue,
  PAID: colors.billPaid,
  SKIPPED: colors.billSkipped,
};

const BILL_STATUS_LABEL: Record<string, string> = {
  UPCOMING: "Upcoming",
  DUE_SOON: "Due soon",
  DUE_TODAY: "Due today",
  OVERDUE: "Overdue",
  PAID: "Paid",
  SKIPPED: "Skipped",
};

function minorUnitsToDollars(value: number): string {
  return (value / 100).toFixed(2);
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function entryKey(entry: CalendarEntry): string {
  if (entry.type === "BILL") return entry.occurrenceId;
  if (entry.type === "INCOME") return entry.transactionId;
  return entry.contributionId;
}

function entryDotColor(entry: CalendarEntry): string {
  if (entry.type === "BILL") return BILL_STATUS_COLOR[entry.displayStatus] ?? colors.textSecondary;
  if (entry.type === "INCOME") return colors.financialPositive;
  return colors.accentSecondary;
}

/** Monday-first 6-week grid so every month fits without a variable row count. */
function buildMonthGrid(year: number, month: number): Date[] {
  const firstOfMonth = new Date(Date.UTC(year, month, 1));
  const firstWeekday = (firstOfMonth.getUTCDay() + 6) % 7; // 0 = Monday
  const gridStart = new Date(firstOfMonth);
  gridStart.setUTCDate(gridStart.getUTCDate() - firstWeekday);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setUTCDate(date.getUTCDate() + index);
    return date;
  });
}

export default function CalendarPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [viewDate, setViewDate] = useState(() => new Date());
  const [entries, setEntries] = useState<CalendarEntry[] | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Set when a bill with no default account is paid — the entry whose row
  // should show an inline "which account?" picker instead of paying
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

  useEffect(() => {
    if (!user) {
      return;
    }
    listAccounts(apiClient).then(setAccounts);
  }, [user]);

  const monthGrid = useMemo(
    () => buildMonthGrid(viewDate.getUTCFullYear(), viewDate.getUTCMonth()),
    [viewDate],
  );
  const rangeFrom = toIsoDate(monthGrid[0]!);
  const rangeTo = toIsoDate(monthGrid[monthGrid.length - 1]!);

  const refresh = async (): Promise<void> => {
    setEntries(await getCalendarEntries(apiClient, rangeFrom, rangeTo));
  };

  useEffect(() => {
    if (!user) {
      return;
    }
    refresh().catch(() => setErrorMessage("Could not load the calendar."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, rangeFrom, rangeTo]);

  const entriesByDate = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    for (const entry of entries ?? []) {
      const bucket = map.get(entry.date) ?? [];
      bucket.push(entry);
      map.set(entry.date, bucket);
    }
    return map;
  }, [entries]);

  // Bills without a default account need one chosen at pay-time — the API
  // accepts accountId on the pay call for exactly this (see
  // markBillOccurrencePaidSchema). Bills that already have one pay in a
  // single click, unchanged.
  const onPayClick = (
    entryAccountId: string | null,
    billId: string,
    occurrenceId: string,
  ): void => {
    if (entryAccountId) {
      void onPay(billId, occurrenceId, entryAccountId);
    } else {
      setErrorMessage(null);
      setPayAccountId("");
      setPayingOccurrence({ billId, occurrenceId });
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

  if (isLoading || !user) {
    return null;
  }

  const monthLabel = viewDate.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const today = toIsoDate(new Date());
  const currentMonth = viewDate.getUTCMonth();

  const agendaDates = [...entriesByDate.keys()].sort();

  return (
    <AppShell>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-text-primary">{monthLabel}</h1>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              setViewDate(
                (current) =>
                  new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() - 1, 1)),
              )
            }
          >
            Previous
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              setViewDate(
                (current) =>
                  new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 1)),
              )
            }
          >
            Next
          </Button>
        </div>
      </div>
      {errorMessage && <ErrorState message={errorMessage} />}

      {entries === null ? (
        <LoadingState message="Loading calendar…" />
      ) : (
        <>
          <div className="grid grid-cols-7 gap-1 text-center text-xs">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label) => (
              <div key={label} className="font-medium text-text-secondary">
                {label}
              </div>
            ))}
            {monthGrid.map((date) => {
              const iso = toIsoDate(date);
              const dayEntries = entriesByDate.get(iso) ?? [];
              const isCurrentMonth = date.getUTCMonth() === currentMonth;
              return (
                <a
                  key={iso}
                  href={`#day-${iso}`}
                  className={`flex min-h-16 flex-col gap-1 rounded-md border p-1 ${
                    isCurrentMonth
                      ? "bg-surface text-text-primary"
                      : "bg-background text-text-secondary"
                  } ${iso === today ? "border-accent-primary" : "border-border"}`}
                >
                  <span>{date.getUTCDate()}</span>
                  <div className="flex flex-wrap justify-center gap-1">
                    {dayEntries.slice(0, 4).map((entry) => (
                      <span
                        key={entryKey(entry)}
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: entryDotColor(entry) }}
                      />
                    ))}
                  </div>
                </a>
              );
            })}
          </div>

          <div className="flex flex-col gap-4">
            {agendaDates.length === 0 && (
              <p className="text-sm text-text-secondary">Nothing on the calendar this month.</p>
            )}
            {agendaDates.map((date) => (
              <section key={date} id={`day-${date}`}>
                <h2 className="mb-1 text-sm font-medium text-text-primary">
                  {new Date(`${date}T00:00:00.000Z`).toLocaleDateString(undefined, {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    timeZone: "UTC",
                  })}
                </h2>
                <ul className="flex flex-col gap-1">
                  {entriesByDate.get(date)!.map((entry) => (
                    <li
                      key={entryKey(entry)}
                      className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary"
                    >
                      {entry.type === "BILL" && (
                        <>
                          <div className="flex items-center gap-2">
                            <span>{entry.name}</span>
                            <StatusDot
                              color={entryDotColor(entry)}
                              label={BILL_STATUS_LABEL[entry.displayStatus] ?? entry.displayStatus}
                            />
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="tabular-nums">
                              ${minorUnitsToDollars(entry.amountMinorUnits)}
                            </span>
                            {entry.displayStatus !== "PAID" &&
                              entry.displayStatus !== "SKIPPED" &&
                              (payingOccurrence?.occurrenceId === entry.occurrenceId ? (
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
                                    disabled={
                                      !payAccountId || pendingKey === `pay:${entry.occurrenceId}`
                                    }
                                    className="text-accent-primary underline underline-offset-2 disabled:opacity-50"
                                  >
                                    {pendingKey === `pay:${entry.occurrenceId}`
                                      ? "Paying…"
                                      : "Confirm"}
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
                                    onClick={() =>
                                      onPayClick(entry.accountId, entry.billId, entry.occurrenceId)
                                    }
                                    disabled={pendingKey === `pay:${entry.occurrenceId}`}
                                    className="text-accent-primary underline underline-offset-2 disabled:opacity-50"
                                  >
                                    {pendingKey === `pay:${entry.occurrenceId}` ? "Paying…" : "Pay"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onSkip(entry.billId, entry.occurrenceId)}
                                    disabled={pendingKey === `skip:${entry.occurrenceId}`}
                                    className="text-text-secondary underline underline-offset-2 disabled:opacity-50"
                                  >
                                    {pendingKey === `skip:${entry.occurrenceId}`
                                      ? "Skipping…"
                                      : "Skip"}
                                  </button>
                                </div>
                              ))}
                          </div>
                        </>
                      )}
                      {entry.type === "INCOME" && (
                        <>
                          <div className="flex items-center gap-2">
                            <StatusDot color={entryDotColor(entry)} label="Income" />
                            <span>{entry.merchant ?? entry.description ?? "Income"}</span>
                          </div>
                          <span className="tabular-nums text-financial-positive">
                            +${minorUnitsToDollars(entry.amountMinorUnits)}
                          </span>
                        </>
                      )}
                      {entry.type === "SAVINGS_CONTRIBUTION" && (
                        <>
                          <div className="flex items-center gap-2">
                            <StatusDot color={entryDotColor(entry)} label="Savings contribution" />
                            <span>{entry.goalName}</span>
                          </div>
                          <span className="tabular-nums">
                            ${minorUnitsToDollars(entry.amountMinorUnits)}
                          </span>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}
    </AppShell>
  );
}
