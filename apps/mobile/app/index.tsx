import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { FlatList, StyleSheet, Text, View } from "react-native";
import type { DashboardSummary } from "@budget-terry/types";
import { getDashboardSummary } from "@budget-terry/api-client";
import { colors, spacing } from "@budget-terry/ui";
import { EmptyState } from "../components/EmptyState";
import { LoadingState } from "../components/LoadingState";
import { Screen } from "../components/Screen";
import { Section } from "../components/Section";
import { apiClient } from "../lib/api-client";
import { useAuth } from "../lib/auth-context";

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
    <Screen title="Budget Terry">
      <Text style={styles.subtitle}>
        Logged in as {user.displayName} ({user.email})
      </Text>

      {!summary ? (
        <LoadingState message="Loading your dashboard…" />
      ) : (
        <>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Income</Text>
              <Text style={styles.summaryIncome}>
                ${minorUnitsToDollars(summary.incomeMinorUnits)}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Expenses</Text>
              <Text style={styles.summaryExpense}>
                ${minorUnitsToDollars(summary.expensesMinorUnits)}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Remaining</Text>
              <Text style={styles.summaryNet}>${minorUnitsToDollars(summary.netMinorUnits)}</Text>
            </View>
          </View>

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
    flexDirection: "row",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
  },
  summaryItem: { alignItems: "center" },
  summaryLabel: { fontSize: 12, color: colors.textSecondary },
  summaryIncome: { fontSize: 16, fontWeight: "600", color: colors.financialPositive },
  summaryExpense: { fontSize: 16, fontWeight: "600", color: colors.financialNegative },
  summaryNet: { fontSize: 16, fontWeight: "600", color: colors.textPrimary },
  txnRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.xs + 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  txnDate: { color: colors.textPrimary },
});
