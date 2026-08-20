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
import { AppShell } from "../../components/AppShell";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { Input } from "../../components/Field";
import { LoadingState } from "../../components/LoadingState";
import { Section } from "../../components/Section";
import { apiClient } from "../../lib/api-client";
import { useAuth } from "../../lib/auth-context";

export default function CategoriesPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [categories, setCategories] = useState<Category[] | null>(null);
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
    <AppShell>
      <h1 className="text-xl font-semibold text-text-primary">Categories</h1>

      <Section>
        <form onSubmit={onCreate} className="flex flex-col gap-2">
          <Input
            aria-label="Category name"
            placeholder="Category name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
          <Button type="submit">Add category</Button>
          {errorMessage && <ErrorState message={errorMessage} />}
        </form>
      </Section>

      <label className="flex items-center gap-2 text-sm text-text-secondary">
        <input
          type="checkbox"
          checked={showArchived}
          onChange={(event) => setShowArchived(event.target.checked)}
        />
        Show archived
      </label>

      {categories === null ? (
        <LoadingState message="Loading categories…" />
      ) : (
        <ul className="flex flex-col gap-2">
          {categories.map((category) => (
            <li
              key={category.id}
              className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2"
            >
              <span className="text-text-primary">
                {category.name}
                {category.isArchived && (
                  <span className="ml-2 text-xs text-text-secondary">Archived</span>
                )}
              </span>
              <button
                type="button"
                onClick={() => onArchiveToggle(category)}
                className="text-sm text-accent-primary underline underline-offset-2"
              >
                {category.isArchived ? "Restore" : "Archive"}
              </button>
            </li>
          ))}
          {categories.length === 0 && <EmptyState message="No categories yet." />}
        </ul>
      )}
    </AppShell>
  );
}
