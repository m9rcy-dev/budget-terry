"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../lib/auth-context";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/transactions", label: "Transactions" },
  { href: "/accounts", label: "Accounts" },
  { href: "/categories", label: "Categories" },
  { href: "/budgets", label: "Budgets" },
  { href: "/bills", label: "Bills" },
  { href: "/calendar", label: "Calendar" },
  { href: "/goals", label: "Goals" },
  { href: "/analytics", label: "Analytics" },
];

/**
 * Shared header/nav/container for every authenticated page — replaces
 * the `<nav>` block that used to be hand-copied onto each page
 * separately (a real drift risk after 9 phases of adding links one page
 * at a time). Plan Section 75: navigation consistency.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const onLogout = async (): Promise<void> => {
    await logout();
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link href="/dashboard" className="text-base font-semibold text-accent-primary">
              Budget Terry
            </Link>
            <nav aria-label="Main" className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {NAV_LINKS.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={isActive ? "page" : undefined}
                    className={
                      isActive
                        ? "font-medium text-accent-primary"
                        : "text-text-secondary hover:text-text-primary"
                    }
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          {user && (
            <div className="flex items-center gap-3 text-sm text-text-secondary">
              <span className="hidden sm:inline">{user.displayName}</span>
              <button
                type="button"
                onClick={onLogout}
                className="underline underline-offset-2 hover:text-text-primary"
              >
                Log out
              </button>
            </div>
          )}
        </div>
      </header>
      <main className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-8">{children}</main>
    </div>
  );
}
