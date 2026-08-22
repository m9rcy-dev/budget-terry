import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import type { Account, SavingsGoal } from "@budget-terry/types";
import {
  addGoalContribution,
  archiveGoal,
  completeGoal,
  createGoal,
  listAccounts,
  listGoals,
} from "@budget-terry/api-client";
import { colors, radius, spacing } from "@budget-terry/ui";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { LoadingState } from "../../components/LoadingState";
import { Screen } from "../../components/Screen";
import { Section } from "../../components/Section";
import { TextField } from "../../components/TextField";
import { apiClient } from "../../lib/api-client";
import { useAuth } from "../../lib/auth-context";

function dollarsToMinorUnits(value: string): number {
  return Math.round(Number.parseFloat(value || "0") * 100);
}

function minorUnitsToDollars(value: number): string {
  return (value / 100).toFixed(2);
}

export default function GoalsScreen() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [goals, setGoals] = useState<SavingsGoal[] | null>(null);
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
    <Screen>
      <Section title="New goal">
        <TextField placeholder="Goal name" value={name} onChangeText={setName} />
        <TextField
          placeholder="Target amount"
          keyboardType="decimal-pad"
          value={targetAmount}
          onChangeText={setTargetAmount}
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

        <Button onPress={onCreate}>Add goal</Button>
        {errorMessage && <ErrorState message={errorMessage} />}
      </Section>

      {goals === null ? (
        <LoadingState message="Loading goals…" />
      ) : (
        <FlatList
          data={goals}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          ListEmptyComponent={<EmptyState message="No goals yet." />}
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
                      <Text style={styles.linkMuted}>Archive</Text>
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
                    <TextField
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
  goalCard: {
    paddingVertical: spacing.sm + 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.xs,
  },
  goalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  goalName: { fontSize: 15, fontWeight: "600", color: colors.textPrimary },
  goalActions: { flexDirection: "row", gap: spacing.sm + 4 },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: colors.background },
  barFill: { height: 8, borderRadius: 4, backgroundColor: colors.accentPrimary },
  amountText: { fontSize: 12, color: colors.textSecondary },
  contributeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs + 4,
    marginTop: spacing.xs,
  },
  contributeInput: { flex: 1 },
  link: { textDecorationLine: "underline", color: colors.accentPrimary },
  linkMuted: { textDecorationLine: "underline", color: colors.textSecondary },
});
