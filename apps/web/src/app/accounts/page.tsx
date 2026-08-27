"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Account } from "@budget-terry/types";
import {
  archiveAccount,
  createAccount,
  listAccounts,
  restoreAccount,
} from "@budget-terry/api-client";
import { AppShell } from "../../components/AppShell";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { Input, Select } from "../../components/Field";
import { LoadingState } from "../../components/LoadingState";
import { Section } from "../../components/Section";
import { apiClient } from "../../lib/api-client";
import { useAuth } from "../../lib/auth-context";

const ACCOUNT_TYPES = ["CHEQUE", "SAVINGS", "CREDIT_CARD", "OTHER"] as const;

export default function AccountsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<(typeof ACCOUNT_TYPES)[number]>("CHEQUE");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
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

  const onCreate = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
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
    <AppShell>
      <h1 className="text-xl font-semibold text-text-primary">Accounts</h1>

      <Section>
        <form onSubmit={onCreate} className="flex flex-col gap-2">
          <Input
            aria-label="Account name"
            placeholder="Account name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
          <Select
            aria-label="Account type"
            value={type}
            onChange={(event) => setType(event.target.value as (typeof ACCOUNT_TYPES)[number])}
          >
            {ACCOUNT_TYPES.map((accountType) => (
              <option key={accountType} value={accountType}>
                {accountType}
              </option>
            ))}
          </Select>
          <Button type="submit">Add account</Button>
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

      {accounts === null ? (
        <LoadingState message="Loading accounts…" />
      ) : (
        <ul className="flex flex-col gap-2">
          {accounts.map((account) => (
            <li
              key={account.id}
              className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2"
            >
              <span className="text-text-primary">
                {account.name} <span className="text-sm text-text-secondary">({account.type})</span>
                {account.isArchived && (
                  <span className="ml-2 text-xs text-text-secondary">Archived</span>
                )}
              </span>
              <button
                type="button"
                onClick={() => onArchiveToggle(account)}
                disabled={pendingKey === `archive:${account.id}`}
                className="text-sm text-accent-primary underline underline-offset-2 disabled:opacity-50"
              >
                {pendingKey === `archive:${account.id}`
                  ? "Working…"
                  : account.isArchived
                    ? "Restore"
                    : "Archive"}
              </button>
            </li>
          ))}
          {accounts.length === 0 && <EmptyState message="No accounts yet." />}
        </ul>
      )}
    </AppShell>
  );
}
