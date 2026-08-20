import { useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { Account, AnalyticsSummary, Category } from "@budget-terry/types";
import { getAnalyticsSummary, listAccounts, listCategories } from "@budget-terry/api-client";
import { apiClient } from "../lib/api-client";
import { useAuth } from "../lib/auth-context";

function minorUnitsToDollars(value: number): string {
  return (value / 100).toFixed(2);
}

function startOfCurrentMonth(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

function daysAgo(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function AnalyticsScreen() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [range, setRange] = useState<"month" | "30days">("month");
  const [accountId, setAccountId] = useState<string | undefined>(undefined);
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined);

  const from = range === "month" ? startOfCurrentMonth() : daysAgo(30);
  const to = today();

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
    listCategories(apiClient).then(setCategories);
  }, [user]);

  useEffect(() => {
    if (!user) {
      return;
    }
    getAnalyticsSummary(apiClient, { from, to, accountId, categoryId })
      .then(setSummary)
      .catch(() => setErrorMessage("Could not load analytics."));
  }, [user, from, to, accountId, categoryId]);

  const maxCategoryTotal = useMemo(
    () => Math.max(1, ...(summary?.spendingByCategory ?? []).map((entry) => entry.totalMinorUnits)),
    [summary],
  );

  if (isLoading || !user) {
    return null;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Analytics</Text>

      <View style={styles.row}>
        <Pressable
          onPress={() => setRange("month")}
          style={[styles.chip, range === "month" && styles.chipSelected]}
        >
          <Text style={range === "month" ? styles.chipTextSelected : styles.chipText}>
            This month
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setRange("30days")}
          style={[styles.chip, range === "30days" && styles.chipSelected]}
        >
          <Text style={range === "30days" ? styles.chipTextSelected : styles.chipText}>
            Last 30 days
          </Text>
        </Pressable>
      </View>

      <View style={styles.row}>
        <Pressable
          onPress={() => setAccountId(undefined)}
          style={[styles.chip, !accountId && styles.chipSelected]}
        >
          <Text style={!accountId ? styles.chipTextSelected : styles.chipText}>All accounts</Text>
        </Pressable>
        {accounts.map((account) => (
          <Pressable
            key={account.id}
            onPress={() => setAccountId(account.id)}
            style={[styles.chip, accountId === account.id && styles.chipSelected]}
          >
            <Text style={accountId === account.id ? styles.chipTextSelected : styles.chipText}>
              {account.name}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.row}>
        <Pressable
          onPress={() => setCategoryId(undefined)}
          style={[styles.chip, !categoryId && styles.chipSelected]}
        >
          <Text style={!categoryId ? styles.chipTextSelected : styles.chipText}>
            All categories
          </Text>
        </Pressable>
        {categories.slice(0, 6).map((category) => (
          <Pressable
            key={category.id}
            onPress={() => setCategoryId(category.id)}
            style={[styles.chip, categoryId === category.id && styles.chipSelected]}
          >
            <Text style={categoryId === category.id ? styles.chipTextSelected : styles.chipText}>
              {category.name}
            </Text>
          </Pressable>
        ))}
      </View>

      {errorMessage && <Text style={styles.error}>{errorMessage}</Text>}

      {summary && (
        <>
          <Text style={styles.sectionTitle}>Spending by category</Text>
          {summary.spendingByCategory.length === 0 ? (
            <Text style={styles.empty}>No spending in this range.</Text>
          ) : (
            summary.spendingByCategory.map((entry) => (
              <View key={entry.categoryId} style={styles.barItem}>
                <View style={styles.barLabelRow}>
                  <Text style={styles.barLabel}>{entry.categoryName}</Text>
                  <Text style={styles.barLabel}>${minorUnitsToDollars(entry.totalMinorUnits)}</Text>
                </View>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      { width: `${(entry.totalMinorUnits / maxCategoryTotal) * 100}%` },
                    ]}
                  />
                </View>
              </View>
            ))
          )}

          <Text style={styles.sectionTitle}>Income vs expenses</Text>
          {summary.incomeVsExpenses.length === 0 ? (
            <Text style={styles.empty}>No transactions in this range.</Text>
          ) : (
            summary.incomeVsExpenses.map((entry) => (
              <View key={entry.month} style={styles.textRow}>
                <Text style={styles.textLabel}>{entry.month}</Text>
                <Text style={styles.summaryIncome}>
                  +${minorUnitsToDollars(entry.incomeMinorUnits)}
                </Text>
                <Text style={styles.summaryExpense}>
                  -${minorUnitsToDollars(entry.expensesMinorUnits)}
                </Text>
              </View>
            ))
          )}

          <Text style={styles.sectionTitle}>Budget vs actual (current period)</Text>
          {summary.budgetVsActual.filter((budget) => budget.totalAmountMinorUnits !== null)
            .length === 0 ? (
            <Text style={styles.empty}>No overall budgets set up.</Text>
          ) : (
            summary.budgetVsActual
              .filter((budget) => budget.totalAmountMinorUnits !== null)
              .map((budget) => (
                <View key={budget.id} style={styles.barItem}>
                  <View style={styles.barLabelRow}>
                    <Text style={styles.barLabel}>{budget.name ?? `${budget.period} budget`}</Text>
                    <Text style={styles.barLabel}>{budget.percentageUsed}%</Text>
                  </View>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        { width: `${Math.min(100, budget.percentageUsed ?? 0)}%` },
                      ]}
                    />
                  </View>
                </View>
              ))
          )}

          <Text style={styles.sectionTitle}>Recurring expenses (monthly equivalent)</Text>
          {summary.recurringExpenseSummary.length === 0 ? (
            <Text style={styles.empty}>No recurring bills.</Text>
          ) : (
            summary.recurringExpenseSummary.map((entry) => (
              <View key={entry.billId} style={styles.textRow}>
                <Text style={styles.textLabel}>
                  {entry.name} ({entry.recurrence})
                </Text>
                <Text style={styles.textLabel}>
                  ${minorUnitsToDollars(entry.monthlyEquivalentMinorUnits)}/mo
                </Text>
              </View>
            ))
          )}

          <Text style={styles.sectionTitle}>Savings contributions</Text>
          <Text style={styles.textLabel}>
            ${minorUnitsToDollars(summary.savingsContributions.totalMinorUnits)} total in this range
          </Text>
          {summary.savingsContributions.byGoal.map((entry) => (
            <View key={entry.goalId} style={styles.textRow}>
              <Text style={styles.textLabel}>{entry.goalName}</Text>
              <Text style={styles.textLabel}>${minorUnitsToDollars(entry.totalMinorUnits)}</Text>
            </View>
          ))}

          <Text style={styles.sectionTitle}>Goal progress (active goals)</Text>
          <Text style={styles.textLabel}>
            ${minorUnitsToDollars(summary.goalProgress.totalSavedMinorUnits)} saved of $
            {minorUnitsToDollars(summary.goalProgress.totalTargetMinorUnits)} (
            {summary.goalProgress.overallPercentage}%)
          </Text>
          {summary.goalProgress.goals.length === 0 ? (
            <Text style={styles.empty}>No active goals.</Text>
          ) : (
            summary.goalProgress.goals.map((goal) => (
              <View key={goal.id} style={styles.barItem}>
                <View style={styles.barLabelRow}>
                  <Text style={styles.barLabel}>{goal.name}</Text>
                  <Text style={styles.barLabel}>{goal.percentageComplete}%</Text>
                </View>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      { width: `${Math.min(100, goal.percentageComplete)}%` },
                    ]}
                  />
                </View>
              </View>
            ))
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24, gap: 8 },
  title: { fontSize: 20, fontWeight: "600" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipSelected: { backgroundColor: "#111", borderColor: "#111" },
  chipText: { fontSize: 12 },
  chipTextSelected: { fontSize: 12, color: "#fff" },
  error: { color: "#b91c1c", fontSize: 13 },
  sectionTitle: { fontSize: 13, fontWeight: "600", color: "#70746F", marginTop: 12 },
  barItem: { gap: 4, marginTop: 4 },
  barLabelRow: { flexDirection: "row", justifyContent: "space-between" },
  barLabel: { fontSize: 12 },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: "#f3f4f6" },
  barFill: { height: 8, borderRadius: 4, backgroundColor: "#111" },
  textRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  textLabel: { fontSize: 13 },
  summaryIncome: { fontSize: 13, color: "#15803d" },
  summaryExpense: { fontSize: 13, color: "#b91c1c" },
  empty: { color: "#70746F", fontSize: 14 },
});
