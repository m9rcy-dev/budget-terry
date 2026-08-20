import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
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
import { apiClient } from "../lib/api-client";
import { useAuth } from "../lib/auth-context";

const RECURRENCES = ["ONE_OFF", "WEEKLY", "FORTNIGHTLY", "MONTHLY", "QUARTERLY", "YEARLY"] as const;

function dollarsToMinorUnits(value: string): number {
  return Math.round(Number.parseFloat(value || "0") * 100);
}

function minorUnitsToDollars(value: number): string {
  return (value / 100).toFixed(2);
}

const STATUS_COLOR: Record<string, string> = {
  UPCOMING: "#9ca3af",
  DUE_SOON: "#d97706",
  DUE_TODAY: "#ea580c",
  OVERDUE: "#b91c1c",
  PAID: "#16a34a",
  SKIPPED: "#9ca3af",
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
  const [bills, setBills] = useState<Bill[]>([]);
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
    <View style={styles.container}>
      <Text style={styles.title}>Bills</Text>

      <TextInput placeholder="Bill name" value={name} onChangeText={setName} style={styles.input} />
      <TextInput
        placeholder="Amount"
        keyboardType="decimal-pad"
        value={amount}
        onChangeText={setAmount}
        style={styles.input}
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

      <Pressable style={styles.button} onPress={onCreate}>
        <Text style={styles.buttonText}>Add bill</Text>
      </Pressable>
      {errorMessage && <Text style={styles.error}>{errorMessage}</Text>}

      <FlatList
        data={bills}
        keyExtractor={(item) => item.id}
        style={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>No bills yet.</Text>}
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
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: STATUS_COLOR[occurrence.displayStatus] },
                    ]}
                  />
                  <Text style={styles.occurrenceText}>
                    {occurrence.dueDate.slice(0, 10)} · $
                    {minorUnitsToDollars(occurrence.amountMinorUnits)} ·{" "}
                    {STATUS_LABEL[occurrence.displayStatus] ?? occurrence.displayStatus}
                  </Text>
                </View>
                {occurrence.paymentStatus === "PENDING" && (
                  <View style={styles.occurrenceActions}>
                    <Pressable onPress={() => onPay(item.id, occurrence.id)}>
                      <Text style={styles.link}>Pay</Text>
                    </Pressable>
                    <Pressable onPress={() => onSkip(item.id, occurrence.id)}>
                      <Text style={styles.link}>Skip</Text>
                    </Pressable>
                  </View>
                )}
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
  button: { backgroundColor: "#111", borderRadius: 8, padding: 14, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "600" },
  error: { color: "#b91c1c", fontSize: 13 },
  list: { marginTop: 12 },
  billCard: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    gap: 6,
  },
  billHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  billName: { fontSize: 15, fontWeight: "600" },
  occurrenceRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  occurrenceInfo: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  occurrenceText: { fontSize: 12, color: "#374151", flexShrink: 1 },
  occurrenceActions: { flexDirection: "row", gap: 12 },
  link: { textDecorationLine: "underline" },
  empty: { color: "#70746F", fontSize: 14 },
});
