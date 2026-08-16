import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { FlatList, Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import type { Account } from "@budget-terry/types";
import {
  archiveAccount,
  createAccount,
  listAccounts,
  restoreAccount,
} from "@budget-terry/api-client";
import { apiClient } from "../lib/api-client";
import { useAuth } from "../lib/auth-context";

const ACCOUNT_TYPES = ["EVERYDAY", "SAVINGS", "CREDIT_CARD", "CASH", "OTHER"] as const;

export default function AccountsScreen() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<(typeof ACCOUNT_TYPES)[number]>("EVERYDAY");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [isLoading, user, router]);

  useEffect(() => {
    if (!user) {
      return;
    }
    listAccounts(apiClient, { includeArchived: showArchived })
      .then(setAccounts)
      .catch(() => setErrorMessage("Could not load accounts."));
  }, [user, showArchived]);

  const refresh = async (): Promise<void> => {
    setAccounts(await listAccounts(apiClient, { includeArchived: showArchived }));
  };

  const onCreate = async (): Promise<void> => {
    setErrorMessage(null);
    try {
      await createAccount(apiClient, { name, type, currency: "NZD" });
      setName("");
      await refresh();
    } catch {
      setErrorMessage("Could not create the account.");
    }
  };

  const onArchiveToggle = async (account: Account): Promise<void> => {
    if (account.isArchived) {
      await restoreAccount(apiClient, account.id);
    } else {
      await archiveAccount(apiClient, account.id);
    }
    await refresh();
  };

  if (isLoading || !user) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Accounts</Text>

      <TextInput
        placeholder="Account name"
        value={name}
        onChangeText={setName}
        style={styles.input}
      />
      <View style={styles.typeRow}>
        {ACCOUNT_TYPES.map((accountType) => (
          <Pressable
            key={accountType}
            onPress={() => setType(accountType)}
            style={[styles.typeChip, type === accountType && styles.typeChipSelected]}
          >
            <Text style={type === accountType ? styles.typeChipTextSelected : styles.typeChipText}>
              {accountType}
            </Text>
          </Pressable>
        ))}
      </View>
      <Pressable style={styles.button} onPress={onCreate}>
        <Text style={styles.buttonText}>Add account</Text>
      </Pressable>
      {errorMessage && <Text style={styles.error}>{errorMessage}</Text>}

      <View style={styles.switchRow}>
        <Switch value={showArchived} onValueChange={setShowArchived} />
        <Text>Show archived</Text>
      </View>

      <FlatList
        data={accounts}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={styles.empty}>No accounts yet.</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text>
              {item.name} ({item.type}){item.isArchived ? " — Archived" : ""}
            </Text>
            <Pressable onPress={() => onArchiveToggle(item)}>
              <Text style={styles.link}>{item.isArchived ? "Restore" : "Archive"}</Text>
            </Pressable>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 12 },
  title: { fontSize: 22, fontWeight: "600" },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12 },
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  typeChip: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  typeChipSelected: { backgroundColor: "#111", borderColor: "#111" },
  typeChipText: { fontSize: 12 },
  typeChipTextSelected: { fontSize: 12, color: "#fff" },
  button: { backgroundColor: "#111", borderRadius: 8, padding: 14, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "600" },
  error: { color: "#b91c1c", fontSize: 13 },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  row: {
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
