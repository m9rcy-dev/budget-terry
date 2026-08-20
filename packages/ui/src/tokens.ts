/**
 * Warm Ledger design tokens (plan Section 70/74, backlog BUD-DES-001).
 * Single source of truth for both platforms — web maps these into its
 * Tailwind theme, mobile imports them directly into StyleSheet values.
 * Web and React Native implement the same visual language with
 * different mechanisms (plan Section 74), not shared components.
 *
 * Hex values marked "plan-specified" come directly from Section 70's
 * colour table. Values marked "chosen" fill in the table's "To be
 * finalized" cells — picked to match colours already in consistent use
 * across Bills/Budgets/Calendar since Phase 8 (same amber/red/green),
 * rather than introducing a fourth palette this late.
 */
export const colors = {
  background: "#F7F7F4", // plan-specified: warm off-white
  surface: "#FFFFFF", // plan-specified
  textPrimary: "#202220", // plan-specified: charcoal
  textSecondary: "#70746F", // plan-specified: muted grey
  border: "#E4E2DC", // chosen: warm-tinted, sits between background and surface

  accentPrimary: "#285943", // plan-specified: deep forest green
  accentSecondary: "#87A693", // plan-specified: muted sage

  // Semantic financial states (plan Section 74's suggested token list).
  financialPositive: "#15803D", // chosen: green
  financialWarning: "#D97706", // chosen: warm amber
  financialNegative: "#B91C1C", // chosen: muted red
  financialNeutral: "#70746F", // = textSecondary

  budgetHealthy: "#15803D",
  budgetApproaching: "#D97706",
  budgetExceeded: "#B91C1C",

  billUpcoming: "#9CA3AF",
  billDueSoon: "#D97706",
  billDueToday: "#EA580C",
  billOverdue: "#B91C1C",
  billPaid: "#15803D",
  billSkipped: "#9CA3AF",
} as const;

/**
 * Plan Section 70: "Corner radius should generally remain around
 * 8–12px." Values in px — mobile StyleSheets use them directly; web's
 * Tailwind config maps them to borderRadius.sm/md/lg.
 */
export const radius = {
  sm: 8,
  md: 10,
  lg: 12,
} as const;

/** Named points on a 4px base scale, for mobile StyleSheet convenience. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

/**
 * Plan Section 70 lists Inter, Geist, or native system fonts as
 * candidates. Web loads Inter via next/font (near-zero cost, no layout
 * shift). Mobile deliberately uses the platform's native system font
 * instead of bundling a custom font — one of the plan's own candidates,
 * and it avoids Expo font-loading complexity that isn't worth it for a
 * hobby app's Phase 12 polish pass.
 */
export const typography = {
  webFontFamily: "Inter, system-ui, sans-serif",
} as const;

export type ColorToken = keyof typeof colors;
