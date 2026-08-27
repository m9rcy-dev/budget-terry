import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import type { Budget, Category } from "@budget-terry/types";
import { createBudget, deleteBudget, listBudgets, listCategories } from "@budget-terry/api-client";
import { colors, radius, spacing } from "@budget-terry/ui";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { ListLoadError } from "../../components/ListLoadError";
import { LoadingState } from "../../components/LoadingState";
import { Screen } from "../../components/Screen";
import { Section } from "../../components/Section";
import { TextField } from "../../components/TextField";
import { apiClient } from "../../lib/api-client";
import { useAuth } from "../../lib/auth-context";

const PERIODS = ["WEEKLY", "FORTNIGHTLY", "MONTHLY"] as const;

function dollarsToMinorUnits(value: string): number {
  return Math.round(Number.parseFloat(value || "0") * 100);
}

function minorUnitsToDollars(value: number): string {
  return (value / 100).toFixed(2);
}

const STATUS_COLOR: Record<string, string> = {
  HEALTHY: colors.budgetHealthy,
  APPROACHING: colors.budgetApproaching,
  EXCEEDED: colors.budgetExceeded,
};

const STATUS_LABEL: Record<string, string> = {
  HEALTHY: "Healthy",
  APPROACHING: "Approaching limit",
  EXCEEDED: "Over budget",
};

function StatusBar({ status, percentageUsed }: { status: string; percentageUsed: number }) {
  return (
    <View style={{ gap: 4 }}>
      <View style={styles.statusRow}>
        <Text style={styles.statusLabel}>{STATUS_LABEL[status] ?? status}</Text>
        <Text style={styles.statusLabel}>{percentageUsed}%</Text>
      </View>
      <View style={styles.barTrack}>
        <View
          style={[
            styles.barFill,
            {
              width: `${Math.min(100, percentageUsed)}%`,
              backgroundColor: STATUS_COLOR[status] ?? colors.textSecondary,
            },
          ]}
        />
      </View>
    </View>
  );
}

