import { AppLink } from "@/components/shell/app-link";
import { cn } from "@/lib/cn";
import type { MatchdayStatus } from "../../matchdays/domain/matchdays";
import { STATUS_FILTERS } from "../domain/jornadas";

/** Server-rendered filter chips: plain links, so they work without JavaScript. */
export function StatusChips({ selected }: { selected: MatchdayStatus | null }) {
  const chips = [{ href: "/jornadas", label: "Todas", active: selected === null },
    ...STATUS_FILTERS.map(filter => ({ href: `/jornadas?estado=${filter.status}`, label: filter.label, active: selected === filter.status }))];
  return (
    <nav aria-label="Filtrar jornadas por estado">
      <ul className="flex flex-wrap gap-2">
        {chips.map(chip => (
          <li key={chip.href}>
            <AppLink
              href={chip.href}
              indicator={false}
              aria-current={chip.active ? "page" : undefined}
              className={cn(
                "tap inline-flex min-h-touch items-center rounded-pill border-(length:--bw) px-4 text-label font-bold no-underline",
                chip.active ? "border-edge bg-action text-on-action shadow-hard-sm" : "border-border-soft bg-surface-1 text-fg hover-fine:bg-highlight hover-fine:text-on-action",
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
