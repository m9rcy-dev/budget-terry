/** Badge-mark + wordmark, replacing the old plain-bold-text "Budget Terry" header. */
export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent-primary text-[13px] font-extrabold text-white">
        B
      </span>
      {!compact && (
        <span className="text-[15px] font-bold tracking-tight text-text-primary">Budget Terry</span>
      )}
    </span>
  );
}
