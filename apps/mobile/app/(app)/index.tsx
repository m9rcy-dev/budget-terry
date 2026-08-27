import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { FlatList, StyleSheet, Text, View } from "react-native";
import type { DashboardSummary } from "@budget-terry/types";
import { getDashboardSummary } from "@budget-terry/api-client";
import { colors, spacing } from "@budget-terry/ui";
import { EmptyState } from "../../components/EmptyState";
import { LoadingState } from "../../components/LoadingState";
import { Screen } from "../../components/Screen";
import { Section } from "../../components/Section";
import { StatusDot } from "../../components/StatusDot";
import { apiClient } from "../../lib/api-client";
import { useAuth } from "../../lib/auth-context";

const BILL_STATUS_COLOR: Record<string, string> = {
  UPCOMING: colors.billUpcoming,
  DUE_SOON: colors.billDueSoon,
  DUE_TODAY: colors.billDueToday,
  OVERDUE: colors.billOverdue,
};

const BILL_STATUS_LABEL: Record<string, string> = {
  UPCOMING: "Upcoming",
  DUE_SOON: "Due soon",
  DUE_TODAY: "Due today",
  OVERDUE: "Overdue",
};

function minorUnitsToDollars(value: number): string {
  return (value / 100).toFixed(2);
}

export default function HomeScreen() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [isLoading, user, router]);

  useEffect(() => {
    if (!user) {
      return;
    }
    getDashboardSummary(apiClient).then(setSummary);
  }, [user]);

  if (isLoading || !user) {
    return null;
  }

  return (
    <Screen>
      <Text style={styles.subtitle}>
        Logged in as {user.displayName} ({user.email})
      </Text>

      {!summary ? (
        <LoadingState message="Loading your dashboard…" />
      ) : (
        <>
          <View style={styles.summaryRow}>
            <View style={styles.summaryLine}>
              <Text style={styles.summaryLabel}>Income</Text>
              <Text style={styles.summaryIncome}>
                ${minorUnitsToDollars(summary.incomeMinorUnits)}
              </Text>
            </View>
            <View style={styles.summaryLine}>
              <Text style={styles.summaryLabel}>Expenses</Text>
              <Text style={styles.summaryExpense}>
                ${minorUnitsToDollars(summary.expensesMinorUnits)}
              </Text>
            </View>
            <View style={styles.summaryLine}>
              <Text style={styles.summaryLabel}>Remaining</Text>
              <Text style={styles.summaryNet}>${minorUnitsToDollars(summary.netMinorUnits)}</Text>
            </View>
          </View>

          <Section title="Upcoming bills">
            <FlatList
              data={summary.upcomingBills}
              keyExtractor={(item) => item.occurrenceId}
              scrollEnabled={false}
              ListEmptyComponent={<EmptyState message="Nothing due in the next 7 days." />}
              renderItem={({ item }) => (
                <View style={styles.billRow}>
                  <View style={styles.billInfo}>
                    <Text style={styles.txnDate}>{item.name}</Text>
                    <StatusDot
                      color={BILL_STATUS_COLOR[item.displayStatus] ?? colors.textSecondary}
                      label={BILL_STATUS_LABEL[item.displayStatus] ?? item.displayStatus}
                    />
                  </View>
                  <Text style={styles.txnDate}>
                    {item.date} · ${minorUnitsToDollars(item.amountMinorUnits)}
                  </Text>
                </View>
              )}
            />
          </Section>

          <Section title="Recent transactions">
            <FlatList
              data={summary.recentTransactions}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              ListEmptyComponent={<EmptyState message="No transactions yet." />}
              renderItem={({ item }) => (
                <View style={styles.txnRow}>
                  <Text style={styles.txnDate}>{item.transactionDate.slice(0, 10)}</Text>
                  <Text
                    style={item.type === "EXPENSE" ? styles.summaryExpense : styles.summaryIncome}
                  >
                    {item.type === "EXPENSE" ? "-" : "+"}$
                    {minorUnitsToDollars(item.amountMinorUnits)}
                  </Text>
                </View>
              )}
            />
          </Section>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: { fontSize: 14, color: colors.textSecondary },
  summaryRow: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.xs + 4,
  },
  summaryLine: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm,
  },
  summaryLabel: { fontSize: 12, color: colors.textSecondary, flexShrink: 1 },
  summaryIncome: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.financialPositive,
    flexShrink: 1,
  },
  summaryExpense: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.financialNegative,
    flexShrink: 1,
  },
  summaryNet: { fontSize: 16, fontWeight: "600", color: colors.textPrimary, flexShrink: 1 },
  txnRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.xs + 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  txnDate: { color: colors.textPrimary, flexShrink: 1 },
  billRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.xs + 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  billInfo: { flexDirection: "row", alignItems: "center", gap: spacing.xs + 2, flexShrink: 1 },
});
