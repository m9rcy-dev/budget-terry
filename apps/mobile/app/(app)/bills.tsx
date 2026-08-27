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
import { ListLoadError } from "../../components/ListLoadError";
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
  const [listError, setListError] = useState(false);

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [recurrence, setRecurrence] = useState<(typeof RECURRENCES)[number]>("MONTHLY");
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined);
  const [accountId, setAccountId] = useState<string | undefined>(undefined);

  // Set when a bill with no default account is paid — the occurrence whose
  // row should show an inline "which account?" picker instead of paying
  // immediately (see onPayClick).
  const [payingOccurrence, setPayingOccurrence] = useState<{
    billId: string;
    occurrenceId: string;
  } | null>(null);
  const [payAccountId, setPayAccountId] = useState<string | undefined>(undefined);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [isLoading, user, router]);

  const refresh = async (): Promise<void> => {
    setBills(await listBills(apiClient));
  };

  const loadBills = (): void => {
    setListError(false);
    refresh().catch(() => setListError(true));
  };

  useEffect(() => {
    if (!user) {
      return;
    }
    loadBills();
    listCategories(apiClient).then(setCategories);
    listAccounts(apiClient).then(setAccounts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const onCreate = async (): Promise<void> => {
    setErrorMessage(null);
    setPendingKey("create");
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
    } finally {
      setPendingKey(null);
    }
  };

  // Bills without a default account need one chosen at pay-time — the API
  // accepts accountId on the pay call for exactly this (see
  // markBillOccurrencePaidSchema). Bills that already have one pay in a
  // single tap, unchanged.
  const onPayPress = (bill: Bill, occurrenceId: string): void => {
    if (bill.accountId) {
      void onPay(bill.id, occurrenceId, bill.accountId);
    } else {
      setErrorMessage(null);
      setPayAccountId(undefined);
      setPayingOccurrence({ billId: bill.id, occurrenceId });
    }
  };

  const onPay = async (billId: string, occurrenceId: string, accountId: string): Promise<void> => {
    setErrorMessage(null);
    setPendingKey(`pay:${occurrenceId}`);
    try {
      await payBillOccurrence(apiClient, billId, occurrenceId, { accountId });
      setPayingOccurrence(null);
      await refresh();
    } catch {
      setErrorMessage("Could not mark this occurrence as paid. Please try again.");
    } finally {
      setPendingKey(null);
    }
  };

  const onConfirmPay = (): void => {
    if (!payingOccurrence || !payAccountId) {
      return;
    }
    void onPay(payingOccurrence.billId, payingOccurrence.occurrenceId, payAccountId);
  };

  const onSkip = async (billId: string, occurrenceId: string): Promise<void> => {
    setErrorMessage(null);
    setPendingKey(`skip:${occurrenceId}`);
    try {
      await skipBillOccurrence(apiClient, billId, occurrenceId);
      await refresh();
    } catch {
      setErrorMessage("Could not skip this occurrence. Please try again.");
    } finally {
      setPendingKey(null);
    }
  };

  const onArchive = async (billId: string): Promise<void> => {
    setErrorMessage(null);
    setPendingKey(`archive:${billId}`);
    try {
      await archiveBill(apiClient, billId);
      await refresh();
    } catch {
      setErrorMessage("Could not archive this bill. Please try again.");
    } finally {
      setPendingKey(null);
    }
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

        <Button onPress={onCreate} disabled={pendingKey === "create"}>
          {pendingKey === "create" ? "Adding…" : "Add bill"}
        </Button>
        {errorMessage && <ErrorState message={errorMessage} />}
      </Section>

      {bills === null ? (
        listError ? (
          <ListLoadError message="Could not load bills." onRetry={loadBills} />
        ) : (
          <LoadingState message="Loading bills…" />
        )
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
                <Pressable
                  onPress={() => onArchive(item.id)}
                  disabled={pendingKey === `archive:${item.id}`}
                >
                  <Text style={styles.link}>
                    {pendingKey === `archive:${item.id}` ? "Archiving…" : "Archive"}
                  </Text>
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
                  {occurrence.paymentStatus === "PENDING" &&
                    (payingOccurrence?.occurrenceId === occurrence.id ? (
                      <View style={styles.payPicker}>
                        <View style={styles.row}>
                          {accounts.map((account) => (
                            <Pressable
                              key={account.id}
                              onPress={() => setPayAccountId(account.id)}
                              style={[
                                styles.chip,
                                payAccountId === account.id && styles.chipSelected,
                              ]}
                            >
                              <Text
                                style={
                                  payAccountId === account.id
                                    ? styles.chipTextSelected
                                    : styles.chipText
                                }
                              >
                                {account.name}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                        <View style={styles.occurrenceActions}>
                          <Pressable
                            onPress={onConfirmPay}
                            disabled={!payAccountId || pendingKey === `pay:${occurrence.id}`}
                          >
                            <Text style={styles.link}>
                              {pendingKey === `pay:${occurrence.id}` ? "Paying…" : "Confirm"}
                            </Text>
                          </Pressable>
                          <Pressable onPress={() => setPayingOccurrence(null)}>
                            <Text style={styles.linkMuted}>Cancel</Text>
                          </Pressable>
                        </View>
                      </View>
                    ) : (
                      <View style={styles.occurrenceActions}>
                        <Pressable
                          onPress={() => onPayPress(item, occurrence.id)}
                          disabled={pendingKey === `pay:${occurrence.id}`}
                        >
                          <Text style={styles.link}>
                            {pendingKey === `pay:${occurrence.id}` ? "Paying…" : "Pay"}
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => onSkip(item.id, occurrence.id)}
                          disabled={pendingKey === `skip:${occurrence.id}`}
                        >
                          <Text style={styles.linkMuted}>
                            {pendingKey === `skip:${occurrence.id}` ? "Skipping…" : "Skip"}
                          </Text>
                        </Pressable>
                      </View>
                    ))}
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
  billName: { fontSize: 15, fontWeight: "600", color: colors.textPrimary, flexShrink: 1 },
  occurrenceRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  occurrenceInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs + 2,
    flexShrink: 1,
  },
  occurrenceText: { fontSize: 12, color: colors.textPrimary, flexShrink: 1 },
  occurrenceActions: { flexDirection: "row", gap: spacing.sm + 4 },
  payPicker: { gap: spacing.xs + 2, alignItems: "flex-end" },
  link: { textDecorationLine: "underline", color: colors.accentPrimary },
  linkMuted: { textDecorationLine: "underline", color: colors.textSecondary },
});
