import { CaretRight } from "@phosphor-icons/react/dist/ssr/CaretRight";
import { AppLink } from "@/components/shell/app-link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { Matchday } from "../../matchdays/domain/matchdays";
import { matchdayStateLabel, matchdayStateTone } from "../../matchdays/components/matchday-state";
import { keyDateOf } from "../domain/jornadas";

export function JornadaCard({ matchday }: { matchday: Matchday }) {
  const keyDate = keyDateOf(matchday);
  return (
    <AppLink
      href={`/jornadas/${matchday.id}`}
      transitionTypes={["nav-forward"]}
      className="tap block rounded-card text-fg no-underline [--press-scale:0.985]"
    >
      <Card surface={1} padding="md" interactive className="grid-cols-[1fr_auto] items-center gap-3">
        <div className="grid min-w-0 gap-2">
          <p className="font-display text-h2 uppercase tabular-nums">Jornada {matchday.number}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-label text-fg-muted">{matchday.seasonLabel}</span>
            <Badge tone={matchdayStateTone(matchday)}>{matchdayStateLabel(matchday)}</Badge>
          </div>
          {keyDate && <p className="text-label text-fg-muted">{keyDate.label}: <span className="font-bold text-fg">{keyDate.value}</span></p>}
        </div>
        <CaretRight size={24} weight="bold" aria-hidden="true" className="text-action" />
      </Card>
    </AppLink>
  );
}
