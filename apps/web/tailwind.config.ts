import { colors, radius } from "@budget-terry/ui";
import type { Config } from "tailwindcss";

/** Warm Ledger design tokens (plan Section 70/74), sourced from @budget-terry/ui. */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: colors.background,
        surface: colors.surface,
        "text-primary": colors.textPrimary,
        "text-secondary": colors.textSecondary,
        border: colors.border,
        "accent-primary": colors.accentPrimary,
        "accent-secondary": colors.accentSecondary,
        "financial-positive": colors.financialPositive,
        "financial-warning": colors.financialWarning,
        "financial-negative": colors.financialNegative,
        "financial-neutral": colors.financialNeutral,
        "budget-healthy": colors.budgetHealthy,
        "budget-approaching": colors.budgetApproaching,
        "budget-exceeded": colors.budgetExceeded,
        "bill-upcoming": colors.billUpcoming,
        "bill-due-soon": colors.billDueSoon,
        "bill-due-today": colors.billDueToday,
        "bill-overdue": colors.billOverdue,
        "bill-paid": colors.billPaid,
        "bill-skipped": colors.billSkipped,
      },
      borderRadius: {
        sm: `${radius.sm}px`,
        md: `${radius.md}px`,
        lg: `${radius.lg}px`,
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
