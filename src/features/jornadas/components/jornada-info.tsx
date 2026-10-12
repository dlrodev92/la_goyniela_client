import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { AnimatedNumber } from "@/components/motion/animated-number";
import { ProgressRing } from "@/components/ui/progress-ring";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusMessage } from "@/components/ui/status-message";
import { formatDateTime } from "@/lib/format-date";
import { EscrutinioTable } from "../../results/components/escrutinio-table";
import { hasPublishedPrizes, type LosillaJornada } from "../../results/domain/results";
import { mergeEstimates } from "../domain/estimates";
import type { Section } from "../../results/server/queries";
import type { MatchdayDetail } from "../../matchdays/domain/matchdays";
import { BoteCard } from "./bote-card";
import { PartidoCard } from "./partido-card";
import waiting from "../../../../public/waiting_image.png";

/**
 * Information of a jornada (dates, pool, matches with comments, official prizes) shared by `/jornadas/[id]` and the
 * porra page. Renders sibling cards: the parent decides the layout.
 */
export function JornadaInfo({ matchday, losilla }: { matchday: MatchdayDetail; losilla: Section<LosillaJornada> }) {
  const info = losilla.status === "ready" ? losilla.data : null;
  const byPosition = new Map((info?.matches ?? []).map(match => [match.position, match]));
  // Persisted `estimaciones` first, Losilla's live percentages for whatever they do not cover.
  const estimates = mergeEstimates(matchday.estimates, info?.matches ?? []);
  const escrutinio = info?.escrutinio ?? null;
  // Matches already played, only when Losilla published data (a missing feed is not "0 played").
  const played = info && matchday.fixtures.length > 0 ? matchday.fixtures.filter(fixture => byPosition.get(fixture.position)?.score).length : null;
  const dates = [
    { label: "Apertura de ventas", value: formatDateTime(matchday.saleOpensAt) },
    { label: "Cierre de votación", value: formatDateTime(matchday.votingClosesAt) },
    { label: "Primer partido", value: formatDateTime(matchday.firstKickoffAt) },
  ].filter((item): item is { label: string; value: string } => item.value !== null);

  return (
    <>
      <Card as="section" surface={1} aria-labelledby="fechas-heading" header={<h2 id="fechas-heading">Fechas</h2>}>
        {dates.length > 0 ? (
          <dl className="grid gap-3 sm:grid-cols-3">
            {dates.map(item => (
              <div key={item.label} className="grid gap-1 rounded-control bg-surface-2 p-3">
                <dt className="text-meta font-bold uppercase tracking-wider text-fg-muted">{item.label}</dt>
                <dd className="text-label font-bold">{item.value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-label text-fg-muted">Las fechas de esta jornada todavía no están publicadas.</p>
        )}
      </Card>

      {losilla.status === "unavailable" && <StatusMessage tone="error">No se pudo cargar la información de Losilla</StatusMessage>}

      {info?.bote && <BoteCard bote={info.bote} />}

      <Card as="section" surface={1} aria-labelledby="partidos-heading" header={
          <div className="flex items-center justify-between gap-3">
            <h2 id="partidos-heading">Partidos</h2>
            {played !== null && (
              <ProgressRing value={played} max={matchday.fixtures.length} label="Partidos jugados" size={56}>
                <span aria-hidden="true"><AnimatedNumber value={played} />/{matchday.fixtures.length}</span>
              </ProgressRing>
            )}
          </div>
        }>
        {matchday.fixtures.length === 0 ? (
          <EmptyState illustration={waiting} title="Partidos por publicar" description="Los partidos de esta jornada todavía no se han publicado." headingLevel={3} />
        ) : (
          <ol className="grid gap-3">
            {matchday.fixtures.map((fixture, index) => <PartidoCard key={fixture.position} fixture={fixture} losilla={byPosition.get(fixture.position)} estimate={estimates.get(fixture.position)} index={index} />)}
          </ol>
        )}
      </Card>

      {escrutinio && hasPublishedPrizes(escrutinio) && (
        <Card
          as="section" surface={1} aria-labelledby="prizes-heading"
          header={<div className="flex flex-wrap items-center justify-between gap-2"><h2 id="prizes-heading">Escrutinio oficial</h2>{escrutinio.estimated && <Badge tone="warning">Estimado</Badge>}</div>}
        >
          <EscrutinioTable escrutinio={escrutinio} />
        </Card>
      )}
    </>
  );
}
