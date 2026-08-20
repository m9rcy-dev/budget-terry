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
import { Button } from "../components/Button";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { Screen } from "../components/Screen";
import { Section } from "../components/Section";
import { TextField } from "../components/TextField";
import { apiClient } from "../lib/api-client";
import { useAuth } from "../lib/auth-context";

export default function CategoriesScreen() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [name, setName] = useState("");
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
    listCategories(apiClient, { includeArchived: showArchived })
      .then(setCategories)
      .catch(() => setErrorMessage("Could not load categories."));
  }, [user, showArchived]);

  const refresh = async (): Promise<void> => {
    setCategories(await listCategories(apiClient, { includeArchived: showArchived }));
  };

  const onCreate = async (): Promise<void> => {
    setErrorMessage(null);
    try {
      await createCategory(apiClient, { name });
      setName("");
      await refresh();
    } catch {
      setErrorMessage("A category with this name already exists.");
    }
  };

  const onArchiveToggle = async (category: Category): Promise<void> => {
    if (category.isArchived) {
      await restoreCategory(apiClient, category.id);
    } else {
      await archiveCategory(apiClient, category.id);
    }
    await refresh();
  };

  if (isLoading || !user) {
    return null;
  }

  return (
    <Screen title="Categories">
      <Section title="New category">
        <TextField placeholder="Category name" value={name} onChangeText={setName} />
        <Button onPress={onCreate}>Add category</Button>
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
        <LoadingState message="Loading categories…" />
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
              <Pressable onPress={() => onArchiveToggle(item)}>
                <Text style={styles.link}>{item.isArchived ? "Restore" : "Archive"}</Text>
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
  rowText: { color: colors.textPrimary },
  link: { textDecorationLine: "underline", color: colors.accentPrimary },
});
