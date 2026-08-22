import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

const FIELD_CLASSES =
  "rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary disabled:cursor-not-allowed disabled:opacity-50";

// forwardRef is required here, not decorative — react-hook-form's
// register() attaches a ref to read the field's value directly. Without
// it, RHF silently can't see what the user typed (fields report as
// permanently empty) rather than throwing a helpful error.
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input(props, ref) {
    return <input ref={ref} {...props} className={`${FIELD_CLASSES} ${props.className ?? ""}`} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select(props, ref) {
    return <select ref={ref} {...props} className={`${FIELD_CLASSES} ${props.className ?? ""}`} />;
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea(props, ref) {
  return <textarea ref={ref} {...props} className={`${FIELD_CLASSES} ${props.className ?? ""}`} />;
});

/**
 * Associates a visible label with its field via htmlFor/id (plan Section
 * 54 — screen readers, semantic labels) rather than relying on
 * placeholder text alone.
 */
export function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-sm text-text-secondary">
        {label}
      </label>
      {children}
      {error && <p className="text-sm text-financial-negative">{error}</p>}
    </div>
  );
}
