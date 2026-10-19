import { cn } from "@/lib/cn";
import { formatEuro } from "@/lib/format-money";
import { columnasText } from "../../domain/modes";
import { GOALS, type Goals, type Pleno, type Sign } from "../../domain/porras";
import type { BoletoFixture } from "./boleto";
import { ColumnsMatrix } from "./columns-matrix";

type Props = {
  jornada: number;
  temporada?: string;
  fixtures: readonly BoletoFixture[];
  columns: readonly (readonly (readonly Sign[])[])[];
  pleno: Pleno;
  /** Apuestas played and their cost, as the API reports them. */
  apuestas: number;
  costEur: string;
  lockedRows?: readonly number[];
  stamp?: string | null;
  /** Sentence under the title; defaults to "Tu peña juega N columnas". */
  caption?: string;
  className?: string;
};

const nameOf = (full: string, short?: string | null) => short?.trim() || full;

/** Read-only official boleto with several printed columns (sencilla, Intuición): every column, the pleno and the cost. */
export function ColumnsSheet({ jornada, temporada, fixtures, columns, pleno, apuestas, costEur, lockedRows = [], stamp = "Boleto de la peña", caption, className }: Props) {
  const plenoMatch = fixtures.find(fixture => fixture.position === 15);
  const teams = [
    { role: "Local", name: plenoMatch ? nameOf(plenoMatch.homeName, plenoMatch.homeShort) : "Local", goals: pleno.home },
    { role: "Visitante", name: plenoMatch ? nameOf(plenoMatch.awayName, plenoMatch.awayShort) : "Visitante", goals: pleno.away },
  ] satisfies { role: string; name: string; goals: Goals }[];
  return (
    <div className={cn("@container w-full max-w-[60rem]", className)}>
      <section aria-label={`Boleto de la jornada ${jornada}`} className="boleto-paper relative grid gap-3 rounded-card border-(length:--bw-thick) border-ink bg-cream px-3 pb-5 pt-4 text-ink [filter:drop-shadow(6px_6px_0_var(--color-ink))] @md:px-6">
        {stamp && (
          <p className="absolute right-3 top-3 -rotate-6 border-2 border-double border-ink/70 px-2 py-0.5 font-display text-label uppercase tracking-widest text-ink/70 @md:right-6">{stamp}</p>
        )}
        <header className="grid gap-1 border-b-(length:--bw-thick) border-ink pb-3">
          <span aria-hidden="true" className="mb-1 block h-2.5 w-10 border-2 border-ink bg-signal" />
          <h2 className="font-display text-[2.75rem] uppercase leading-[0.9] text-ink">La Quiniela</h2>
          <p className="font-ui text-label font-bold uppercase tracking-wide">Jornada {jornada}{temporada ? ` · Temporada ${temporada}` : ""}</p>
          <p className="text-meta text-ink/80">{caption ?? `Tu peña juega ${columnasText(apuestas)}`}.</p>
        </header>
        <ColumnsMatrix fixtures={fixtures} columns={columns} lockedRows={lockedRows} />
        <fieldset className="border-2 border-ink p-3">
          <legend className="sr-only">Pleno al 15</legend>
          <p className="mb-2 font-display text-h2 uppercase" aria-hidden="true">Pleno al 15</p>
          <ul className="grid gap-1">
            {teams.map(team => (
              <li key={team.role} className="flex items-center justify-between gap-2 text-label">
                <span className="min-w-0 truncate font-bold"><span className="sr-only">{team.role}: </span>{team.name}</span>
                <span className="font-display text-h2 tabular-nums" aria-label={`${team.goals === "M" ? "3 o más" : team.goals} goles`}>{GOALS.includes(team.goals) ? team.goals : "·"}</span>
              </li>
            ))}
          </ul>
        </fieldset>
        <p className="text-label font-bold tabular-nums">{columnasText(apuestas)} · {formatEuro(costEur, { fixed: true }) ?? costEur}</p>
      </section>
    </div>
  );
}
