import type { ReactNode } from "react";
import { CheckCircle } from "@phosphor-icons/react/dist/ssr/CheckCircle";
import { Info } from "@phosphor-icons/react/dist/ssr/Info";
import { WarningCircle } from "@phosphor-icons/react/dist/ssr/WarningCircle";
import { cn } from "@/lib/cn";

export type StatusTone = "info" | "success" | "error";

const tones: Record<StatusTone, { box: string; accent: string; icon: typeof Info }> = {
  info: { box: "border-border-soft", accent: "text-action", icon: Info },
  success: { box: "border-success", accent: "text-success", icon: CheckCircle },
  error: { box: "border-danger", accent: "text-danger", icon: WarningCircle },
};

type StatusMessageProps = { tone?: StatusTone; showIcon?: boolean; id?: string; className?: string; children: ReactNode };

/** error uses role="alert" (assertive); info and success use role="status" (polite). */
export function StatusMessage({ tone = "info", showIcon = true, id, className, children }: StatusMessageProps) {
  const { box, accent, icon: Icon } = tones[tone];
  return (
    <div id={id} role={tone === "error" ? "alert" : "status"} className={cn("flex items-start gap-3 rounded-control border-(length:--bw) bg-surface-1 px-4 py-3 text-label text-fg shadow-hard-sm", box, className)}>
      {showIcon && <Icon size={20} weight="fill" aria-hidden="true" className={cn("mt-0.5 shrink-0", accent)} />}
      <div className="min-w-0 break-words">{children}</div>
    </div>
  );
}
