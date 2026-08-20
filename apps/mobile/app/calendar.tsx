import { useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { CalendarEntry } from "@budget-terry/types";
import {
  getCalendarEntries,
  payBillOccurrence,
  skipBillOccurrence,
} from "@budget-terry/api-client";
import { apiClient } from "../lib/api-client";
import { useAuth } from "../lib/auth-context";

const BILL_STATUS_COLOR: Record<string, string> = {
  UPCOMING: "#9ca3af",
  DUE_SOON: "#d97706",
  DUE_TODAY: "#ea580c",
  OVERDUE: "#b91c1c",
  PAID: "#16a34a",
  SKIPPED: "#9ca3af",
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
  return entry.type === "BILL" ? entry.occurrenceId : entry.transactionId;
}

export default function CalendarScreen() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [viewDate, setViewDate] = useState(() => new Date());
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [isLoading, user, router]);

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
    for (const entry of entries) {
      const bucket = map.get(entry.date) ?? [];
      bucket.push(entry);
      map.set(entry.date, bucket);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [entries]);

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

  if (isLoading || !user) {
    return null;
  }

  const monthLabel = viewDate.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{monthLabel}</Text>
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
      {errorMessage && <Text style={styles.error}>{errorMessage}</Text>}

      <ScrollView style={styles.list}>
        {entriesByDate.length === 0 && (
          <Text style={styles.empty}>Nothing on the calendar this month.</Text>
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
                {entry.type === "BILL" ? (
                  <>
                    <View style={styles.entryInfo}>
                      <View
                        style={[
                          styles.statusDot,
                          { backgroundColor: BILL_STATUS_COLOR[entry.displayStatus] },
                        ]}
                      />
                      <Text style={styles.entryText}>
                        {entry.name} · ${minorUnitsToDollars(entry.amountMinorUnits)} ·{" "}
                        {BILL_STATUS_LABEL[entry.displayStatus] ?? entry.displayStatus}
                      </Text>
                    </View>
                    {entry.displayStatus !== "PAID" && entry.displayStatus !== "SKIPPED" && (
                      <View style={styles.entryActions}>
                        <Pressable onPress={() => onPay(entry.billId, entry.occurrenceId)}>
                          <Text style={styles.link}>Pay</Text>
                        </Pressable>
                        <Pressable onPress={() => onSkip(entry.billId, entry.occurrenceId)}>
                          <Text style={styles.link}>Skip</Text>
                        </Pressable>
                      </View>
                    )}
                  </>
                ) : (
                  <View style={styles.entryInfo}>
                    <View style={[styles.statusDot, { backgroundColor: "#16a34a" }]} />
                    <Text style={styles.entryText}>
                      {entry.merchant ?? entry.description ?? "Income"} · +$
                      {minorUnitsToDollars(entry.amountMinorUnits)}
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 8 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 20, fontWeight: "600" },
  navRow: { flexDirection: "row", gap: 16 },
  link: { textDecorationLine: "underline" },
  error: { color: "#b91c1c", fontSize: 13 },
  list: { marginTop: 8 },
  daySection: { marginBottom: 16 },
  dayHeading: { fontSize: 13, fontWeight: "600", color: "#70746F", marginBottom: 6 },
  entryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  entryInfo: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  entryText: { fontSize: 12, color: "#374151", flexShrink: 1 },
  entryActions: { flexDirection: "row", gap: 12 },
  empty: { color: "#70746F", fontSize: 14 },
});
