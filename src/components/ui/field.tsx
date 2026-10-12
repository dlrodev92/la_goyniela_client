import type { ReactNode } from "react";
import { Reveal } from "@/components/motion/reveal";
import { cn } from "@/lib/cn";

export type FieldControlProps = {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
  "aria-required"?: true;
  required?: boolean;
};

type FieldProps = {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  /** Receives the id and aria wiring to spread on the control. */
  children: (control: FieldControlProps) => ReactNode;
};

/** Label + hint + error wrapper. Wires aria-describedby / aria-invalid onto the control it renders. */
export function Field({ id, label, hint, error, required, className, children }: FieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("grid gap-2", className)}>
      <label htmlFor={id} className="text-meta font-bold uppercase tracking-[0.12em] text-fg">
        {label}
        {required && (
          <>
            <span aria-hidden="true" className="ml-1 text-action">*</span>
            <span className="sr-only"> (obligatorio)</span>
          </>
        )}
      </label>
      {children({
        id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
        "aria-required": required ? true : undefined,
        required,
      })}
      {hint && <p id={hintId} className="text-meta text-fg-muted">{hint}</p>}
      <Reveal className="[--reveal-gap:0.5rem]">{error && <p id={errorId} className="text-label text-danger">{error}</p>}</Reveal>
    </div>
  );
}

export const controlClasses = cn(
  "block w-full min-h-touch rounded-control border-(length:--bw) border-border-soft bg-surface-1 px-4 py-3 text-body text-fg font-ui",
  "placeholder:text-fg-muted/70 transition-[border-color,background-color,box-shadow] duration-(--duration-fast)",
  "hover-fine:border-secondary hover-fine:bg-surface-2 focus-visible:border-action focus-visible:shadow-hard-sm",
  "aria-[invalid=true]:border-danger disabled:cursor-not-allowed disabled:opacity-50",
);
