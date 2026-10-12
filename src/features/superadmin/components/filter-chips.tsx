import { AppLink } from "@/components/shell/app-link";
import { cn } from "@/lib/cn";

export type FilterChip = { href: string; label: string; active: boolean };

/** Compact link chips for toggles and filters (state lives in the URL, so it survives reloads and works without JS). */
export function FilterChips({ label, chips }: { label: string; chips: FilterChip[] }) {
  return (
    <nav aria-label={label}>
      <ul className="flex flex-wrap gap-1">
        {chips.map(chip => (
          <li key={chip.href}>
            <AppLink
              href={chip.href}
              scroll={false}
              indicator={false}
              aria-current={chip.active ? "true" : undefined}
              className={cn(
                "tap inline-flex h-8 items-center rounded-md border px-2.5 text-label no-underline [--press-scale:0.97] md:h-7",
                chip.active ? "border-border-soft bg-surface-3 font-medium text-fg" : "border-transparent text-fg-muted hover-fine:bg-surface-2 hover-fine:text-fg",
              )}
            >
              {chip.label}
            </AppLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** `/path?a=1&b=2` from the defined, non-empty params. */
export function hrefWith(path: string, params: Record<string, string | number | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== null && value !== undefined && value !== "") search.set(key, String(value));
  const text = search.toString();
  return text ? `${path}?${text}` : path;
}
