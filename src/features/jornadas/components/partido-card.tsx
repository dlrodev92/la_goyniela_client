import type { CSSProperties } from "react";
import { Badge } from "@/components/ui/badge";
import { PlenoShareBars, SignShareBars } from "@/components/ui/share-bars";
import { TeamCrest } from "@/components/ui/team-crest";
import { cn } from "@/lib/cn";
import type { Fixture, MatchEstimate } from "../../matchdays/domain/matchdays";
import { PLENO_POSITION } from "../../porras/domain/porras";
import { signOf, type LosillaMatch } from "../../results/domain/results";
import { scheduleLabel } from "../domain/jornadas";

function Team({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  return (
    <span className="flex min-w-0 flex-col items-center gap-1.5 text-center text-label font-bold leading-tight">
      <TeamCrest name={name} logoUrl={logoUrl} size="md" />
      <span className="min-w-0 break-words">{name}</span>
    </span>
  );
}

/** One match of the jornada: schedule, crests, score when played and the editorial comment. */
export function PartidoCard({ fixture, losilla, estimate, index = 0 }: {
  fixture: Fixture;
  losilla: LosillaMatch | undefined;
  /** Merged live percentages of this match (see `mergeEstimates`); absent when nobody published them. */
  estimate?: MatchEstimate;
  /** Position in the list: drives the staggered entrance. */
  index?: number;
}) {
  const isPleno = fixture.position === PLENO_POSITION;
  const home = fixture.homeShortName ?? fixture.home;
  const away = fixture.awayShortName ?? fixture.away;
  const schedule = scheduleLabel(losilla, fixture.kickoffAt);
  const score = losilla?.score ?? null;
  const resultText = score ? `${score.home} a ${score.away}, signo ${signOf(score)}` : "sin jugar";
  return (
    <li className={cn("stagger-in grid gap-3 rounded-card border-(length:--bw) bg-surface-1 p-3", isPleno ? "border-action" : "border-border-soft")} style={{ "--i": index } as CSSProperties}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-display text-meta uppercase text-fg-muted tabular-nums">Partido {fixture.position}</span>
        <span className="flex items-center gap-2">
          {isPleno && <Badge tone="action">Pleno al 15</Badge>}
          <span className="text-label font-bold text-fg">{schedule ?? "Horario por confirmar"}</span>
        </span>
      </div>
      <p className="sr-only">{home} contra {away}, {resultText}.</p>
      <div aria-hidden="true" className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
        <Team name={home} logoUrl={fixture.homeLogoUrl} />
        <span className="grid min-w-16 justify-items-center gap-1 rounded-control border border-border-soft bg-ink px-2 py-2">
          {score ? (
            <>
              <span className="font-display text-h2 leading-none text-cream tabular-nums">{score.home}-{score.away}</span>
              {!isPleno && <span className="rounded-pill bg-surface-3 px-2 text-meta font-bold">{signOf(score)}</span>}
            </>
          ) : (
            <span className="text-meta font-bold uppercase text-cream">vs</span>
          )}
        </span>
        <Team name={away} logoUrl={fixture.awayLogoUrl} />
      </div>
      {(isPleno ? estimate?.pleno : estimate?.percentages) && (
        <section aria-label="Porcentajes de Losilla" className="grid gap-2 rounded-control bg-surface-2 px-3 py-3">
          <h3 className="text-meta font-bold uppercase tracking-wider text-fg-muted">Porcentajes de Losilla</h3>
          {isPleno && estimate?.pleno ? (
            <PlenoShareBars home={estimate.pleno.home} away={estimate.pleno.away} homeName={home} awayName={away} />
          ) : estimate?.percentages ? (
            <SignShareBars percentages={estimate.percentages} />
          ) : null}
        </section>
      )}
      {losilla?.comment && (
        <details className="group rounded-control bg-surface-2 px-3 py-2">
          <summary className="flex min-h-touch cursor-pointer list-none items-center text-label font-bold text-action transition-colors duration-(--duration-fast) hover-fine:text-highlight [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">Ver comentario</span>
            <span className="hidden group-open:inline">Ocultar comentario</span>
          </summary>
          <p className="pb-1 text-label leading-relaxed text-fg-muted">{losilla.comment}</p>
        </details>
      )}
    </li>
  );
}
