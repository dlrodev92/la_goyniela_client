"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { PanelButton } from "./panel-ui";

/**
 * Lightweight confirm that lives in the page flow right under the thing it confirms (no sheet, no overlay).
 * The error of the action is shown here, next to the buttons.
 */
export function InlineConfirm({ action, pending, message, confirmLabel, tone = "default", error, onCancel, children, className }: {
  action: (formData: FormData) => void; pending: boolean; message: ReactNode; confirmLabel: string; tone?: "default" | "danger";
  error?: string; onCancel: () => void; children?: ReactNode; className?: string;
}) {
  return (
    <form
      action={action}
      onKeyDown={event => { if (event.key === "Escape") onCancel(); }}
      className={cn("grid gap-2 rounded-md border border-border-soft bg-surface-2 p-3", tone === "danger" && "border-danger/40", className)}
    >
      <div className="text-label text-fg">{message}</div>
      {children}
      {error && <p role="alert" className="text-label text-danger">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <PanelButton type="submit" variant={tone === "danger" ? "danger" : "primary"} loading={pending}>{confirmLabel}</PanelButton>
        <PanelButton variant="ghost" onClick={onCancel} disabled={pending}>Cancelar</PanelButton>
      </div>
    </form>
  );
}
