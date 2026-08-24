import { useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { Account, CalendarEntry } from "@budget-terry/types";
import {
  getCalendarEntries,
  listAccounts,
  payBillOccurrence,
  skipBillOccurrence,
} from "@budget-terry/api-client";
import { colors, radius, spacing } from "@budget-terry/ui";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { LoadingState } from "../../components/LoadingState";
import { Screen } from "../../components/Screen";
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

/** Monday-first 6-week grid so every month fits without a variable row count — same shape as apps/web/src/app/calendar/page.tsx's grid. */
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

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

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

export default function CalendarScreen() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [viewDate, setViewDate] = useState(() => new Date());
  const [entries, setEntries] = useState<CalendarEntry[] | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Set when a bill with no default account is paid — the entry whose row
  // should show an inline "which account?" picker instead of paying
  // immediately (see onPayPress).
  const [payingOccurrence, setPayingOccurrence] = useState<{
    billId: string;
    occurrenceId: string;
  } | null>(null);
  const [payAccountId, setPayAccountId] = useState<string | undefined>(undefined);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  // Set by tapping a day in the month grid — filters the agenda list below
  // to just that day, since scrolling a long list into view (web's
  // click-an-anchor pattern) doesn't translate well to a short mobile
  // viewport. Tap the same day again (or "Show full month") to clear it.
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
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

  useEffect(() => {
    setSelectedDate(null);
  }, [rangeFrom, rangeTo]);

  const entriesByDateMap = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    for (const entry of entries ?? []) {
      const bucket = map.get(entry.date) ?? [];
      bucket.push(entry);
      map.set(entry.date, bucket);
    }
    return map;
  }, [entries]);

  const sortedDates = useMemo(
    () => [...entriesByDateMap.entries()].sort(([a], [b]) => a.localeCompare(b)),
    [entriesByDateMap],
  );

  const visibleDates = selectedDate
    ? sortedDates.filter(([date]) => date === selectedDate)
    : sortedDates;

  const onDayCellPress = (iso: string): void => {
    setSelectedDate((current) => (current === iso ? null : iso));
  };

  // Bills without a default account need one chosen at pay-time — the API
  // accepts accountId on the pay call for exactly this (see
  // markBillOccurrencePaidSchema). Bills that already have one pay in a
  // single tap, unchanged.
  const onPayPress = (
    entryAccountId: string | null,
    billId: string,
    occurrenceId: string,
  ): void => {
    if (entryAccountId) {
      void onPay(billId, occurrenceId, entryAccountId);
    } else {
      setErrorMessage(null);
      setPayAccountId(undefined);
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

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.monthLabel}>{monthLabel}</Text>
        <View style={styles.navRow}>
          <Pressable
            onPress={() =>
              setViewDate(
                (current) =>
                  new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() - 1, 1)),
              )
            }
          >
            <Text style={styles.link}>Previous</Text>
          </Pressable>
          <Pressable
            onPress={() =>
              setViewDate(
                (current) =>
                  new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 1)),
              )
            }
          >
            <Text style={styles.link}>Next</Text>
          </Pressable>
        </View>
      </View>
      {errorMessage && <ErrorState message={errorMessage} />}

      {entries === null ? (
        <LoadingState message="Loading calendar…" />
      ) : (
        <>
          <View style={styles.weekdayRow}>
            {WEEKDAY_LABELS.map((label) => (
              <Text key={label} style={styles.weekdayLabel}>
                {label}
              </Text>
            ))}
          </View>
          <View style={styles.grid}>
            {monthGrid.map((date) => {
              const iso = toIsoDate(date);
              const dayEntries = entriesByDateMap.get(iso) ?? [];
              const isCurrentMonth = date.getUTCMonth() === currentMonth;
              const isToday = iso === today;
              const isSelected = selectedDate === iso;
              return (
                <Pressable
                  key={iso}
                  onPress={() => onDayCellPress(iso)}
                  style={[
                    styles.dayCell,
                    isToday && styles.dayCellToday,
                    isSelected && styles.dayCellSelected,
                  ]}
                >
                  <Text style={[styles.dayNumber, !isCurrentMonth && styles.dayNumberMuted]}>
                    {date.getUTCDate()}
                  </Text>
                  <View style={styles.dotsRow}>
                    {dayEntries.slice(0, 4).map((entry) => (
                      <View
                        key={entryKey(entry)}
                        style={[styles.dot, { backgroundColor: entryDotColor(entry) }]}
                      />
                    ))}
                  </View>
                </Pressable>
              );
            })}
          </View>
          {selectedDate && (
            <Pressable onPress={() => setSelectedDate(null)}>
              <Text style={styles.link}>Show full month</Text>
            </Pressable>
          )}

          <ScrollView style={styles.list} scrollEnabled={false}>
            {visibleDates.length === 0 && (
              <EmptyState
                message={
                  selectedDate
                    ? "Nothing scheduled for this day."
                    : "Nothing on the calendar this month."
                }
              />
            )}
            {visibleDates.map(([date, dayEntries]) => (
              <View key={date} style={styles.daySection}>
                <Text style={styles.dayHeading}>
                  {new Date(`${date}T00:00:00.000Z`).toLocaleDateString(undefined, {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    timeZone: "UTC",
                  })}
                </Text>
                {dayEntries.map((entry) => (
                  <View key={entryKey(entry)} style={styles.entryRow}>
                    {entry.type === "BILL" && (
                      <>
                        <View style={styles.entryInfo}>
                          <Text style={styles.entryText}>
                            {entry.name} · ${minorUnitsToDollars(entry.amountMinorUnits)}
                          </Text>
                          <StatusDot
                            color={entryDotColor(entry)}
                            label={BILL_STATUS_LABEL[entry.displayStatus] ?? entry.displayStatus}
                          />
                        </View>
                        {entry.displayStatus !== "PAID" &&
                          entry.displayStatus !== "SKIPPED" &&
                          (payingOccurrence?.occurrenceId === entry.occurrenceId ? (
                            <View style={styles.payPicker}>
                              <View style={styles.pickerRow}>
                                {accounts.map((account) => (
                                  <Pressable
                                    key={account.id}
                                    onPress={() => setPayAccountId(account.id)}
                                    style={[
                                      styles.chip,
                                      payAccountId === account.id && styles.chipSelected,
                                    ]}
                                  >
                                    <Text
                                      style={
                                        payAccountId === account.id
                                          ? styles.chipTextSelected
                                          : styles.chipText
                                      }
                                    >
                                      {account.name}
                                    </Text>
                                  </Pressable>
                                ))}
                              </View>
                              <View style={styles.entryActions}>
                                <Pressable
                                  onPress={onConfirmPay}
                                  disabled={
                                    !payAccountId || pendingKey === `pay:${entry.occurrenceId}`
                                  }
                                >
                                  <Text style={styles.link}>
                                    {pendingKey === `pay:${entry.occurrenceId}`
                                      ? "Paying…"
                                      : "Confirm"}
                                  </Text>
                                </Pressable>
                                <Pressable onPress={() => setPayingOccurrence(null)}>
                                  <Text style={styles.linkMuted}>Cancel</Text>
                                </Pressable>
                              </View>
                            </View>
                          ) : (
                            <View style={styles.entryActions}>
                              <Pressable
                                onPress={() =>
                                  onPayPress(entry.accountId, entry.billId, entry.occurrenceId)
                                }
                                disabled={pendingKey === `pay:${entry.occurrenceId}`}
                              >
                                <Text style={styles.link}>
                                  {pendingKey === `pay:${entry.occurrenceId}` ? "Paying…" : "Pay"}
                                </Text>
                              </Pressable>
                              <Pressable
                                onPress={() => onSkip(entry.billId, entry.occurrenceId)}
                                disabled={pendingKey === `skip:${entry.occurrenceId}`}
                              >
                                <Text style={styles.linkMuted}>
                                  {pendingKey === `skip:${entry.occurrenceId}`
                                    ? "Skipping…"
                                    : "Skip"}
                                </Text>
                              </Pressable>
                            </View>
                          ))}
                      </>
                    )}
                    {entry.type === "INCOME" && (
                      <View style={styles.entryInfo}>
                        <StatusDot color={entryDotColor(entry)} label="Income" />
                        <Text style={styles.entryText}>
                          {entry.merchant ?? entry.description ?? "Income"} · +$
                          {minorUnitsToDollars(entry.amountMinorUnits)}
                        </Text>
                      </View>
                    )}
                    {entry.type === "SAVINGS_CONTRIBUTION" && (
                      <View style={styles.entryInfo}>
                        <StatusDot color={entryDotColor(entry)} label="Savings contribution" />
                        <Text style={styles.entryText}>
                          {entry.goalName} · ${minorUnitsToDollars(entry.amountMinorUnits)}
                        </Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            ))}
          </ScrollView>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  weekdayRow: { flexDirection: "row", marginTop: spacing.sm },
  weekdayLabel: {
    width: `${100 / 7}%`,
    textAlign: "center",
    fontSize: 11,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  dayCell: {
    width: `${100 / 7}%`,
    minHeight: 44,
    paddingVertical: spacing.xs,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "transparent",
    borderRadius: radius.sm,
  },
  dayCellToday: { borderColor: colors.accentPrimary },
  dayCellSelected: { backgroundColor: colors.surface },
  dayNumber: { fontSize: 12, color: colors.textPrimary },
  dayNumberMuted: { color: colors.textSecondary },
  dotsRow: { flexDirection: "row", gap: 2, marginTop: 3, minHeight: 6 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  monthLabel: { fontSize: 16, fontWeight: "600", color: colors.textPrimary },
  navRow: { flexDirection: "row", gap: spacing.md },
  link: { textDecorationLine: "underline", color: colors.accentPrimary },
  linkMuted: { textDecorationLine: "underline", color: colors.textSecondary },
  list: { marginTop: spacing.xs },
  daySection: { marginBottom: spacing.md },
  dayHeading: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
    marginBottom: spacing.xs + 2,
  },
  entryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.xs + 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  entryInfo: { flexDirection: "row", alignItems: "center", gap: spacing.xs + 2, flexShrink: 1 },
  entryText: { fontSize: 12, color: colors.textPrimary, flexShrink: 1 },
  entryActions: { flexDirection: "row", gap: spacing.sm + 4 },
  payPicker: { gap: spacing.xs + 2, alignItems: "flex-end" },
  pickerRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs + 4 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xs,
  },
  chipSelected: { backgroundColor: colors.accentPrimary, borderColor: colors.accentPrimary },
  chipText: { fontSize: 12, color: colors.textPrimary },
  chipTextSelected: { fontSize: 12, color: "#FFFFFF" },
});
