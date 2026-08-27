import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { FlatList, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import type { Category } from "@budget-terry/types";
import {
  archiveCategory,
  createCategory,
  listCategories,
  restoreCategory,
} from "@budget-terry/api-client";
import { colors, spacing } from "@budget-terry/ui";
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

export default function CategoriesScreen() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [name, setName] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [listError, setListError] = useState(false);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [isLoading, user, router]);

  const refresh = async (): Promise<void> => {
    setCategories(await listCategories(apiClient, { includeArchived: showArchived }));
  };

  const loadCategories = (): void => {
    setListError(false);
    refresh().catch(() => setListError(true));
  };

  useEffect(() => {
    if (!user) {
      return;
    }
    loadCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, showArchived]);

  const onCreate = async (): Promise<void> => {
    setErrorMessage(null);
    setPendingKey("create");
    try {
      await createCategory(apiClient, { name });
      setName("");
      await refresh();
    } catch {
      setErrorMessage("A category with this name already exists.");
    } finally {
      setPendingKey(null);
    }
  };

  const onArchiveToggle = async (category: Category): Promise<void> => {
    setErrorMessage(null);
    setPendingKey(`archive:${category.id}`);
    try {
      if (category.isArchived) {
        await restoreCategory(apiClient, category.id);
      } else {
        await archiveCategory(apiClient, category.id);
      }
      await refresh();
    } catch {
      setErrorMessage("Could not update this category. Please try again.");
    } finally {
      setPendingKey(null);
    }
  };

  if (isLoading || !user) {
    return null;
  }

  return (
    <Screen>
      <Section title="New category">
        <TextField placeholder="Category name" value={name} onChangeText={setName} />
        <Button onPress={onCreate} disabled={pendingKey === "create"}>
          {pendingKey === "create" ? "Adding…" : "Add category"}
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

      {categories === null ? (
        listError ? (
          <ListLoadError message="Could not load categories." onRetry={loadCategories} />
        ) : (
          <LoadingState message="Loading categories…" />
        )
      ) : (
        <FlatList
          data={categories}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          ListEmptyComponent={<EmptyState message="No categories yet." />}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text style={styles.rowText}>
                {item.name}
                {item.isArchived ? " — Archived" : ""}
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
