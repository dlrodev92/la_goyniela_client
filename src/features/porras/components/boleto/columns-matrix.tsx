"use client";

import { cn } from "@/lib/cn";
import { MATCH_COUNT, type Sign } from "../../domain/porras";
import type { BoletoFixture } from "./boleto";

type Props = {
  fixtures: readonly BoletoFixture[];
  /** `columns[c][r]`: signs marked on match r+1 of column c. */
  columns: readonly (readonly (readonly Sign[])[])[];
  /** Highlighted column (0-based); with `onSelect` its header becomes a button. */
  activeIndex?: number;
  onSelect?: (index: number) => void;
  /** These matches (1-based) are Intuición fijos, drawn with an ink background. */
  lockedRows?: readonly number[];
  className?: string;
};

const nameOf = (full: string, short?: string | null) => short?.trim() || full;

/**
 * All the columns of a boleto at a glance: one row per match, one narrow cell per column. It scrolls sideways inside its
 * own box (the match column stays put), so twelve columns never widen the page.
 */
export function ColumnsMatrix({ fixtures, columns, activeIndex, onSelect, lockedRows = [], className }: Props) {
  const rows = fixtures.filter(fixture => fixture.position >= 1 && fixture.position <= MATCH_COUNT).sort((a, b) => a.position - b.position);
  return (
    <div role="region" aria-label="Resumen de todas las columnas" tabIndex={0} className={cn("overflow-x-auto rounded-control border border-ink/40 bg-cream text-ink", className)}>
      <table className="w-full border-collapse text-meta tabular-nums">
        <caption className="sr-only">Signos de cada partido en cada columna del boleto</caption>
        <thead>
          <tr>
            <th scope="col" className="sticky left-0 z-10 min-w-24 bg-cream px-2 py-1 text-left font-bold uppercase tracking-wide">Partido</th>
            {columns.map((_, index) => (
              <th key={index} scope="col" className={cn("px-0.5 py-0.5 text-center font-bold", activeIndex === index && "bg-ink/10")}>
                {onSelect ? (
                  <button
                    type="button"
                    onClick={() => onSelect(index)}
                    aria-label={`Columna ${index + 1}`}
                    aria-pressed={activeIndex === index}
                    className="tap flex min-h-touch min-w-8 items-center justify-center rounded-control font-bold hover-fine:bg-ink/10"
                  >
                    {index + 1}
                  </button>
                ) : (
                  <span className="block min-w-7 px-1 py-1"><span className="sr-only">Columna </span>{index + 1}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((fixture, rowIndex) => (
            <tr key={fixture.position} className={cn("border-t border-ink/20", rowIndex % 2 === 0 && "bg-ink/[0.04]")}>
              <th scope="row" className="sticky left-0 z-10 max-w-32 bg-cream px-2 py-1 text-left font-bold">
                <span className="flex items-baseline gap-1">
                  <span>{fixture.position}</span>
                  <span className="truncate font-normal text-ink/80">{nameOf(fixture.homeName, fixture.homeShort)}–{nameOf(fixture.awayName, fixture.awayShort)}</span>
                </span>
              </th>
              {columns.map((rowsOfColumn, index) => {
                const signs = rowsOfColumn[fixture.position - 1] ?? [];
                return (
                  <td key={index} className={cn("px-0.5 py-1 text-center font-bold", activeIndex === index && "bg-ink/10", lockedRows.includes(fixture.position) && "bg-ink/15")}>
                    {signs.length > 0 ? signs.join("") : <span aria-label="sin marcar" className="text-ink/40">·</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
