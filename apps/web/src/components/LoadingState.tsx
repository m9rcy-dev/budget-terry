/**
 * Shown while a fetch is in flight — previously most pages rendered
 * `null` during loading, which reads as a broken/blank page rather than
 * "working on it" (plan Section 75 quality gate: loading states exist).
 */
export function LoadingState({ message = "Loading…" }: { message?: string }) {
  return (
    <div role="status" className="flex items-center gap-2 text-sm text-text-secondary">
      <span
        className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-border border-t-accent-primary"
        aria-hidden="true"
      />
      {message}
    </div>
  );
}
