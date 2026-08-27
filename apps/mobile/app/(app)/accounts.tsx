import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { FlatList, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import type { Account } from "@budget-terry/types";
import {
  archiveAccount,
  createAccount,
  listAccounts,
  restoreAccount,
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

const ACCOUNT_TYPES = ["CHEQUE", "SAVINGS", "CREDIT_CARD", "OTHER"] as const;

export default function AccountsScreen() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<(typeof ACCOUNT_TYPES)[number]>("CHEQUE");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [listError, setListError] = useState(false);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [isLoading, user, router]);

  const refresh = async (): Promise<void> => {
    setAccounts(await listAccounts(apiClient, { includeArchived: showArchived }));
  };

  const loadAccounts = (): void => {
    setListError(false);
    refresh().catch(() => setListError(true));
  };

  useEffect(() => {
    if (!user) {
      return;
    }
    loadAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, showArchived]);

  const onCreate = async (): Promise<void> => {
    setErrorMessage(null);
    setPendingKey("create");
    try {
      await createAccount(apiClient, { name, type, currency: "NZD" });
      setName("");
      await refresh();
    } catch {
      setErrorMessage("Could not create the account.");
    } finally {
      setPendingKey(null);
    }
  };

  const onArchiveToggle = async (account: Account): Promise<void> => {
    setErrorMessage(null);
    setPendingKey(`archive:${account.id}`);
    try {
      if (account.isArchived) {
        await restoreAccount(apiClient, account.id);
      } else {
        await archiveAccount(apiClient, account.id);
      }
      await refresh();
    } catch {
      setErrorMessage("Could not update this account. Please try again.");
    } finally {
      setPendingKey(null);
    }
  };

  if (isLoading || !user) {
    return null;
  }

  return (
    <Screen>
      <Section title="New account">
        <TextField placeholder="Account name" value={name} onChangeText={setName} />
        <View style={styles.typeRow}>
          {ACCOUNT_TYPES.map((accountType) => (
            <Pressable
              key={accountType}
              onPress={() => setType(accountType)}
              style={[styles.typeChip, type === accountType && styles.typeChipSelected]}
            >
              <Text
                style={type === accountType ? styles.typeChipTextSelected : styles.typeChipText}
              >
                {accountType}
              </Text>
            </Pressable>
          ))}
        </View>
        <Button onPress={onCreate} disabled={pendingKey === "create"}>
          {pendingKey === "create" ? "Adding…" : "Add account"}
        </Button>
        {errorMessage && <ErrorState message={errorMessage} />}
      </Section>

      <View style={styles.switchRow}>
        <Switch
          value={showArchived}
          onValueChange={setShowArchived}
          trackColor={{ true: colors.accentPrimary }}
        />
        <Text style={styles.switchLabel}>Show archived</Text>
      </View>

      {accounts === null ? (
        listError ? (
          <ListLoadError message="Could not load accounts." onRetry={loadAccounts} />
        ) : (
          <LoadingState message="Loading accounts…" />
        )
      ) : (
        <FlatList
          data={accounts}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          ListEmptyComponent={<EmptyState message="No accounts yet." />}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text style={styles.rowText}>
                {item.name} ({item.type}){item.isArchived ? " — Archived" : ""}
              </Text>
              <Pressable
                onPress={() => onArchiveToggle(item)}
                disabled={pendingKey === `archive:${item.id}`}
              >
                <Text style={styles.link}>
                  {pendingKey === `archive:${item.id}`
                    ? "Working…"
                    : item.isArchived
                      ? "Restore"
                      : "Archive"}
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
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs + 4 },
  typeChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xs,
  },
  typeChipSelected: { backgroundColor: colors.accentPrimary, borderColor: colors.accentPrimary },
  typeChipText: { fontSize: 12, color: colors.textPrimary },
  typeChipTextSelected: { fontSize: 12, color: "#FFFFFF" },
  switchRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs + 4 },
  switchLabel: { color: colors.textSecondary },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowText: { color: colors.textPrimary, flexShrink: 1 },
  link: { textDecorationLine: "underline", color: colors.accentPrimary },
});
