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

function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function endOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
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

  const rangeFrom = toIsoDate(startOfMonth(viewDate));
  const rangeTo = toIsoDate(endOfMonth(viewDate));

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
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [entries]);

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
        <ScrollView style={styles.list} scrollEnabled={false}>
          {entriesByDate.length === 0 && (
            <EmptyState message="Nothing on the calendar this month." />
          )}
          {entriesByDate.map(([date, dayEntries]) => (
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
                                {pendingKey === `skip:${entry.occurrenceId}` ? "Skipping…" : "Skip"}
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
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
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
