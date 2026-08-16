"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Category } from "@budget-terry/types";
import {
  archiveCategory,
  createCategory,
  listCategories,
  restoreCategory,
} from "@budget-terry/api-client";
import { apiClient } from "../../lib/api-client";
import { useAuth } from "../../lib/auth-context";

export default function CategoriesPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [name, setName] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
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

  const onCreate = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
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
    <main className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 p-8">
      <h1 className="text-xl font-semibold">Categories</h1>

      <form onSubmit={onCreate} className="flex flex-col gap-2 rounded border p-4">
        <input
          placeholder="Category name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="rounded border px-3 py-2"
          required
        />
        <button type="submit" className="rounded bg-black px-3 py-2 text-white">
          Add category
        </button>
        {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
      </form>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={showArchived}
          onChange={(event) => setShowArchived(event.target.checked)}
        />
        Show archived
      </label>

      <ul className="flex flex-col gap-2">
        {categories.map((category) => (
          <li
            key={category.id}
            className="flex items-center justify-between rounded border px-3 py-2"
          >
            <span>
              {category.name}
              {category.isArchived && <span className="ml-2 text-xs text-gray-400">Archived</span>}
            </span>
            <button
              type="button"
              onClick={() => onArchiveToggle(category)}
              className="text-sm underline"
            >
              {category.isArchived ? "Restore" : "Archive"}
            </button>
          </li>
        ))}
        {categories.length === 0 && <p className="text-sm text-gray-500">No categories yet.</p>}
      </ul>
    </main>
  );
}
