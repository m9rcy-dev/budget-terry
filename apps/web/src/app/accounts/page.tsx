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
import { apiClient } from "../../lib/api-client";
import { useAuth } from "../../lib/auth-context";

const ACCOUNT_TYPES = ["EVERYDAY", "SAVINGS", "CREDIT_CARD", "CASH", "OTHER"] as const;

export default function AccountsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<(typeof ACCOUNT_TYPES)[number]>("EVERYDAY");
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
    <main className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 p-8">
      <h1 className="text-xl font-semibold">Accounts</h1>

      <form onSubmit={onCreate} className="flex flex-col gap-2 rounded border p-4">
        <input
          placeholder="Account name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="rounded border px-3 py-2"
          required
        />
        <select
          value={type}
          onChange={(event) => setType(event.target.value as (typeof ACCOUNT_TYPES)[number])}
          className="rounded border px-3 py-2"
        >
          {ACCOUNT_TYPES.map((accountType) => (
            <option key={accountType} value={accountType}>
              {accountType}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded bg-black px-3 py-2 text-white">
          Add account
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
        {accounts.map((account) => (
          <li
            key={account.id}
            className="flex items-center justify-between rounded border px-3 py-2"
          >
            <span>
              {account.name} <span className="text-sm text-gray-500">({account.type})</span>
              {account.isArchived && <span className="ml-2 text-xs text-gray-400">Archived</span>}
            </span>
            <button
              type="button"
              onClick={() => onArchiveToggle(account)}
              className="text-sm underline"
            >
              {account.isArchived ? "Restore" : "Archive"}
            </button>
          </li>
        ))}
        {accounts.length === 0 && <p className="text-sm text-gray-500">No accounts yet.</p>}
      </ul>
    </main>
  );
}
