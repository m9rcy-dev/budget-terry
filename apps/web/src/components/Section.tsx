import type { ReactNode } from "react";

/**
 * Warm Ledger's default content container — spacing and a hairline
 * border rather than a heavy shadowed card (plan Section 70: "prefer
 * sections, spacing, typography, and dividers over putting everything
 * inside cards").
 */
export function Section({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 ${className}`}
    >
      {title && <h2 className="text-sm font-semibold text-text-secondary">{title}</h2>}
      {children}
    </section>
  );
}
