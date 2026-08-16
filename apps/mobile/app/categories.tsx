import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { FlatList, Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import type { Category } from "@budget-terry/types";
import {
  archiveCategory,
  createCategory,
  listCategories,
  restoreCategory,
} from "@budget-terry/api-client";
import { apiClient } from "../lib/api-client";
import { useAuth } from "../lib/auth-context";

export default function CategoriesScreen() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
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
    <View style={styles.container}>
      <Text style={styles.title}>Categories</Text>

      <TextInput
        placeholder="Category name"
        value={name}
        onChangeText={setName}
        style={styles.input}
      />
      <Pressable style={styles.button} onPress={onCreate}>
        <Text style={styles.buttonText}>Add category</Text>
      </Pressable>
      {errorMessage && <Text style={styles.error}>{errorMessage}</Text>}

      <View style={styles.switchRow}>
        <Switch value={showArchived} onValueChange={setShowArchived} />
        <Text>Show archived</Text>
      </View>

      <FlatList
        data={categories}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={styles.empty}>No categories yet.</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text>
              {item.name}
              {item.isArchived ? " — Archived" : ""}
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
