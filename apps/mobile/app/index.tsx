import { useEffect, useState } from "react";
import { Link, useRouter } from "expo-router";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import type { DashboardSummary } from "@budget-terry/types";
import { getDashboardSummary } from "@budget-terry/api-client";
import { apiClient } from "../lib/api-client";
import { useAuth } from "../lib/auth-context";

function minorUnitsToDollars(value: number): string {
  return (value / 100).toFixed(2);
}

export default function HomeScreen() {
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [isLoading, user, router]);

  useEffect(() => {
    if (!user) {
      return;
    }
    getDashboardSummary(apiClient).then(setSummary);
  }, [user]);

  if (isLoading || !user) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Budget Terry</Text>
      <Text style={styles.subtitle}>
        Logged in as {user.displayName} ({user.email})
      </Text>

      <View style={styles.nav}>
        <Link href="/transactions" style={styles.navLink}>
          Transactions
        </Link>
        <Link href="/accounts" style={styles.navLink}>
          Accounts
        </Link>
        <Link href="/categories" style={styles.navLink}>
          Categories
        </Link>
        <Link href="/budgets" style={styles.navLink}>
          Budgets
        </Link>
        <Link href="/bills" style={styles.navLink}>
          Bills
        </Link>
        <Link href="/calendar" style={styles.navLink}>
          Calendar
        </Link>
        <Link href="/goals" style={styles.navLink}>
          Goals
        </Link>
        <Link href="/analytics" style={styles.navLink}>
          Analytics
        </Link>
      </View>

      {summary && (
        <>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Income</Text>
              <Text style={styles.summaryIncome}>
                ${minorUnitsToDollars(summary.incomeMinorUnits)}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Expenses</Text>
              <Text style={styles.summaryExpense}>
                ${minorUnitsToDollars(summary.expensesMinorUnits)}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Remaining</Text>
              <Text style={styles.summaryNet}>${minorUnitsToDollars(summary.netMinorUnits)}</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Recent transactions</Text>
          <FlatList
            data={summary.recentTransactions}
            keyExtractor={(item) => item.id}
            style={styles.list}
            ListEmptyComponent={<Text style={styles.empty}>No transactions yet.</Text>}
            renderItem={({ item }) => (
              <View style={styles.txnRow}>
                <Text>{item.transactionDate.slice(0, 10)}</Text>
                <Text
                  style={item.type === "EXPENSE" ? styles.summaryExpense : styles.summaryIncome}
                >
                  {item.type === "EXPENSE" ? "-" : "+"}${minorUnitsToDollars(item.amountMinorUnits)}
                </Text>
              </View>
            )}
          />
        </>
      )}

      <Pressable
        style={styles.button}
        onPress={async () => {
          await logout();
          router.replace("/login");
        }}
      >
        <Text style={styles.buttonText}>Log out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 12,
    padding: 24,
    paddingTop: 60,
  },
  title: {
    fontSize: 22,
    fontWeight: "600",
  },
  subtitle: {
    fontSize: 14,
    color: "#70746F",
  },
  nav: { flexDirection: "row", gap: 16 },
  navLink: { textDecorationLine: "underline" },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  summaryItem: { alignItems: "center" },
  summaryLabel: { fontSize: 12, color: "#70746F" },
  summaryIncome: { fontSize: 16, fontWeight: "600", color: "#15803d" },
  summaryExpense: { fontSize: 16, fontWeight: "600", color: "#b91c1c" },
  summaryNet: { fontSize: 16, fontWeight: "600" },
  sectionTitle: { fontSize: 13, fontWeight: "600", color: "#70746F", marginTop: 8 },
  list: { marginTop: 4 },
  txnRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  empty: { color: "#70746F", fontSize: 14 },
  button: {
    backgroundColor: "#111",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: { color: "#fff", fontWeight: "600" },
});
