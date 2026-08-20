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
import { AppShell } from "../../components/AppShell";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { Input, Select } from "../../components/Field";
import { LoadingState } from "../../components/LoadingState";
import { Section } from "../../components/Section";
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
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
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
    <AppShell>
      <h1 className="text-xl font-semibold text-text-primary">Transactions</h1>

      <Section>
        <form onSubmit={onCreate} className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Button
              type="button"
              variant={type === "EXPENSE" ? "primary" : "secondary"}
              onClick={() => setType("EXPENSE")}
            >
              Expense
            </Button>
            <Button
              type="button"
              variant={type === "INCOME" ? "primary" : "secondary"}
              onClick={() => setType("INCOME")}
            >
              Income
            </Button>
          </div>

          <Select
            aria-label="Account"
            value={accountId}
            onChange={(event) => setAccountId(event.target.value)}
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </Select>

          {type === "EXPENSE" && (
            <Select
              aria-label="Category"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
            >
              <option value="">No category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          )}

          <Input
            aria-label="Amount"
            type="number"
            step="0.01"
            placeholder="Amount"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            required
          />
          <Input
            aria-label="Transaction date"
            type="date"
            value={transactionDate}
            onChange={(event) => setTransactionDate(event.target.value)}
            required
          />
          <Input
            aria-label="Merchant (optional)"
            placeholder="Merchant (optional)"
            value={merchant}
            onChange={(event) => setMerchant(event.target.value)}
          />
          <Button type="submit">Add {type === "EXPENSE" ? "expense" : "income"}</Button>
          {errorMessage && <ErrorState message={errorMessage} />}
        </form>
      </Section>

      <div className="flex flex-wrap gap-2">
        <Select
          aria-label="Filter by type"
          value={filters.type ?? ""}
          onChange={(event) => {
            setPage(1);
            setFilters((current) => ({
              ...current,
              type: (event.target.value || undefined) as "INCOME" | "EXPENSE" | undefined,
            }));
          }}
          className="text-sm"
        >
          <option value="">All types</option>
          <option value="EXPENSE">Expense</option>
          <option value="INCOME">Income</option>
        </Select>
        <Input
          aria-label="Search merchant or description"
          placeholder="Search merchant/description"
          onChange={(event) => {
            setPage(1);
            setFilters((current) => ({ ...current, search: event.target.value || undefined }));
          }}
          className="text-sm"
        />
      </div>

      {transactions === null ? (
        <LoadingState message="Loading transactions…" />
      ) : (
        <ul className="flex flex-col gap-2">
          {transactions.map((transaction) => (
            <li
              key={transaction.id}
              className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2"
            >
              {editingId === transaction.id ? (
                <div className="flex items-center gap-2">
                  <Input
                    aria-label="Edit amount"
                    type="number"
                    step="0.01"
                    value={editAmount}
                    onChange={(event) => setEditAmount(event.target.value)}
                    className="w-24"
                  />
                  <button
                    type="button"
                    onClick={() => onSaveEdit(transaction.id)}
                    className="text-sm text-accent-primary underline underline-offset-2"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="text-sm text-text-secondary underline underline-offset-2"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div>
                  <span
                    className={`tabular-nums ${
                      transaction.type === "EXPENSE"
                        ? "text-financial-negative"
                        : "text-financial-positive"
                    }`}
                  >
                    {transaction.type === "EXPENSE" ? "-" : "+"}
                    {minorUnitsToDollars(transaction.amountMinorUnits)}
                  </span>{" "}
                  <span className="text-sm text-text-secondary">
                    {transaction.transactionDate.slice(0, 10)} ·{" "}
                    {accountName(transaction.accountId)} · {categoryName(transaction.categoryId)}
                    {transaction.merchant ? ` · ${transaction.merchant}` : ""}
                  </span>
                </div>
              )}
              {editingId !== transaction.id && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => onStartEdit(transaction)}
                    className="text-sm text-accent-primary underline underline-offset-2"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(transaction.id)}
                    className="text-sm text-financial-negative underline underline-offset-2"
                  >
                    Delete
                  </button>
                </div>
              )}
            </li>
          ))}
          {transactions.length === 0 && <EmptyState message="No transactions yet." />}
        </ul>
      )}

      <div className="flex items-center gap-4 text-sm text-text-primary">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => setPage((current) => current - 1)}
          className="underline underline-offset-2 disabled:opacity-40"
        >
          Previous
        </button>
        <span className="text-text-secondary">
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => setPage((current) => current + 1)}
          className="underline underline-offset-2 disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </AppShell>
  );
}
