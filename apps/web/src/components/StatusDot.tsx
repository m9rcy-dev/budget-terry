/**
 * Pairs a colour indicator with a text label — plan Section 54/70:
 * colour must never be the only indication of financial state. `color`
 * is a hex value from @budget-terry/ui's token set (dynamic per status,
 * so it can't be a static Tailwind class).
 */
export function StatusDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-text-secondary">
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}
