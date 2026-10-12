import { cn } from "@/lib/cn";
import { percentValue } from "@/lib/ui-text";

type Shares = { one: number; x: number; two: number };
type Split = Partial<Record<"0" | "1" | "2" | "M", number>>;

const SIGNS = [["1", "one"], ["X", "x"], ["2", "two"]] as const;
const GOALS = ["0", "1", "2", "M"] as const;

function Bar({ value, strong }: { value: number; strong: boolean }) {
  return (
    <span aria-hidden="true" className="block h-3 overflow-hidden rounded-pill border-2 border-border-soft bg-surface-3">
      <span
        className={cn("block h-full rounded-pill transition-[width] duration-(--duration-slow) ease-enter", strong ? "bg-action" : "bg-secondary/70")}
        style={{ width: `${value}%` }}
      />
    </span>
  );
}

/** Share of votes per sign (1 / X / 2) as three labelled bars. The top share is highlighted. */
export function SignShareBars({ percentages, className }: { percentages: Shares; className?: string }) {
  const values = SIGNS.map(([label, key]) => ({ label, value: percentValue(percentages[key]) }));
  const top = Math.max(...values.map(item => item.value));
  return (
    <ul className={cn("grid grid-cols-3 gap-3", className)}>
      {values.map(({ label, value }) => (
        <li key={label} className="grid gap-1">
          <span className="flex items-baseline justify-between gap-1 text-label">
            <span className="font-display text-h2 leading-none">{label}</span>
            <span className={cn("font-bold tabular-nums", value === top ? "text-action" : "text-fg-muted")}>{value} %</span>
          </span>
          <Bar value={value} strong={value === top} />
        </li>
      ))}
    </ul>
  );
}

function SplitColumn({ name, split }: { name: string; split: Split }) {
  const shown = GOALS.filter(goal => split[goal] !== undefined);
  const top = Math.max(...shown.map(goal => percentValue(split[goal] ?? 0)));
  return (
    <div className="grid min-w-0 content-start gap-2">
      <p className="break-words text-meta font-bold uppercase tracking-wider text-fg-muted">{name}</p>
      <ul className="grid gap-1.5">
        {shown.map(goal => {
          const value = percentValue(split[goal] ?? 0);
          return (
            <li key={goal} className="grid grid-cols-[1.25rem_minmax(0,1fr)_2.75rem] items-center gap-2 text-label">
              <span className="font-display leading-none">{goal}</span>
              <Bar value={value} strong={value === top} />
              <span className="text-right font-bold tabular-nums">{value} %</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Goals split of the pleno al 15, one column per side (0, 1, 2 and M = 3 or more goals). */
export function PlenoShareBars({ home, away, homeName, awayName, className }: { home: Split; away: Split; homeName: string; awayName: string; className?: string }) {
  return (
    <div className={cn("grid gap-2", className)}>
      <div className="grid gap-4 sm:grid-cols-2">
        <SplitColumn name={homeName} split={home} />
        <SplitColumn name={awayName} split={away} />
      </div>
      <p className="text-meta text-fg-muted">M: tres goles o más.</p>
    </div>
  );
}
