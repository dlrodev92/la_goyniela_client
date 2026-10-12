import { cn } from "@/lib/cn";
import { progressPercent } from "@/lib/ui-text";

type ProgressProps = {
  value: number;
  max: number;
  /** Accessible name, e.g. "Partidos pronosticados". */
  label: string;
  /** Visible "n/max" text next to the bar. */
  showCount?: boolean;
  className?: string;
};

/** Stepped bar: one cell per unit (up to 20), otherwise a continuous fill. Decorative cells are aria-hidden. */
export function Progress({ value, max, label, showCount = true, className }: ProgressProps) {
  const percent = progressPercent(value, max);
  const safeMax = Math.max(0, Math.floor(max));
  const filled = Math.min(Math.max(Math.floor(value), 0), safeMax);
  const stepped = safeMax > 0 && safeMax <= 20;
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={safeMax}
        aria-valuenow={filled}
        aria-valuetext={`${filled} de ${safeMax}`}
        className="flex h-4 flex-1 gap-0.5"
      >
        {stepped ? (
          Array.from({ length: safeMax }, (_, i) => (
            <span key={i} className={cn("h-full flex-1 transition-colors duration-(--duration-base) ease-standard", i < filled ? "bg-action" : "bg-surface-3", "border-2 border-border-soft")} style={{ transitionDelay: `${Math.min(i, 20) * 12}ms` }} />
          ))
        ) : (
          <span className="h-full w-full border-2 border-border-soft bg-surface-3">
            <span className="block h-full bg-action transition-[width] duration-(--duration-slow) ease-enter" style={{ width: `${percent}%` }} />
          </span>
        )}
      </div>
      {showCount && <span className="text-label font-bold tabular-nums text-fg">{filled}/{safeMax}</span>}
    </div>
  );
}
