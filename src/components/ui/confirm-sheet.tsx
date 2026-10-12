"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Reveal } from "@/components/motion/reveal";
import { Button, type ButtonVariant } from "./button";
import { StatusMessage } from "./status-message";
import { controlClasses } from "./field";
import { cn } from "@/lib/cn";
import { matchesConfirmText } from "@/lib/ui-text";

type ConfirmSheetProps = {
  triggerLabel: string;
  triggerVariant?: ButtonVariant;
  /** Accessible name for the trigger when the visible label alone is ambiguous (e.g. one trigger per list row). */
  triggerAriaLabel?: string;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "danger" | "default";
  /** Require typing this text (e.g. the group name) before the confirm button enables. */
  confirmText?: { expected: string; label: string; name?: string };
  /** Server action (or useActionState dispatcher) submitted by the confirm button. */
  action: (formData: FormData) => void | Promise<void>;
  /** Extra form content, e.g. hidden inputs. */
  children?: ReactNode;
  /** Error from the action, rendered as an alert inside the sheet (the sheet stays open). */
  error?: string;
  /** Keeps the confirm button disabled (e.g. until the form content is complete). */
  confirmDisabled?: boolean;
  /** The sheet closes whenever this changes to a truthy value (e.g. the action's success state). */
  closeKey?: unknown;
  /** Overrides the automatic pending state (useFormStatus) when the caller tracks it. */
  pending?: boolean;
  className?: string;
};

function ConfirmButton({ label, tone, disabled, pendingOverride }: { label: string; tone: "danger" | "default"; disabled: boolean; pendingOverride?: boolean }) {
  const { pending } = useFormStatus();
  const loading = pendingOverride ?? pending;
  return (
    <Button type="submit" variant={tone === "danger" ? "danger" : "primary"} loading={loading} disabled={disabled || loading} fullWidth>
      {label}
    </Button>
  );
}

/**
 * Two-step confirm: a trigger opens a native modal <dialog> (bottom sheet on mobile, centered from 640px). It opens and
 * closes with CSS only (backdrop fade, sheet rise or centered spring pop; see `.overlay-dialog` in globals.css).
 */
export function ConfirmSheet({
  triggerLabel, triggerVariant = "secondary", triggerAriaLabel, title, description, confirmLabel, cancelLabel = "Cancelar",
  tone = "danger", confirmText, action, children, error, pending, className, confirmDisabled, closeKey,
}: ConfirmSheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const [typed, setTyped] = useState("");
  const uid = useId();
  const titleId = `${uid}-title`;
  const descId = `${uid}-desc`;
  const inputId = `${uid}-confirm`;
  const confirmed = !confirmText || matchesConfirmText(typed, confirmText.expected);

  useEffect(() => {
    if (closeKey) dialogRef.current?.close();
  }, [closeKey]);

  const open = () => {
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.showModal();
  };
  // Fires for Escape, the cancel button and backdrop clicks alike; the dialog already traps focus while modal.
  const onClosed = () => {
    setTyped("");
    openerRef.current?.focus();
  };

  return (
    <>
      <Button variant={triggerVariant} onClick={open} aria-haspopup="dialog" aria-label={triggerAriaLabel} className={className}>{triggerLabel}</Button>
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        aria-describedby={descId}
        onClose={onClosed}
        onClick={(event) => { if (event.target === dialogRef.current) dialogRef.current?.close(); }}
        className={cn(
          "overlay-dialog overlay-dialog--center",
          "m-0 mt-auto max-h-[90dvh] w-full max-w-none overflow-y-auto rounded-t-card border-(length:--bw-thick) border-border-soft bg-surface-1 p-0 text-fg shadow-(--elev-sheet)",
          "pb-[env(safe-area-inset-bottom)]",
          "sm:m-auto sm:max-w-md sm:rounded-card sm:pb-0",
        )}
      >
        <form action={action} className="grid gap-4 p-6">
          <h2 id={titleId} className="font-display text-h2 uppercase">{title}</h2>
          <div id={descId} className="text-body text-fg-muted">{description}</div>
          {confirmText && (
            <div className="grid gap-2">
              <label htmlFor={inputId} className="text-label font-bold">{confirmText.label}</label>
              <input
                id={inputId}
                name={confirmText.name}
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                aria-invalid={error ? true : undefined}
                className={controlClasses}
              />
            </div>
          )}
          {children}
          <Reveal live={false} className="[--reveal-gap:1rem]">{error && <StatusMessage tone="error">{error}</StatusMessage>}</Reveal>
          <div className="grid gap-3 sm:grid-cols-2 sm:[&>*:first-child]:order-2">
            <ConfirmButton label={confirmLabel} tone={tone} disabled={!confirmed || Boolean(confirmDisabled)} pendingOverride={pending} />
            <Button variant="secondary" fullWidth autoFocus={!confirmText} onClick={() => dialogRef.current?.close()}>{cancelLabel}</Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
