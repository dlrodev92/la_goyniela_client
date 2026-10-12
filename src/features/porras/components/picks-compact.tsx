import { TeamCrest } from "@/components/ui/team-crest";
import { cn } from "@/lib/cn";
import { rowText } from "../domain/logic";
import { SIGNS, type PicksSheet, type Sign } from "../domain/porras";
import type { BoletoFixture } from "./boleto";
import { ColumnsMatrix } from "./boleto/columns-matrix";

/**
 * Read-only mini ticket of one member: 14 rows with the marked 1/X/2 and the pleno. Same look as the boleto, much smaller.
 * A member who voted several columns (sencilla, Intuición) gets every column side by side instead.
 */
export function PicksCompact({ sheet, fixtures, memberName }: { sheet: PicksSheet; fixtures: readonly BoletoFixture[]; memberName: string }) {
  const rows = fixtures.filter(fixture => fixture.position >= 1 && fixture.position <= 14).sort((a, b) => a.position - b.position);
  const pleno = fixtures.find(fixture => fixture.position === 15);
  const byPosition = new Map(sheet.picks.map(pick => [pick.position, pick.signs]));
  const name = (full: string, short?: string | null) => short?.trim() || full;
  const multi = sheet.columnas.length > 1;
  const matrix = multi ? sheet.columnas.map(column => {
    const rowsOfColumn: Sign[][] = Array.from({ length: 14 }, () => []);
    for (const pick of column) if (pick.position >= 1 && pick.position <= 14) rowsOfColumn[pick.position - 1] = pick.signs;
    return rowsOfColumn;
  }) : null;
  return (
    <div className="rounded-control bg-cream p-3 text-ink">
      {matrix ? <ColumnsMatrix fixtures={fixtures} columns={matrix} /> : (
      <ol className="grid" aria-label={`Boleto de ${memberName}`}>
        {rows.map((fixture, index) => {
          const signs = byPosition.get(fixture.position) ?? [];
          return (
            <li key={fixture.position} className={cn("flex items-center gap-2 py-1", index % 2 === 0 && "bg-ink/[0.04]")}>
              <span className="sr-only">{rowText(fixture.position, fixture.homeName, fixture.awayName, signs)}</span>
              <span aria-hidden="true" className="w-6 text-center font-display text-label tabular-nums">{fixture.position}</span>
              <span aria-hidden="true" className="flex min-w-0 flex-1 items-center gap-1 text-meta font-bold">
                <TeamCrest name={fixture.homeName} logoUrl={fixture.homeLogoUrl} size="sm" className="size-4!" />
                <span className="truncate">{name(fixture.homeName, fixture.homeShort)}</span>
                <span className="text-ink/60">-</span>
                <TeamCrest name={fixture.awayName} logoUrl={fixture.awayLogoUrl} size="sm" className="size-4!" />
                <span className="truncate">{name(fixture.awayName, fixture.awayShort)}</span>
              </span>
              <span aria-hidden="true" className="flex shrink-0 gap-1">
                {SIGNS.map(sign => (
                  <span key={sign} className={cn("flex size-6 items-center justify-center rounded-control border border-ink/60 font-display text-label", signs.includes(sign) ? "bg-ink text-cream" : "text-ink/40")}>{sign}</span>
                ))}
              </span>
            </li>
          );
        })}
      </ol>
      )}
      <p className="mt-2 border-t-2 border-ink pt-2 text-label font-bold">
        Pleno al 15{pleno ? `: ${name(pleno.homeName, pleno.homeShort)} ${sheet.pleno?.home ?? "?"} - ${sheet.pleno?.away ?? "?"} ${name(pleno.awayName, pleno.awayShort)}` : sheet.pleno ? `: ${sheet.pleno.home} - ${sheet.pleno.away}` : ""}
      </p>
    </div>
  );
}
