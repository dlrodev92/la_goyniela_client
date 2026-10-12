import type { Matchday } from "../../matchdays/domain/matchdays";
import { canVote, phaseOf } from "../../matchdays/domain/matchdays";
import { votingClosedMessage } from "../../matchdays/domain/matchday-state";
import type { Fixture, MatchEstimate, PlenoShares, SignPercentages } from "../../matchdays/domain/matchdays";
import type { LosillaJornada, Score } from "../../results/domain/results";
import { signOf } from "../../results/domain/results";
import { mergeEstimates } from "../../jornadas/domain/estimates";
import { scheduleLabel } from "../../jornadas/domain/jornadas";
import { percentValue } from "../../../lib/ui-text";

export { percentValue };
import { columnsFor, costFor, type PorraTerms } from "./logic";
import { reduccionOf, specColumns, specOf } from "./modes";
import { FALLBACK_PRECIO_APUESTA_EUR, type Porra } from "./porras";

export { columnasText as columnsLabel, porraFormatLabel } from "./modes";

type TotalsInput = Pick<Porra, "dobles" | "triples" | "columns" | "costEur" | "precioApuestaEur"> & Partial<Pick<Porra, "modo" | "fijos" | "columnas" | "reduccion">>;

/**
 * Columns and cost of a porra, straight from the API: its `columns` and `costEur` when present. Only for an API that
 * omits them do they derive from the mode (2^D x 3^T, the reduction's apuestas or the explicit columnas) times the
 * porra's price (the 0,75 fallback only when the porra has none). No client-side minimums.
 */
export function porraTotals(porra: TotalsInput): { columns: number; costEur: string } {
  const derived = porra.modo && porra.modo !== "multiple"
    ? specColumns(specOf({ modo: porra.modo, dobles: porra.dobles, triples: porra.triples, fijos: porra.fijos ?? null, columnas: porra.columnas ?? null, reduccion: porra.reduccion ?? null }))
    : columnsFor(porra.dobles, porra.triples);
  const columns = porra.columns > 0 ? porra.columns : derived;
  const costEur = porra.costEur || costFor(columns, porra.precioApuestaEur || FALLBACK_PRECIO_APUESTA_EUR) || "0.00";
  return { columns, costEur };
}

/** What the admin's editor checks a boleto against, taken from the porra as the API reports it. */
export function termsOf(porra: Porra): PorraTerms {
  const reduccion = porra.modo === "reducida" ? reduccionOf(porra.reduccion) : null;
  return {
    modo: porra.modo,
    dobles: reduccion?.dobles ?? porra.dobles,
    triples: reduccion?.triples ?? porra.triples,
    fijos: porra.fijos,
    columnas: porra.columnas,
    columns: porra.columns,
    costEur: porra.costEur,
    budgetEur: porra.budgetEur,
    precioApuestaEur: porra.precioApuestaEur,
  };
}

export type JornadaChoice<T> = { matchdayId: string; number: number; seasonLabel: string; items: T[] };

/**
 * Entries (a porra each) grouped by the active jornada they belong to, lowest jornada number first. Jornadas without
 * entries are dropped; entries of jornadas that are not in `matchdays` are ignored. More than one choice means the
 * user must be asked "¿Qué jornada quieres votar?".
 */
export function groupByJornada<T extends { porra: Pick<Porra, "jornadaId"> }>(
  matchdays: readonly Pick<Matchday, "id" | "number" | "seasonLabel">[],
  entries: readonly T[],
): JornadaChoice<T>[] {
  return [...matchdays]
    .sort((a, b) => a.number - b.number)
    .map(matchday => ({ matchdayId: matchday.id, number: matchday.number, seasonLabel: matchday.seasonLabel, items: entries.filter(entry => entry.porra.jornadaId === matchday.id) }))
    .filter(choice => choice.items.length > 0);
}

export type VotingGate = { open: boolean; reason: string | null };

/** Whether the member can still fill the boleto, and a Spanish reason when not. The jornada phase decides, not `porra.status`. */
export function votingGate(porra: Pick<Porra, "status">, matchday: Pick<Matchday, "status" | "saleOpensAt" | "votingClosesAt" | "effectivePhase" | "serverNow">, complete: boolean): VotingGate {
  if (porra.status === "closed") return { open: false, reason: "La porra está cerrada." };
  if (!canVote(phaseOf(matchday))) return { open: false, reason: votingClosedMessage(matchday) };
  if (!complete) return { open: false, reason: "Los partidos de la jornada todavía no están completos." };
  return { open: true, reason: null };
}

/** What the info drawer of the boleto shows for one match. All plain serializable data. */
export type MatchInfo = {
  position: number;
  home: string;
  away: string;
  schedule: string | null;
  comment: string | null;
  /** "2-1" style result, only when played. */
  result: string | null;
  resultSign: string | null;
  /** 1X2 shares of matches 1-14; null while neither the jornada nor Losilla publish them. */
  percentages: SignPercentages | null;
  /** Goals split of the pleno (match 15); null while unpublished. */
  pleno: PlenoShares | null;
};

function resultText(score: Score | null) {
  return score ? { result: `${score.home}-${score.away}`, resultSign: signOf(score) } : { result: null, resultSign: null };
}

/** `estimates` are the jornada's persisted percentages; they win over Losilla's live ones (see `mergeEstimates`). */
export function buildMatchInfo(fixtures: readonly Fixture[], losilla: LosillaJornada | null, estimates: readonly MatchEstimate[] = []): MatchInfo[] {
  const byPosition = new Map((losilla?.matches ?? []).map(match => [match.position, match]));
  const shares = mergeEstimates(estimates, losilla?.matches ?? []);
  return fixtures.map(fixture => {
    const extra = byPosition.get(fixture.position);
    const estimate = shares.get(fixture.position);
    return {
      position: fixture.position,
      home: fixture.homeShortName ?? fixture.home,
      away: fixture.awayShortName ?? fixture.away,
      schedule: scheduleLabel(extra, fixture.kickoffAt),
      comment: extra?.comment ?? null,
      ...resultText(extra?.score ?? null),
      percentages: estimate?.percentages ?? null,
      pleno: estimate?.pleno ?? null,
    };
  });
}