export default function BudgetsScreen() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [budgets, setBudgets] = useState<Budget[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [listError, setListError] = useState(false);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const [period, setPeriod] = useState<(typeof PERIODS)[number]>("MONTHLY");
  const [mode, setMode] = useState<"overall" | "perCategory">("overall");
  const [totalAmount, setTotalAmount] = useState("");
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [categoryAmounts, setCategoryAmounts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [isLoading, user, router]);

  const refresh = async (): Promise<void> => {
    setBudgets(await listBudgets(apiClient));
  };

  const loadBudgets = (): void => {
    setListError(false);
    refresh().catch(() => setListError(true));
  };

  useEffect(() => {
    if (!user) {
      return;
    }
    loadBudgets();
    listCategories(apiClient).then(setCategories);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const toggleCategory = (categoryId: string): void => {
    setSelectedCategoryIds((current) =>
      current.includes(categoryId)
        ? current.filter((id) => id !== categoryId)
        : [...current, categoryId],
    );
  };

  const onCreate = async (): Promise<void> => {
    setErrorMessage(null);
    setPendingKey("create");
    try {
      const today = new Date().toISOString().slice(0, 10);
      if (mode === "overall") {
        await createBudget(apiClient, {
          period,
          anchorDate: today,
          currency: "NZD",
          totalAmountMinorUnits: dollarsToMinorUnits(totalAmount),
        });
      } else {
        await createBudget(apiClient, {
          period,
          anchorDate: today,
          currency: "NZD",
          categoryAllocations: selectedCategoryIds.map((categoryId) => ({
            categoryId,
            amountMinorUnits: dollarsToMinorUnits(categoryAmounts[categoryId] ?? "0"),
          })),
        });
      }
      setTotalAmount("");
      setSelectedCategoryIds([]);
      setCategoryAmounts({});
      await refresh();
    } catch {
      setErrorMessage("Could not create the budget — check the amounts you entered.");
    } finally {
      setPendingKey(null);
    }
  };

  const onDelete = async (id: string): Promise<void> => {
    setErrorMessage(null);
    setPendingKey(`delete:${id}`);
    try {
      await deleteBudget(apiClient, id);
      await refresh();
    } catch {
      setErrorMessage("Could not delete this budget. Please try again.");
    } finally {
      setPendingKey(null);
    }
  };

  if (isLoading || !user) {
    return null;
  }

  return (
    <Screen>
      <Section title="New budget">
        <View style={styles.row}>
          {PERIODS.map((p) => (
            <Pressable
              key={p}
              onPress={() => setPeriod(p)}
              style={[styles.chip, period === p && styles.chipSelected]}
            >
              <Text style={period === p ? styles.chipTextSelected : styles.chipText}>{p}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.row}>
          <Pressable
            onPress={() => setMode("overall")}
            style={[styles.chip, mode === "overall" && styles.chipSelected]}
          >
            <Text style={mode === "overall" ? styles.chipTextSelected : styles.chipText}>
              Overall
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setMode("perCategory")}
            style={[styles.chip, mode === "perCategory" && styles.chipSelected]}
          >
            <Text style={mode === "perCategory" ? styles.chipTextSelected : styles.chipText}>
              Per category
            </Text>
          </Pressable>
        </View>

        {mode === "overall" ? (
          <TextField
            placeholder="Total amount"
            keyboardType="decimal-pad"
            value={totalAmount}
            onChangeText={setTotalAmount}
          />
        ) : (
          <View style={{ gap: spacing.sm }}>
            <View style={styles.row}>
              {categories.map((category) => (
                <Pressable
                  key={category.id}
                  onPress={() => toggleCategory(category.id)}
                  style={[
                    styles.chip,
                    selectedCategoryIds.includes(category.id) && styles.chipSelected,
                  ]}
                >
                  <Text
                    style={
                      selectedCategoryIds.includes(category.id)
                        ? styles.chipTextSelected
                        : styles.chipText
                    }
                  >
                    {category.name}
                  </Text>
                </Pressable>
              ))}
            </View>
            {selectedCategoryIds.map((categoryId) => (
              <View key={categoryId} style={styles.allocationRow}>
                <Text style={styles.allocationLabel}>
                  {categories.find((category) => category.id === categoryId)?.name}
                </Text>
                <TextField
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  value={categoryAmounts[categoryId] ?? ""}
                  onChangeText={(value) =>
                    setCategoryAmounts((current) => ({ ...current, [categoryId]: value }))
                  }
                  style={styles.allocationInput}
                />
              </View>
            ))}
          </View>
        )}

        <Button onPress={onCreate} disabled={pendingKey === "create"}>
          {pendingKey === "create" ? "Creating…" : "Create budget"}
        </Button>
        {errorMessage && <ErrorState message={errorMessage} />}
      </Section>

      {budgets === null ? (
        listError ? (
          <ListLoadError message="Could not load budgets." onRetry={loadBudgets} />
        ) : (
          <LoadingState message="Loading budgets…" />
        )
      ) : (
        <FlatList
          data={budgets}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          ListEmptyComponent={<EmptyState message="No budgets yet." />}
          renderItem={({ item }) => (
            <View style={styles.budgetCard}>
              <View style={styles.budgetHeader}>
                <Text style={styles.budgetName}>{item.name ?? `${item.period} budget`}</Text>
                <Pressable
                  onPress={() => onDelete(item.id)}
                  disabled={pendingKey === `delete:${item.id}`}
                >
                  <Text style={styles.link}>
                    {pendingKey === `delete:${item.id}` ? "Deleting…" : "Delete"}
                  </Text>
                </Pressable>
              </View>

              {item.status !== null && (
                <>
                  <StatusBar status={item.status} percentageUsed={item.percentageUsed ?? 0} />
                  <Text style={styles.amountText}>
                    ${minorUnitsToDollars(item.spentMinorUnits ?? 0)} of $
                    {minorUnitsToDollars(item.totalAmountMinorUnits ?? 0)}
                  </Text>
                </>
              )}

              {item.categories.map((entry) => (
                <View key={entry.categoryId} style={{ marginTop: spacing.sm }}>
                  <Text style={styles.allocationLabel}>{entry.categoryName}</Text>
                  <StatusBar status={entry.status} percentageUsed={entry.percentageUsed} />
                  <Text style={styles.amountText}>
                    ${minorUnitsToDollars(entry.spentMinorUnits)} of $
                    {minorUnitsToDollars(entry.amountMinorUnits)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        />
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
  allocationRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs + 4 },
  allocationLabel: { fontSize: 13, width: 100, color: colors.textPrimary },
  allocationInput: { flex: 1 },
  budgetCard: {
    paddingVertical: spacing.sm + 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.xs,
  },
  budgetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  budgetName: { fontSize: 15, fontWeight: "600", color: colors.textPrimary, flexShrink: 1 },
  statusRow: { flexDirection: "row", justifyContent: "space-between" },
  statusLabel: { fontSize: 12, color: colors.textSecondary },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: colors.background },
  barFill: { height: 8, borderRadius: 4 },
  amountText: { fontSize: 12, color: colors.textSecondary },
  link: { textDecorationLine: "underline", color: colors.financialNegative },
});
