import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { Budget, Category } from "@budget-terry/types";
import { createBudget, deleteBudget, listBudgets, listCategories } from "@budget-terry/api-client";
import { apiClient } from "../lib/api-client";
import { useAuth } from "../lib/auth-context";

const PERIODS = ["WEEKLY", "FORTNIGHTLY", "MONTHLY"] as const;

function dollarsToMinorUnits(value: string): number {
  return Math.round(Number.parseFloat(value || "0") * 100);
}

function minorUnitsToDollars(value: number): string {
  return (value / 100).toFixed(2);
}

const STATUS_COLOR: Record<string, string> = {
  HEALTHY: "#16a34a",
  APPROACHING: "#d97706",
  EXCEEDED: "#b91c1c",
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
              backgroundColor: STATUS_COLOR[status] ?? "#999",
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
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  useEffect(() => {
    if (!user) {
      return;
    }
    refresh().catch(() => setErrorMessage("Could not load budgets."));
    listCategories(apiClient).then(setCategories);
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
    }
  };

  const onDelete = async (id: string): Promise<void> => {
    await deleteBudget(apiClient, id);
    await refresh();
  };

  if (isLoading || !user) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Budgets</Text>

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
        <TextInput
          placeholder="Total amount"
          keyboardType="decimal-pad"
          value={totalAmount}
          onChangeText={setTotalAmount}
          style={styles.input}
        />
      ) : (
        <View style={{ gap: 8 }}>
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
              <TextInput
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

      <Pressable style={styles.button} onPress={onCreate}>
        <Text style={styles.buttonText}>Create budget</Text>
      </Pressable>
      {errorMessage && <Text style={styles.error}>{errorMessage}</Text>}

      <FlatList
        data={budgets}
        keyExtractor={(item) => item.id}
        style={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>No budgets yet.</Text>}
        renderItem={({ item }) => (
          <View style={styles.budgetCard}>
            <View style={styles.budgetHeader}>
              <Text style={styles.budgetName}>{item.name ?? `${item.period} budget`}</Text>
              <Pressable onPress={() => onDelete(item.id)}>
                <Text style={styles.link}>Delete</Text>
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
              <View key={entry.categoryId} style={{ marginTop: 8 }}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 8 },
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
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12 },
  allocationRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  allocationLabel: { fontSize: 13, width: 100 },
  allocationInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 8,
  },
  button: { backgroundColor: "#111", borderRadius: 8, padding: 14, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "600" },
  error: { color: "#b91c1c", fontSize: 13 },
  list: { marginTop: 12 },
  budgetCard: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    gap: 4,
  },
  budgetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  budgetName: { fontSize: 15, fontWeight: "600" },
  statusRow: { flexDirection: "row", justifyContent: "space-between" },
  statusLabel: { fontSize: 12, color: "#70746F" },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: "#f3f4f6" },
  barFill: { height: 8, borderRadius: 4 },
  amountText: { fontSize: 12, color: "#70746F" },
  link: { textDecorationLine: "underline" },
  empty: { color: "#70746F", fontSize: 14 },
});
