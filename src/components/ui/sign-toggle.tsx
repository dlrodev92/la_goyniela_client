import { cn } from "@/lib/cn";

export type Sign = "1" | "X" | "2";
const SIGNS: readonly Sign[] = ["1", "X", "2"];

type SignToggleProps = {
  name: string;
  /** Accessible group name, e.g. "Pronóstico del partido 3: Barrio Norte contra Unión Sur". */
  legend: string;
  /** Hide the legend visually (it stays available to assistive tech). */
  legendHidden?: boolean;
  value: Sign | null;
  onChange?: (value: Sign) => void;
  disabled?: boolean;
  /** Per-option accessible names, e.g. { "1": "Gana Barrio Norte" }. Falls back to the sign. */
  optionLabels?: Partial<Record<Sign, string>>;
  className?: string;
};

/** 1/X/2 segmented radio group built on native radios: arrow keys and form posting work without JS. */
export function SignToggle({ name, legend, legendHidden, value, onChange, disabled, optionLabels, className }: SignToggleProps) {
  const selected = SIGNS.findIndex((sign) => sign === value);
  return (
    <fieldset disabled={disabled} className={cn("group min-w-0", className)}>
      <legend className={cn("mb-2 text-label font-bold text-fg", legendHidden && "sr-only")}>{legend}</legend>
      <div className="relative">
        {/* Track and sliding pill sit behind the native radios: 3 equal columns with a 0.5rem gap, so a step is 100% + gap. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 group-disabled:opacity-50">
          <div className="absolute inset-0 grid grid-cols-3 gap-2">
            {SIGNS.map((sign) => <span key={sign} className="rounded-control border-(length:--bw) border-border-soft bg-surface-1" />)}
          </div>
          <span
            data-visible={selected >= 0}
            className="sign-pill absolute inset-y-0 left-0 w-[calc((100%-1rem)/3)] rounded-control border-(length:--bw) border-edge bg-action"
            style={{ transform: `translateX(calc(${Math.max(selected, 0)} * (100% + 0.5rem)))` }}
          />
        </div>
        <div className="relative grid grid-cols-3 gap-2">
          {SIGNS.map((sign) => (
            <label key={sign} className="relative block">
              <input
                type="radio"
                name={name}
                value={sign}
                checked={value === sign}
                onChange={() => onChange?.(sign)}
                disabled={disabled}
                aria-label={optionLabels?.[sign]}
                className="peer absolute inset-0 m-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
              />
              <span
                className={cn(
                  "flex min-h-13 items-center justify-center rounded-control border-(length:--bw) border-transparent font-display text-h1 uppercase text-fg",
                  "tap-peer hover-fine:border-action",
                  "peer-checked:border-transparent peer-checked:text-on-action",
                  "peer-ring",
                  "peer-disabled:opacity-50",
                )}
              >
                {sign}
              </span>
            </label>
          ))}
        </div>
      </div>
    </fieldset>
  );
}
