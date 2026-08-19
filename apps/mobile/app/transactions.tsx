import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { Account, Category, Transaction } from "@budget-terry/types";
import {
  createTransaction,
  deleteTransaction,
  listAccounts,
  listCategories,
  listTransactions,
} from "@budget-terry/api-client";
import { apiClient } from "../lib/api-client";
import { useAuth } from "../lib/auth-context";

function dollarsToMinorUnits(value: string): number {
  return Math.round(Number.parseFloat(value || "0") * 100);
}

function minorUnitsToDollars(value: number): string {
  return (value / 100).toFixed(2);
}

export default function TransactionsScreen() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [type, setType] = useState<"EXPENSE" | "INCOME">("EXPENSE");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined);
  const [amount, setAmount] = useState("");

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [isLoading, user, router]);

  useEffect(() => {
    if (!user) {
      return;
    }
    listAccounts(apiClient).then((result) => {
      setAccounts(result);
      if (result.length > 0) {
        setAccountId((current) => current || result[0]!.id);
      }
    });
    listCategories(apiClient).then(setCategories);
  }, [user]);

  const refresh = async (): Promise<void> => {
    const result = await listTransactions(apiClient, { page: 1, pageSize: 20 });
    setTransactions(result.items);
  };

  useEffect(() => {
    if (!user) {
      return;
    }
    refresh().catch(() => setErrorMessage("Could not load transactions."));
  }, [user]);

  const accountName = (id: string): string =>
    accounts.find((account) => account.id === id)?.name ?? "—";
  const categoryName = (id: string | null): string =>
    id ? (categories.find((category) => category.id === id)?.name ?? "—") : "Uncategorized";

  const onAdd = async (): Promise<void> => {
    setErrorMessage(null);
    try {
      await createTransaction(apiClient, {
        accountId,
        categoryId,
        type,
        amountMinorUnits: dollarsToMinorUnits(amount),
        currency: "NZD",
        transactionDate: new Date().toISOString().slice(0, 10),
      });
      setAmount("");
      await refresh();
    } catch {
      setErrorMessage("Could not add the transaction.");
    }
  };

  const onDelete = async (id: string): Promise<void> => {
    await deleteTransaction(apiClient, id);
    await refresh();
  };

  if (isLoading || !user) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Add Transaction</Text>

      <View style={styles.row}>
        <Pressable
          onPress={() => setType("EXPENSE")}
          style={[styles.chip, type === "EXPENSE" && styles.chipSelected]}
        >
          <Text style={type === "EXPENSE" ? styles.chipTextSelected : styles.chipText}>
            Expense
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setType("INCOME")}
          style={[styles.chip, type === "INCOME" && styles.chipSelected]}
        >
          <Text style={type === "INCOME" ? styles.chipTextSelected : styles.chipText}>Income</Text>
        </Pressable>
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

      {type === "EXPENSE" && (
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
      )}

      <TextInput
        placeholder="Amount"
        keyboardType="decimal-pad"
        value={amount}
        onChangeText={setAmount}
        style={styles.input}
      />
      <Pressable style={styles.button} onPress={onAdd}>
        <Text style={styles.buttonText}>Add {type === "EXPENSE" ? "expense" : "income"}</Text>
      </Pressable>
      {errorMessage && <Text style={styles.error}>{errorMessage}</Text>}

      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        style={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>No transactions yet.</Text>}
        renderItem={({ item }) => (
          <View style={styles.txnRow}>
            <Text>
              {item.type === "EXPENSE" ? "-" : "+"}
              {minorUnitsToDollars(item.amountMinorUnits)} · {accountName(item.accountId)} ·{" "}
              {categoryName(item.categoryId)}
            </Text>
            <Pressable onPress={() => onDelete(item.id)}>
              <Text style={styles.link}>Delete</Text>
            </Pressable>
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
  txnRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  link: { textDecorationLine: "underline" },
  empty: { color: "#70746F", fontSize: 14 },
});
