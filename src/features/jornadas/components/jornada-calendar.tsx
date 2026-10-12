import type { CSSProperties, ReactNode } from "react";
import { CalendarBlank } from "@phosphor-icons/react/dist/ssr/CalendarBlank";
import { AppLink } from "@/components/shell/app-link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/cn";
import type { Matchday } from "../../matchdays/domain/matchdays";
import { matchdayStateLabel, matchdayStateTone } from "../../matchdays/components/matchday-state";
import { calendarDayOfMatchday, DATE_TO_CONFIRM } from "../domain/calendar";

/** Two binder holes on the top band: the "tear-off calendar" cue. */
function Holes() {
  return (
    <>
      <span aria-hidden="true" className="absolute left-3 top-1.5 size-2 rounded-pill bg-canvas/70" />
      <span aria-hidden="true" className="absolute right-3 top-1.5 size-2 rounded-pill bg-canvas/70" />
    </>
  );
}

/**
 * US-style tear-off day card of one upcoming jornada: weekday band, big day, month, then jornada and state.
 * `href` overrides the default jornada link (`null` renders a non-link card); `footer` adds extra badges under the state.
 */
export function JornadaCalendarCard({ matchday, href, footer }: { matchday: Matchday; href?: string | null; footer?: ReactNode }) {
  const day = calendarDayOfMatchday(matchday);
  const dated = day !== null;
  const target = href === undefined ? `/jornadas/${matchday.id}` : href;
  const label = `Jornada ${matchday.number}, ${day ? `${day.weekday} ${day.day} ${day.month}` : DATE_TO_CONFIRM}`;
  const article = (
    <article className="fx-card relative grid h-full grid-rows-[auto_1fr_auto] overflow-hidden rounded-card border border-border-soft bg-surface-1">
      <div className={cn("relative px-3 py-2 text-center font-display text-label uppercase tracking-[0.2em]", dated ? "bg-action text-on-action" : "bg-surface-3 text-fg-muted")}>
        <Holes />
        <span aria-hidden="true">{day ? day.weekday : "···"}</span>
      </div>
      <div className="grid content-center justify-items-center gap-1 px-3 py-4 text-center">
        {day ? (
          <>
            <span aria-hidden="true" className="font-display text-display leading-none tabular-nums">{day.day}</span>
            <span aria-hidden="true" className="font-display text-h2 uppercase leading-none text-secondary">{day.month}</span>
          </>
        ) : (
          <>
            <CalendarBlank size={40} weight="duotone" aria-hidden="true" className="text-fg-muted" />
            <span className="text-label font-bold text-fg-muted">{DATE_TO_CONFIRM}</span>
          </>
        )}
      </div>
      <div className="grid justify-items-center gap-2 border-t-2 border-dashed border-border-soft px-3 py-3 text-center">
        <p className="font-display text-h2 uppercase leading-none tabular-nums">Jornada {matchday.number}</p>
        <Badge tone={matchdayStateTone(matchday)}>{matchdayStateLabel(matchday)}</Badge>
        {footer && <div className="flex flex-wrap justify-center gap-1.5">{footer}</div>}
      </div>
    </article>
  );
  if (target === null) return <div role="group" aria-label={label} className="block h-full rounded-card text-fg">{article}</div>;
  return (
    <AppLink href={target} transitionTypes={["nav-forward"]} aria-label={label} className="tap block h-full rounded-card text-fg no-underline [--press-scale:0.97]">
      {article}
    </AppLink>
  );
}

/** Mobile: a snap-scrolling row that bleeds to the screen edges. From `sm` up: a grid. */
export function JornadaCalendarRow({ matchdays, hrefFor, footerFor }: {
  matchdays: readonly Matchday[];
  /** Per-card link override (`null` = not a link). Defaults to the jornada page. */
  hrefFor?: (matchday: Matchday) => string | null;
  /** Extra badges under the state of each card. */
  footerFor?: (matchday: Matchday) => ReactNode;
}) {
  return (
    <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 [&::-webkit-scrollbar]:hidden">
      {matchdays.map((matchday, index) => (
        <li key={matchday.id} className="stagger-in w-40 shrink-0 snap-start sm:w-auto" style={{ "--i": index } as CSSProperties}>
          <JornadaCalendarCard matchday={matchday} href={hrefFor?.(matchday)} footer={footerFor?.(matchday)} />
        </li>
      ))}
    </ul>
  );
}

/** Nothing is open: a ghost calendar card and a short promise, so the page never reads as broken or blank. */
export function JornadaCalendarEmpty({
  title = "No hay jornadas abiertas",
  description = "Cuando se abra la próxima jornada aparecerá aquí, con su fecha y su estado.",
}: { title?: string; description?: string } = {}) {
  return (
    <Card surface={1} padding="lg" className="reveal-in justify-items-center">
      <div aria-hidden="true" className="grid w-28 overflow-hidden rounded-card border-2 border-dashed border-border-soft">
        <div className="bg-surface-3 py-1.5 text-center font-display text-meta uppercase tracking-[0.2em] text-fg-muted">···</div>
        <div className="grid justify-items-center gap-1 px-3 py-4">
          <CalendarBlank size={36} weight="duotone" className="text-fg-muted" />
          <span className="font-display text-label uppercase text-fg-muted">Próxima</span>
        </div>
      </div>
      <EmptyState title={title} description={description} />
    </Card>
  );
}
