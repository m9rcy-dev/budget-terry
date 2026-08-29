/** Badge-mark + wordmark, replacing the old plain-bold-text "Budget Terry" header. */
export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent-primary">
        <svg viewBox="0 0 120 120" className="h-[19px] w-[19px]" aria-hidden="true">
          <circle cx="30" cy="30" r="16" fill="#E7A48E" />
          <circle cx="33" cy="34" r="7" fill="#C97C63" />
          <circle cx="90" cy="30" r="16" fill="#E7A48E" />
          <circle cx="87" cy="34" r="7" fill="#C97C63" />
          <ellipse cx="60" cy="66" rx="43" ry="39" fill="#E7A48E" />
          <rect x="46" y="30" width="28" height="7" rx="3.5" fill="#285943" transform="rotate(-4 60 33)" />
          <circle cx="43" cy="60" r="5" fill="#202220" />
          <circle cx="77" cy="60" r="5" fill="#202220" />
          <ellipse cx="60" cy="81" rx="21" ry="16" fill="#C97C63" />
          <ellipse cx="53" cy="81" rx="3.4" ry="5" fill="#202220" opacity="0.55" />
          <ellipse cx="67" cy="81" rx="3.4" ry="5" fill="#202220" opacity="0.55" />
        </svg>
      </span>
      {!compact && (
        <span className="text-[15px] font-bold tracking-tight text-text-primary">Budget Terry</span>
      )}
    </span>
  );
}
