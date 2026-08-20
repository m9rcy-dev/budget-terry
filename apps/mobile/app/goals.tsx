import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { Account, SavingsGoal } from "@budget-terry/types";
import {
  addGoalContribution,
  archiveGoal,
  completeGoal,
  createGoal,
  listAccounts,
  listGoals,
} from "@budget-terry/api-client";
import { apiClient } from "../lib/api-client";
import { useAuth } from "../lib/auth-context";

function dollarsToMinorUnits(value: string): number {
  return Math.round(Number.parseFloat(value || "0") * 100);
}

function minorUnitsToDollars(value: number): string {
  return (value / 100).toFixed(2);
}

export default function GoalsScreen() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [accountId, setAccountId] = useState<string | undefined>(undefined);
  const [contributionAmounts, setContributionAmounts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [isLoading, user, router]);

  const refresh = async (): Promise<void> => {
    setGoals(await listGoals(apiClient));
  };

  useEffect(() => {
    if (!user) {
      return;
    }
    refresh().catch(() => setErrorMessage("Could not load goals."));
    listAccounts(apiClient).then(setAccounts);
  }, [user]);

  const onCreate = async (): Promise<void> => {
    setErrorMessage(null);
    try {
      await createGoal(apiClient, {
        name,
        targetAmountMinorUnits: dollarsToMinorUnits(targetAmount),
        currency: "NZD",
        accountId,
      });
      setName("");
      setTargetAmount("");
      await refresh();
    } catch {
      setErrorMessage("Could not create the goal.");
    }
  };

  const onContribute = async (goalId: string): Promise<void> => {
    setErrorMessage(null);
    try {
      await addGoalContribution(apiClient, goalId, {
        amountMinorUnits: dollarsToMinorUnits(contributionAmounts[goalId] ?? "0"),
      });
      setContributionAmounts((current) => ({ ...current, [goalId]: "" }));
      await refresh();
    } catch {
      setErrorMessage("Could not add the contribution — does this goal have an account?");
    }
  };

  const onComplete = async (goalId: string): Promise<void> => {
    await completeGoal(apiClient, goalId);
    await refresh();
  };

  const onArchive = async (goalId: string): Promise<void> => {
    await archiveGoal(apiClient, goalId);
    await refresh();
  };

  if (isLoading || !user) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Savings Goals</Text>

      <TextInput placeholder="Goal name" value={name} onChangeText={setName} style={styles.input} />
      <TextInput
        placeholder="Target amount"
        keyboardType="decimal-pad"
        value={targetAmount}
        onChangeText={setTargetAmount}
        style={styles.input}
      />

      <View style={styles.row}>
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

      <Pressable style={styles.button} onPress={onCreate}>
        <Text style={styles.buttonText}>Add goal</Text>
      </Pressable>
      {errorMessage && <Text style={styles.error}>{errorMessage}</Text>}

      <FlatList
        data={goals}
        keyExtractor={(item) => item.id}
        style={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>No goals yet.</Text>}
        renderItem={({ item }) => {
          const percentage = Math.min(100, item.percentageComplete);
          return (
            <View style={styles.goalCard}>
              <View style={styles.goalHeader}>
                <Text style={styles.goalName}>
                  {item.name}
                  {item.status !== "ACTIVE" ? ` — ${item.status}` : ""}
                </Text>
                <View style={styles.goalActions}>
                  {item.status === "ACTIVE" && (
                    <Pressable onPress={() => onComplete(item.id)}>
                      <Text style={styles.link}>Complete</Text>
                    </Pressable>
                  )}
                  <Pressable onPress={() => onArchive(item.id)}>
                    <Text style={styles.link}>Archive</Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${percentage}%` }]} />
              </View>
              <Text style={styles.amountText}>
                ${minorUnitsToDollars(item.savedMinorUnits)} of $
                {minorUnitsToDollars(item.targetAmountMinorUnits)} ({item.percentageComplete}%)
              </Text>
              {item.suggestedMonthlyContributionMinorUnits !== null && (
                <Text style={styles.amountText}>
                  Suggested ${minorUnitsToDollars(item.suggestedMonthlyContributionMinorUnits)}
                  /month
                </Text>
              )}

              {item.status === "ACTIVE" && (
                <View style={styles.contributeRow}>
                  <TextInput
                    placeholder="Contribute"
                    keyboardType="decimal-pad"
                    value={contributionAmounts[item.id] ?? ""}
                    onChangeText={(value) =>
                      setContributionAmounts((current) => ({ ...current, [item.id]: value }))
                    }
                    style={styles.contributeInput}
                  />
                  <Pressable onPress={() => onContribute(item.id)}>
                    <Text style={styles.link}>Add</Text>
                  </Pressable>
                </View>
              )}
            </View>
          );
        }}
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
  button: { backgroundColor: "#111", borderRadius: 8, padding: 14, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "600" },
  error: { color: "#b91c1c", fontSize: 13 },
  list: { marginTop: 12 },
  goalCard: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    gap: 4,
  },
  goalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  goalName: { fontSize: 15, fontWeight: "600" },
  goalActions: { flexDirection: "row", gap: 12 },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: "#f3f4f6" },
  barFill: { height: 8, borderRadius: 4, backgroundColor: "#111" },
  amountText: { fontSize: 12, color: "#70746F" },
  contributeRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  contributeInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 8,
  },
  link: { textDecorationLine: "underline" },
  empty: { color: "#70746F", fontSize: 14 },
});
