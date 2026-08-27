import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  createAccount,
  createBill,
  createBudget,
  createGoal,
  listAccounts,
} from "@budget-terry/api-client";
import { colors, radius, spacing } from "@budget-terry/ui";
import { Button } from "../components/Button";
import { ErrorState } from "../components/ErrorState";
import { Screen } from "../components/Screen";
import { Section } from "../components/Section";
import { TextField } from "../components/TextField";
import { apiClient } from "../lib/api-client";
import { useAuth } from "../lib/auth-context";

const ACCOUNT_TYPES = ["CHEQUE", "SAVINGS", "CREDIT_CARD", "OTHER"] as const;
const PERIODS = ["WEEKLY", "FORTNIGHTLY", "MONTHLY"] as const;
const RECURRENCES = ["ONE_OFF", "WEEKLY", "FORTNIGHTLY", "MONTHLY", "QUARTERLY", "YEARLY"] as const;

type Step = "loading" | "account" | "checklist" | "budget" | "bill" | "goal" | "finishing";

function dollarsToMinorUnits(value: string): number {
  return Math.round(Number.parseFloat(value || "0") * 100);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}>
      <Text style={selected ? styles.chipTextSelected : styles.chipText}>{label}</Text>
    </Pressable>
  );
}

export default function OnboardingScreen() {
  const { user, isLoading, completeOnboarding } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<Step>("loading");
  const [queue, setQueue] = useState<Step[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [accountName, setAccountName] = useState("");
  const [accountType, setAccountType] = useState<(typeof ACCOUNT_TYPES)[number]>("CHEQUE");

  const [wantsBudget, setWantsBudget] = useState(false);
  const [wantsBills, setWantsBills] = useState(false);
  const [wantsGoal, setWantsGoal] = useState(false);

  const [budgetPeriod, setBudgetPeriod] = useState<(typeof PERIODS)[number]>("MONTHLY");
  const [budgetAmount, setBudgetAmount] = useState("");

  const [billName, setBillName] = useState("");
  const [billAmount, setBillAmount] = useState("");
  const [billRecurrence, setBillRecurrence] = useState<(typeof RECURRENCES)[number]>("MONTHLY");

  const [goalName, setGoalName] = useState("");
  const [goalTarget, setGoalTarget] = useState("");

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [isLoading, user, router]);

  useEffect(() => {
    if (!user) {
      return;
    }
    // A user who already has an account (e.g. resuming after leaving
    // mid-flow last time) skips straight to the optional checklist.
    listAccounts(apiClient)
      .then((accounts) => setStep(accounts.length > 0 ? "checklist" : "account"))
      .catch(() => setStep("account"));
  }, [user]);

  const advance = (remaining: Step[]): void => {
    if (remaining.length === 0) {
      void finish();
      return;
    }
    const [next, ...rest] = remaining;
    setQueue(rest);
    setStep(next!);
  };

  const finish = async (): Promise<void> => {
    setStep("finishing");
    try {
      await completeOnboarding();
      router.replace("/");
    } catch {
      setErrorMessage("Could not finish setup. Please try again.");
      setStep("checklist");
    }
  };

  const onCreateAccount = async (): Promise<void> => {
    setErrorMessage(null);
    try {
      await createAccount(apiClient, { name: accountName, type: accountType, currency: "NZD" });
      setStep("checklist");
    } catch {
      setErrorMessage("Could not create the account. Please try again.");
    }
  };

  const onChecklistContinue = (): void => {
    setErrorMessage(null);
    const next: Step[] = [];
    if (wantsBudget) next.push("budget");
    if (wantsBills) next.push("bill");
    if (wantsGoal) next.push("goal");
    advance(next);
  };

  const onCreateBudget = async (): Promise<void> => {
    setErrorMessage(null);
    try {
      await createBudget(apiClient, {
        period: budgetPeriod,
        anchorDate: todayIso(),
        currency: "NZD",
        totalAmountMinorUnits: dollarsToMinorUnits(budgetAmount),
      });
      advance(queue);
    } catch {
      setErrorMessage("Could not create the budget. Please try again.");
    }
  };

  const onCreateBill = async (): Promise<void> => {
    setErrorMessage(null);
    try {
      await createBill(apiClient, {
        name: billName,
        amountMinorUnits: dollarsToMinorUnits(billAmount),
        currency: "NZD",
        recurrence: billRecurrence,
        firstDueDate: todayIso(),
        autoPay: false,
      });
      advance(queue);
    } catch {
      setErrorMessage("Could not add the bill. Please try again.");
    }
  };

  const onCreateGoal = async (): Promise<void> => {
    setErrorMessage(null);
    try {
      await createGoal(apiClient, {
        name: goalName,
        targetAmountMinorUnits: dollarsToMinorUnits(goalTarget),
        currency: "NZD",
      });
      advance(queue);
    } catch {
      setErrorMessage("Could not create the goal. Please try again.");
    }
  };

  if (isLoading || !user || step === "loading" || step === "finishing") {
    return null;
  }

  return (
    <Screen>
      {step === "account" && (
        <Section>
          <Text style={styles.title}>Let&apos;s set up your first account</Text>
          <Text style={styles.subtitle}>Every transaction needs an account it belongs to.</Text>
          <TextField
            placeholder="e.g. Everyday Account"
            value={accountName}
            onChangeText={setAccountName}
          />
          <View style={styles.row}>
            {ACCOUNT_TYPES.map((option) => (
              <Chip
                key={option}
                label={option}
                selected={accountType === option}
                onPress={() => setAccountType(option)}
              />
            ))}
          </View>
          {errorMessage && <ErrorState message={errorMessage} />}
          <Button onPress={onCreateAccount}>Continue</Button>
        </Section>
      )}

      {step === "checklist" && (
        <Section>
          <Text style={styles.title}>Want to set up anything else?</Text>
          <Text style={styles.subtitle}>You can always do this later.</Text>
          <View style={styles.row}>
            <Chip
              label="A monthly budget"
              selected={wantsBudget}
              onPress={() => setWantsBudget((v) => !v)}
            />
          </View>
          <View style={styles.row}>
            <Chip
              label="Upcoming bills"
              selected={wantsBills}
              onPress={() => setWantsBills((v) => !v)}
            />
          </View>
          <View style={styles.row}>
            <Chip
              label="A savings goal"
              selected={wantsGoal}
              onPress={() => setWantsGoal((v) => !v)}
            />
          </View>
          {errorMessage && <ErrorState message={errorMessage} />}
          <Button onPress={onChecklistContinue}>Continue</Button>
          <Pressable onPress={() => void finish()}>
            <Text style={styles.link}>Skip for now</Text>
          </Pressable>
        </Section>
      )}

      {step === "budget" && (
        <Section>
          <Text style={styles.title}>Set up a budget</Text>
          <View style={styles.row}>
            {PERIODS.map((option) => (
              <Chip
                key={option}
                label={option}
                selected={budgetPeriod === option}
                onPress={() => setBudgetPeriod(option)}
              />
            ))}
          </View>
          <TextField
            placeholder="Total amount"
            keyboardType="decimal-pad"
            value={budgetAmount}
            onChangeText={setBudgetAmount}
          />
          {errorMessage && <ErrorState message={errorMessage} />}
          <Button onPress={onCreateBudget}>Continue</Button>
          <Pressable onPress={() => advance(queue)}>
            <Text style={styles.link}>Skip this</Text>
          </Pressable>
        </Section>
      )}

      {step === "bill" && (
        <Section>
          <Text style={styles.title}>Add an upcoming bill</Text>
          <TextField placeholder="Bill name" value={billName} onChangeText={setBillName} />
          <TextField
            placeholder="Amount"
            keyboardType="decimal-pad"
            value={billAmount}
            onChangeText={setBillAmount}
          />
          <View style={styles.row}>
            {RECURRENCES.map((option) => (
              <Chip
                key={option}
                label={option}
                selected={billRecurrence === option}
                onPress={() => setBillRecurrence(option)}
              />
            ))}
          </View>
          {errorMessage && <ErrorState message={errorMessage} />}
          <Button onPress={onCreateBill}>Continue</Button>
          <Pressable onPress={() => advance(queue)}>
            <Text style={styles.link}>Skip this</Text>
          </Pressable>
        </Section>
      )}

      {step === "goal" && (
        <Section>
          <Text style={styles.title}>Set up a savings goal</Text>
          <TextField placeholder="Goal name" value={goalName} onChangeText={setGoalName} />
          <TextField
            placeholder="Target amount"
            keyboardType="decimal-pad"
            value={goalTarget}
            onChangeText={setGoalTarget}
          />
          {errorMessage && <ErrorState message={errorMessage} />}
          <Button onPress={onCreateGoal}>Continue</Button>
          <Pressable onPress={() => advance(queue)}>
            <Text style={styles.link}>Skip this</Text>
          </Pressable>
        </Section>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: "600", color: colors.textPrimary },
  subtitle: { fontSize: 13, color: colors.textSecondary },
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
  link: { textDecorationLine: "underline", color: colors.accentPrimary, textAlign: "center" },
});
