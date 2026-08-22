"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../lib/auth-context";
import {
  AccountsIcon,
  AnalyticsIcon,
  BillsIcon,
  BudgetsIcon,
  CalendarIcon,
  CategoriesIcon,
  CloseIcon,
  DashboardIcon,
  GoalsIcon,
  LogoutIcon,
  MenuIcon,
  TransactionsIcon,
} from "./icons";
import { Logo } from "./Logo";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard", Icon: DashboardIcon },
  { href: "/transactions", label: "Transactions", Icon: TransactionsIcon },
  { href: "/accounts", label: "Accounts", Icon: AccountsIcon },
  { href: "/categories", label: "Categories", Icon: CategoriesIcon },
  { href: "/budgets", label: "Budgets", Icon: BudgetsIcon },
  { href: "/bills", label: "Bills", Icon: BillsIcon },
  { href: "/calendar", label: "Calendar", Icon: CalendarIcon },
  { href: "/goals", label: "Goals", Icon: GoalsIcon },
  { href: "/analytics", label: "Analytics", Icon: AnalyticsIcon },
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase() || "?";
}

/**
 * Left sidebar on desktop, a hamburger-triggered slide-out drawer on
 * narrow viewports — replaces the old wrapping top nav bar. Same nav
 * list/icons/account footer in both presentations, not two components
 * to keep in sync (plan Section 75: navigation consistency).
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    setIsDrawerOpen(false);
  }, [pathname]);

  const onLogout = async (): Promise<void> => {
    await logout();
    router.push("/login");
  };

  return (
    <div className="flex min-h-screen bg-background">
      {isDrawerOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setIsDrawerOpen(false)}
          className="fixed inset-0 z-30 bg-text-primary/40 md:hidden"
        />
      )}

      <aside
        id="app-sidebar"
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-surface p-4 transition-transform duration-200 md:static md:z-auto md:translate-x-0 ${
          isDrawerOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-6 flex items-center justify-between px-1">
          <Logo />
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setIsDrawerOpen(false)}
            className="text-text-secondary hover:text-text-primary md:hidden"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <nav aria-label="Main" className="flex flex-1 flex-col gap-0.5">
          {NAV_LINKS.map(({ href, label, Icon }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] font-medium ${
                  isActive
                    ? "bg-accent-primary/10 font-semibold text-accent-primary"
                    : "text-text-secondary hover:bg-background hover:text-text-primary"
                }`}
              >
                <Icon className="h-[17px] w-[17px] shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        {user && (
          <div className="mt-2 flex items-center gap-2.5 border-t border-border pt-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-secondary text-[11px] font-bold text-accent-primary">
              {initials(user.displayName)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12.5px] font-semibold text-text-primary">
                {user.displayName}
              </p>
              <p className="truncate text-[11px] text-text-secondary">{user.email}</p>
            </div>
            <button
              type="button"
              onClick={onLogout}
              aria-label="Log out"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-text-secondary hover:bg-background hover:text-text-primary"
            >
              <LogoutIcon className="h-4 w-4" />
            </button>
          </div>
        )}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-3 md:hidden">
          <button
            type="button"
            aria-label="Open navigation"
            aria-expanded={isDrawerOpen}
            aria-controls="app-sidebar"
            onClick={() => setIsDrawerOpen(true)}
            className="text-text-primary"
          >
            <MenuIcon className="h-5 w-5" />
          </button>
          <Logo compact />
          {user ? (
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-secondary text-[11px] font-bold text-accent-primary">
              {initials(user.displayName)}
            </span>
          ) : (
            <span className="h-7 w-7" />
          )}
        </div>

        <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
