/** Shown when a fetch (not just a mutation) fails — distinct from EmptyState's "nothing here yet". */
export function ErrorState({ message }: { message: string }) {
  return (
    <p role="alert" className="text-sm text-financial-negative">
      {message}
    </p>
  );
}
