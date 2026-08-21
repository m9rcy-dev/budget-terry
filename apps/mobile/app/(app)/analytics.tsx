import { useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Account, AnalyticsSummary, Category } from "@budget-terry/types";
import { getAnalyticsSummary, listAccounts, listCategories } from "@budget-terry/api-client";
import { colors, radius, spacing } from "@budget-terry/ui";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { LoadingState } from "../../components/LoadingState";
import { Screen } from "../../components/Screen";
import { Section } from "../../components/Section";
import { apiClient } from "../../lib/api-client";
import { useAuth } from "../../lib/auth-context";

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
    <Screen>
      <Section>
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
      </Section>

      {errorMessage && <ErrorState message={errorMessage} />}

      {!summary ? (
        <LoadingState message="Loading analytics…" />
      ) : (
        <>
          <Section title="Spending by category">
            {summary.spendingByCategory.length === 0 ? (
              <EmptyState message="No spending in this range." />
            ) : (
              summary.spendingByCategory.map((entry) => (
                <View key={entry.categoryId} style={styles.barItem}>
                  <View style={styles.barLabelRow}>
                    <Text style={styles.barLabel}>{entry.categoryName}</Text>
                    <Text style={styles.barLabel}>
                      ${minorUnitsToDollars(entry.totalMinorUnits)}
                    </Text>
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
          </Section>

          <Section title="Income vs expenses">
            {summary.incomeVsExpenses.length === 0 ? (
              <EmptyState message="No transactions in this range." />
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
          </Section>

          <Section title="Budget vs actual (current period)">
            {summary.budgetVsActual.filter((budget) => budget.totalAmountMinorUnits !== null)
              .length === 0 ? (
              <EmptyState message="No overall budgets set up." />
            ) : (
              summary.budgetVsActual
                .filter((budget) => budget.totalAmountMinorUnits !== null)
                .map((budget) => (
                  <View key={budget.id} style={styles.barItem}>
                    <View style={styles.barLabelRow}>
                      <Text style={styles.barLabel}>
                        {budget.name ?? `${budget.period} budget`}
                      </Text>
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
          </Section>

          <Section title="Recurring expenses (monthly equivalent)">
            {summary.recurringExpenseSummary.length === 0 ? (
              <EmptyState message="No recurring bills." />
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
          </Section>

          <Section title="Savings contributions">
            <Text style={styles.textLabel}>
              ${minorUnitsToDollars(summary.savingsContributions.totalMinorUnits)} total in this
              range
            </Text>
            {summary.savingsContributions.byGoal.map((entry) => (
              <View key={entry.goalId} style={styles.textRow}>
                <Text style={styles.textLabel}>{entry.goalName}</Text>
                <Text style={styles.textLabel}>${minorUnitsToDollars(entry.totalMinorUnits)}</Text>
              </View>
            ))}
          </Section>

          <Section title="Goal progress (active goals)">
            <Text style={styles.textLabel}>
              ${minorUnitsToDollars(summary.goalProgress.totalSavedMinorUnits)} saved of $
              {minorUnitsToDollars(summary.goalProgress.totalTargetMinorUnits)} (
              {summary.goalProgress.overallPercentage}%)
            </Text>
            {summary.goalProgress.goals.length === 0 ? (
              <EmptyState message="No active goals." />
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
          </Section>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs + 4 },
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
  barItem: { gap: spacing.xs, marginTop: spacing.xs },
  barLabelRow: { flexDirection: "row", justifyContent: "space-between" },
  barLabel: { fontSize: 12, color: colors.textPrimary },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: colors.background },
  barFill: { height: 8, borderRadius: 4, backgroundColor: colors.accentPrimary },
  textRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: spacing.xs },
  textLabel: { fontSize: 13, color: colors.textPrimary },
  summaryIncome: { fontSize: 13, color: colors.financialPositive },
  summaryExpense: { fontSize: 13, color: colors.financialNegative },
});
