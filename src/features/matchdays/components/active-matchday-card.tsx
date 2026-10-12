import { ArrowRight } from "@phosphor-icons/react/dist/ssr/ArrowRight";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Sticker } from "@/components/ui/sticker";
import { StatusMessage } from "@/components/ui/status-message";
import { matchdayStateLabel } from "./matchday-state";
import { canVote, phaseOf, type Matchday } from "../domain/matchdays";
import { loadActiveMatchdays } from "../server/queries";
import { ServiceError } from "../../../lib/http/errors";
import { formatDateTime } from "../../../lib/format-date";

import scoreAsset from "../../../../public/asset_score.png";
import ticketAsset from "../../../../public/asset_ticket.png";

/** Placeholder with the card, spacing and line heights of the real hero card, so the swap does not move anything. */
export function ActiveMatchdayCardSkeleton() {
  return (
    <Card surface={1} padding="lg" aria-busy="true">
      <Skeleton variant="line" className="h-6 w-28" />
      <div className="grid gap-1">
        <Skeleton variant="line" className="h-4 w-20" />
        <Skeleton variant="line" className="h-20 w-1/2" />
        <Skeleton variant="line" className="h-5 w-1/3" />
        <Skeleton variant="line" className="h-6 w-1/2" />
      </div>
      <Skeleton variant="block" className="h-11" />
    </Card>
  );
}

/** Hero card for one active matchday: a huge jornada numeral, the deadline and the link to the quiniela entry point. */
function MatchdayHero({ matchday }: { matchday: Matchday }) {
  const phase = phaseOf(matchday);
  const open = canVote(phase);
  const closes = formatDateTime(matchday.votingClosesAt);
  const opens = formatDateTime(matchday.saleOpensAt);
  return (
    <Card surface={1} padding="lg" pixelCorner sticker={<Sticker src={ticketAsset} width={104} tilt={8} className="absolute -right-3 -top-8" />}>
      <div className="flex flex-wrap items-center gap-2 pr-20">
        <Badge tone={open ? "action" : "neutral"}>{matchdayStateLabel(matchday)}</Badge>
      </div>
      <div className="grid gap-1">
        <p className="label-meta text-fg-muted">Jornada</p>
        <p className="font-display text-[clamp(4.5rem,24vw,7rem)] uppercase leading-[0.82] tabular-nums">{matchday.number}</p>
        <p className="label-meta border-t-(length:--bw) border-border-soft pt-2 text-fg-muted">{matchday.seasonLabel}</p>
        {phase === "lista_abre_pronto" && opens && <p className="text-body">La venta abre el <span className="font-bold">{opens}</span></p>}
        {phase !== "lista_abre_pronto" && closes && <p className="text-body">{open ? "Cierra el" : "Cerró el"} <span className="font-bold">{closes}</span></p>}
      </div>
      <Button href="/quiniela" fullWidth size="lg" trailingIcon={<ArrowRight size={20} weight="bold" aria-hidden="true" />}>
        Ir a la quiniela
      </Button>
    </Card>
  );
}

/** Hero cards for every active matchday (dashboard; normally one): link to the quiniela entry point and make no per-group calls. */
export async function ActiveMatchdayCard() {
  let matchdays: Matchday[];
  try {
    matchdays = await loadActiveMatchdays();
  } catch (error) {
    if (!(error instanceof ServiceError)) throw error;
    return <StatusMessage tone="error">No hemos podido cargar la jornada ahora mismo. Inténtalo de nuevo más tarde.</StatusMessage>;
  }
  if (matchdays.length === 0) {
    return (
      <Card surface={1} padding="lg" sticker={<Sticker src={scoreAsset} width={112} tilt={-6} className="absolute -right-3 -top-7" />}>
        <p className="max-w-[16ch] font-display text-h1 uppercase leading-[0.95]">Todavía no hay jornada abierta</p>
        <p className="text-label text-fg-muted">Cuando se abra la próxima jornada podrás votar aquí.</p>
      </Card>
    );
  }
  return (
    <div className="grid gap-4">
      {[...matchdays].sort((a, b) => a.number - b.number).map(matchday => <MatchdayHero key={matchday.id} matchday={matchday} />)}
    </div>
  );
}
