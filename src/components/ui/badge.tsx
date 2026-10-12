import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type BadgeTone = "neutral" | "action" | "success" | "warning" | "danger" | "outline";

const tones: Record<BadgeTone, string> = {
  neutral: "bg-surface-3 text-fg border-edge",
  action: "bg-action text-on-action border-edge",
  success: "bg-success text-on-success border-edge",
  warning: "bg-warning text-on-warning border-edge",
  danger: "bg-danger text-on-danger border-edge",
  outline: "bg-transparent text-fg border-border-soft",
};

export function Badge({ tone = "neutral", icon, className, children }: { tone?: BadgeTone; icon?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <span className={cn("inline-flex min-h-6 items-center gap-1 rounded-pill border-(length:--bw) px-2 text-meta font-bold uppercase tracking-wider", tones[tone], className)}>
      {icon}
      {children}
    </span>
  );
}
