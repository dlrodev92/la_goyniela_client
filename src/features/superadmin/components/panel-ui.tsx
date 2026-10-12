import type { ButtonHTMLAttributes, ReactNode } from "react";
import { SpinnerGap } from "@phosphor-icons/react/dist/ssr/SpinnerGap";
import { cn } from "@/lib/cn";

/** Small, flat building blocks for the superadmin panel: thin borders, 32px controls, color only where it carries meaning. */

export const panelControl = cn(
  "block h-9 w-full min-w-0 rounded-md border border-border-soft bg-surface-1 px-2 text-label text-fg font-ui md:h-8",
  "placeholder:text-fg-muted/70 transition-colors duration-(--duration-fast)",
  "hover-fine:border-secondary focus-visible:border-action aria-[invalid=true]:border-danger disabled:cursor-not-allowed disabled:opacity-50",
);

export type PanelButtonVariant = "default" | "primary" | "danger" | "ghost";

const buttonVariants: Record<PanelButtonVariant, string> = {
  default: "border-border-soft bg-surface-2 text-fg hover-fine:bg-surface-3",
  primary: "border-transparent bg-action text-on-action hover-fine:bg-highlight",
  danger: "border-danger/50 bg-transparent text-danger hover-fine:bg-danger/10",
  ghost: "border-transparent bg-transparent text-fg-muted hover-fine:bg-surface-2 hover-fine:text-fg",
};

export function panelButtonClasses(variant: PanelButtonVariant = "default", className?: string) {
  return cn(
    "tap inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md border px-3 text-label font-medium whitespace-nowrap select-none md:h-8",
    "[--press-scale:0.97] transition-colors duration-(--duration-fast) disabled:pointer-events-none disabled:opacity-50",
    buttonVariants[variant],
    className,
  );
}

type PanelButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: PanelButtonVariant; loading?: boolean };

export function PanelButton({ variant = "default", loading, className, children, type = "button", disabled, ...rest }: PanelButtonProps) {
  return (
    <button {...rest} type={type} disabled={disabled || loading} aria-busy={loading || undefined} className={panelButtonClasses(variant, className)}>
      {loading && <SpinnerGap size={14} weight="bold" aria-hidden="true" className="animate-spin motion-reduce:animate-none" />}
      {children}
    </button>
  );
}

export type BadgeKind = "neutral" | "success" | "danger" | "warning";
const badgeKinds: Record<BadgeKind, string> = {
  neutral: "border-border-soft text-fg-muted",
  success: "border-success/40 text-success",
  danger: "border-danger/40 text-danger",
  warning: "border-warning/40 text-warning",
};

export function StatusBadge({ kind = "neutral", children }: { kind?: BadgeKind; children: ReactNode }) {
  return <span className={cn("inline-flex h-5 items-center rounded border px-1.5 text-meta font-medium whitespace-nowrap", badgeKinds[kind])}>{children}</span>;
}

/** Label above a compact control, with its hint or error underneath. */
export function PField({ id, label, error, hint, className, children }: {
  id: string; label: string; error?: string; hint?: string; className?: string; children: ReactNode;
}) {
  return (
    <div className={cn("grid content-start gap-1", className)}>
      <label htmlFor={id} className="text-meta text-fg-muted">{label}</label>
      {children}
      {error ? <p id={`${id}-error`} role="alert" className="text-meta text-danger">{error}</p> : hint ? <p className="text-meta text-fg-muted">{hint}</p> : null}
    </div>
  );
}

/** Thin container shared by the three tables. */
export const panelSurface = "overflow-hidden rounded-lg border border-border-soft bg-surface-1";
