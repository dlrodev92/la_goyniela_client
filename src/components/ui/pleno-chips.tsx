import { cn } from "@/lib/cn";

export type PlenoOption = { value: string; label: string; disabled?: boolean };

type PlenoChipsProps = {
  name: string;
  legend: string;
  legendHidden?: boolean;
  options: readonly PlenoOption[];
  values: readonly string[];
  onToggle?: (value: string, checked: boolean) => void;
  disabled?: boolean;
  className?: string;
};

/** Checkbox chip group (e.g. the goals of one side of the pleno al 15: 0, 1, 2 or M = three or more). Native checkboxes: keyboard and form posting for free. */
export function PlenoChips({ name, legend, legendHidden, options, values, onToggle, disabled, className }: PlenoChipsProps) {
  return (
    <fieldset disabled={disabled} className={cn("min-w-0", className)}>
      <legend className={cn("mb-2 text-label font-bold text-fg", legendHidden && "sr-only")}>{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <label key={option.value} className="relative block">
            <input
              type="checkbox"
              name={name}
              value={option.value}
              checked={values.includes(option.value)}
              onChange={(event) => onToggle?.(option.value, event.target.checked)}
              disabled={disabled || option.disabled}
              className="peer absolute inset-0 m-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
            />
            <span
              className={cn(
                "inline-flex min-h-touch min-w-16 items-center justify-center rounded-pill border-(length:--bw) border-border-soft bg-surface-1 px-4 text-label font-bold text-fg",
                "tap-peer hover-fine:border-action peer-checked:border-edge peer-checked:bg-action peer-checked:text-on-action",
                "peer-ring",
                "peer-disabled:opacity-50",
              )}
            >
              {option.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
