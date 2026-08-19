"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Account, Category, Transaction } from "@budget-terry/types";
import {
  createTransaction,
  deleteTransaction,
  listAccounts,
  listCategories,
  listTransactions,
  updateTransaction,
  type ListTransactionsOptions,
} from "@budget-terry/api-client";
import { apiClient } from "../../lib/api-client";
import { useAuth } from "../../lib/auth-context";

function dollarsToMinorUnits(value: string): number {
  return Math.round(Number.parseFloat(value || "0") * 100);
}

function minorUnitsToDollars(value: number): string {
  return (value / 100).toFixed(2);
}

const PAGE_SIZE = 20;

export default function TransactionsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<{ type?: "INCOME" | "EXPENSE"; search?: string }>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");

  const [type, setType] = useState<"EXPENSE" | "INCOME">("EXPENSE");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [transactionDate, setTransactionDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [merchant, setMerchant] = useState("");

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [isLoading, user, router]);

  useEffect(() => {
    if (!user) {
      return;
    }
    listAccounts(apiClient).then((result) => {
      setAccounts(result);
      if (result.length > 0) {
        setAccountId((current) => current || result[0]!.id);
      }
    });
    listCategories(apiClient).then(setCategories);
  }, [user]);

  const refresh = async (): Promise<void> => {
    const options: ListTransactionsOptions = { page, pageSize: PAGE_SIZE, ...filters };
    const result = await listTransactions(apiClient, options);
    setTransactions(result.items);
    setTotal(result.total);
  };

  useEffect(() => {
    if (!user) {
      return;
    }
    refresh().catch(() => setErrorMessage("Could not load transactions."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, page, filters]);

  const accountName = (id: string): string =>
    accounts.find((account) => account.id === id)?.name ?? "—";
  const categoryName = (id: string | null): string =>
    id ? (categories.find((category) => category.id === id)?.name ?? "—") : "Uncategorized";

  const onCreate = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setErrorMessage(null);
    try {
      await createTransaction(apiClient, {
        accountId,
        categoryId: categoryId || undefined,
        type,
        amountMinorUnits: dollarsToMinorUnits(amount),
        currency: "NZD",
        transactionDate,
        merchant: merchant || undefined,
      });
      setAmount("");
      setMerchant("");
      setPage(1);
      await refresh();
    } catch {
      setErrorMessage("Could not create the transaction.");
    }
  };

  const onStartEdit = (transaction: Transaction): void => {
    setEditingId(transaction.id);
    setEditAmount(minorUnitsToDollars(transaction.amountMinorUnits));
  };

  const onSaveEdit = async (id: string): Promise<void> => {
    await updateTransaction(apiClient, id, { amountMinorUnits: dollarsToMinorUnits(editAmount) });
    setEditingId(null);
    await refresh();
  };

  const onDelete = async (id: string): Promise<void> => {
    await deleteTransaction(apiClient, id);
    await refresh();
  };

  if (isLoading || !user) {
    return null;
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-8">
      <h1 className="text-xl font-semibold">Transactions</h1>

      <form onSubmit={onCreate} className="flex flex-col gap-2 rounded border p-4">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setType("EXPENSE")}
            className={`rounded px-3 py-1 text-sm ${type === "EXPENSE" ? "bg-black text-white" : "border"}`}
          >
            Expense
          </button>
          <button
            type="button"
            onClick={() => setType("INCOME")}
            className={`rounded px-3 py-1 text-sm ${type === "INCOME" ? "bg-black text-white" : "border"}`}
          >
            Income
          </button>
        </div>

        <select
          value={accountId}
          onChange={(event) => setAccountId(event.target.value)}
          className="rounded border px-3 py-2"
        >
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>

        {type === "EXPENSE" && (
          <select
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            className="rounded border px-3 py-2"
          >
            <option value="">No category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        )}

        <input
          type="number"
          step="0.01"
          placeholder="Amount"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          className="rounded border px-3 py-2"
          required
        />
        <input
          type="date"
          value={transactionDate}
          onChange={(event) => setTransactionDate(event.target.value)}
          className="rounded border px-3 py-2"
          required
        />
        <input
          placeholder="Merchant (optional)"
          value={merchant}
          onChange={(event) => setMerchant(event.target.value)}
          className="rounded border px-3 py-2"
        />
        <button type="submit" className="rounded bg-black px-3 py-2 text-white">
          Add {type === "EXPENSE" ? "expense" : "income"}
        </button>
        {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
      </form>

      <div className="flex flex-wrap gap-2">
        <select
          value={filters.type ?? ""}
          onChange={(event) => {
            setPage(1);
            setFilters((current) => ({
              ...current,
              type: (event.target.value || undefined) as "INCOME" | "EXPENSE" | undefined,
            }));
          }}
          className="rounded border px-2 py-1 text-sm"
        >
          <option value="">All types</option>
          <option value="EXPENSE">Expense</option>
          <option value="INCOME">Income</option>
        </select>
        <input
          placeholder="Search merchant/description"
          onChange={(event) => {
            setPage(1);
            setFilters((current) => ({ ...current, search: event.target.value || undefined }));
          }}
          className="rounded border px-2 py-1 text-sm"
        />
      </div>

      <ul className="flex flex-col gap-2">
        {transactions.map((transaction) => (
          <li
            key={transaction.id}
            className="flex items-center justify-between rounded border px-3 py-2"
          >
            {editingId === transaction.id ? (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.01"
                  value={editAmount}
                  onChange={(event) => setEditAmount(event.target.value)}
                  className="w-24 rounded border px-2 py-1"
                />
                <button
                  type="button"
                  onClick={() => onSaveEdit(transaction.id)}
                  className="text-sm underline"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="text-sm underline"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div>
                <span
                  className={transaction.type === "EXPENSE" ? "text-red-700" : "text-green-700"}
                >
                  {transaction.type === "EXPENSE" ? "-" : "+"}
                  {minorUnitsToDollars(transaction.amountMinorUnits)}
                </span>{" "}
                <span className="text-sm text-gray-500">
                  {transaction.transactionDate.slice(0, 10)} · {accountName(transaction.accountId)}{" "}
                  · {categoryName(transaction.categoryId)}
                  {transaction.merchant ? ` · ${transaction.merchant}` : ""}
                </span>
              </div>
            )}
            {editingId !== transaction.id && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onStartEdit(transaction)}
                  className="text-sm underline"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(transaction.id)}
                  className="text-sm underline"
                >
                  Delete
                </button>
              </div>
            )}
          </li>
        ))}
        {transactions.length === 0 && <p className="text-sm text-gray-500">No transactions yet.</p>}
      </ul>

      <div className="flex items-center gap-4 text-sm">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => setPage((current) => current - 1)}
          className="underline disabled:opacity-40"
        >
          Previous
        </button>
        <span>
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => setPage((current) => current + 1)}
          className="underline disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </main>
  );
}
