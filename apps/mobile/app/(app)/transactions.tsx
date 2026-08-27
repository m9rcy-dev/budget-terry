import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import type { Account, Category, Transaction } from "@budget-terry/types";
import {
  createTransaction,
  deleteTransaction,
  listAccounts,
  listCategories,
  listTransactions,
} from "@budget-terry/api-client";
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
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [listError, setListError] = useState(false);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

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

  const loadTransactions = (): void => {
    setListError(false);
    refresh().catch(() => setListError(true));
  };

  useEffect(() => {
    if (!user) {
      return;
    }
    loadTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const accountName = (id: string): string =>
    accounts.find((account) => account.id === id)?.name ?? "—";
  const categoryName = (id: string | null): string =>
    id ? (categories.find((category) => category.id === id)?.name ?? "—") : "Uncategorized";

  const onAdd = async (): Promise<void> => {
    setErrorMessage(null);
    setPendingKey("create");
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
    } finally {
      setPendingKey(null);
    }
  };

  const onDelete = async (id: string): Promise<void> => {
    setErrorMessage(null);
    setPendingKey(`delete:${id}`);
    try {
      await deleteTransaction(apiClient, id);
      await refresh();
    } catch {
      setErrorMessage("Could not delete this transaction. Please try again.");
    } finally {
      setPendingKey(null);
    }
  };

  if (isLoading || !user) {
    return null;
  }

  return (
    <Screen>
      <Section title="Add transaction">
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
            <Text style={type === "INCOME" ? styles.chipTextSelected : styles.chipText}>
              Income
            </Text>
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
                <Text
                  style={categoryId === category.id ? styles.chipTextSelected : styles.chipText}
                >
                  {category.name}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        <TextField
          placeholder="Amount"
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={setAmount}
        />
        <Button onPress={onAdd} disabled={pendingKey === "create"}>
          {pendingKey === "create" ? "Adding…" : `Add ${type === "EXPENSE" ? "expense" : "income"}`}
        </Button>
        {errorMessage && <ErrorState message={errorMessage} />}
      </Section>

      {transactions === null ? (
        listError ? (
          <ListLoadError message="Could not load transactions." onRetry={loadTransactions} />
        ) : (
          <LoadingState message="Loading transactions…" />
        )
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          ListEmptyComponent={<EmptyState message="No transactions yet." />}
          renderItem={({ item }) => (
            <View style={styles.txnRow}>
              <Text style={item.type === "EXPENSE" ? styles.txnTextExpense : styles.txnTextIncome}>
                {item.type === "EXPENSE" ? "-" : "+"}
                {minorUnitsToDollars(item.amountMinorUnits)}{" "}
                <Text style={styles.txnMeta}>
                  · {accountName(item.accountId)} · {categoryName(item.categoryId)}
                </Text>
              </Text>
              <Pressable
                onPress={() => onDelete(item.id)}
                disabled={pendingKey === `delete:${item.id}`}
              >
                <Text style={styles.link}>
                  {pendingKey === `delete:${item.id}` ? "Deleting…" : "Delete"}
                </Text>
              </Pressable>
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
  txnRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  txnTextExpense: { color: colors.financialNegative, flexShrink: 1 },
  txnTextIncome: { color: colors.financialPositive, flexShrink: 1 },
  txnMeta: { color: colors.textSecondary },
  link: { textDecorationLine: "underline", color: colors.financialNegative },
});
