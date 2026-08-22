import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import type { Account, Bill, Category } from "@budget-terry/types";
import {
  archiveBill,
  createBill,
  listAccounts,
  listBills,
  listCategories,
  payBillOccurrence,
  skipBillOccurrence,
} from "@budget-terry/api-client";
import { colors, radius, spacing } from "@budget-terry/ui";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { LoadingState } from "../../components/LoadingState";
import { Screen } from "../../components/Screen";
import { Section } from "../../components/Section";
import { StatusDot } from "../../components/StatusDot";
import { TextField } from "../../components/TextField";
import { apiClient } from "../../lib/api-client";
import { useAuth } from "../../lib/auth-context";

const RECURRENCES = ["ONE_OFF", "WEEKLY", "FORTNIGHTLY", "MONTHLY", "QUARTERLY", "YEARLY"] as const;

function dollarsToMinorUnits(value: string): number {
  return Math.round(Number.parseFloat(value || "0") * 100);
}

function minorUnitsToDollars(value: number): string {
  return (value / 100).toFixed(2);
}

const STATUS_COLOR: Record<string, string> = {
  UPCOMING: colors.billUpcoming,
  DUE_SOON: colors.billDueSoon,
  DUE_TODAY: colors.billDueToday,
  OVERDUE: colors.billOverdue,
  PAID: colors.billPaid,
  SKIPPED: colors.billSkipped,
};

const STATUS_LABEL: Record<string, string> = {
  UPCOMING: "Upcoming",
  DUE_SOON: "Due soon",
  DUE_TODAY: "Due today",
  OVERDUE: "Overdue",
  PAID: "Paid",
  SKIPPED: "Skipped",
};

export default function BillsScreen() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [bills, setBills] = useState<Bill[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [recurrence, setRecurrence] = useState<(typeof RECURRENCES)[number]>("MONTHLY");
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined);
  const [accountId, setAccountId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [isLoading, user, router]);

  const refresh = async (): Promise<void> => {
    setBills(await listBills(apiClient));
  };

  useEffect(() => {
    if (!user) {
      return;
    }
    refresh().catch(() => setErrorMessage("Could not load bills."));
    listCategories(apiClient).then(setCategories);
    listAccounts(apiClient).then(setAccounts);
  }, [user]);

  const onCreate = async (): Promise<void> => {
    setErrorMessage(null);
    try {
      await createBill(apiClient, {
        name,
        amountMinorUnits: dollarsToMinorUnits(amount),
        currency: "NZD",
        recurrence,
        firstDueDate: new Date().toISOString().slice(0, 10),
        categoryId,
        accountId,
        autoPay: false,
      });
      setName("");
      setAmount("");
      await refresh();
    } catch {
      setErrorMessage("Could not create the bill.");
    }
  };

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

  const onArchive = async (billId: string): Promise<void> => {
    await archiveBill(apiClient, billId);
    await refresh();
  };

  if (isLoading || !user) {
    return null;
  }

  return (
    <Screen>
      <Section title="New bill">
        <TextField placeholder="Bill name" value={name} onChangeText={setName} />
        <TextField
          placeholder="Amount"
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={setAmount}
        />

        <View style={styles.row}>
          {RECURRENCES.map((r) => (
            <Pressable
              key={r}
              onPress={() => setRecurrence(r)}
              style={[styles.chip, recurrence === r && styles.chipSelected]}
            >
              <Text style={recurrence === r ? styles.chipTextSelected : styles.chipText}>{r}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.row}>
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

        <Button onPress={onCreate}>Add bill</Button>
        {errorMessage && <ErrorState message={errorMessage} />}
      </Section>

      {bills === null ? (
        <LoadingState message="Loading bills…" />
      ) : (
        <FlatList
          data={bills}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          ListEmptyComponent={<EmptyState message="No bills yet." />}
          renderItem={({ item }) => (
            <View style={styles.billCard}>
              <View style={styles.billHeader}>
                <Text style={styles.billName}>{item.name}</Text>
                <Pressable onPress={() => onArchive(item.id)}>
                  <Text style={styles.link}>Archive</Text>
                </Pressable>
              </View>

              {item.occurrences.map((occurrence) => (
                <View key={occurrence.id} style={styles.occurrenceRow}>
                  <View style={styles.occurrenceInfo}>
                    <Text style={styles.occurrenceText}>
                      {occurrence.dueDate.slice(0, 10)} · $
                      {minorUnitsToDollars(occurrence.amountMinorUnits)}
                    </Text>
                    <StatusDot
                      color={STATUS_COLOR[occurrence.displayStatus] ?? colors.textSecondary}
                      label={STATUS_LABEL[occurrence.displayStatus] ?? occurrence.displayStatus}
                    />
                  </View>
                  {occurrence.paymentStatus === "PENDING" && (
                    <View style={styles.occurrenceActions}>
                      <Pressable onPress={() => onPay(item.id, occurrence.id)}>
                        <Text style={styles.link}>Pay</Text>
                      </Pressable>
                      <Pressable onPress={() => onSkip(item.id, occurrence.id)}>
                        <Text style={styles.linkMuted}>Skip</Text>
                      </Pressable>
                    </View>
                  )}
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
  billCard: {
    paddingVertical: spacing.sm + 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.xs + 2,
  },
  billHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  billName: { fontSize: 15, fontWeight: "600", color: colors.textPrimary },
  occurrenceRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  occurrenceInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs + 2,
    flexShrink: 1,
  },
  occurrenceText: { fontSize: 12, color: colors.textPrimary, flexShrink: 1 },
  occurrenceActions: { flexDirection: "row", gap: spacing.sm + 4 },
  link: { textDecorationLine: "underline", color: colors.accentPrimary },
  linkMuted: { textDecorationLine: "underline", color: colors.textSecondary },
});
