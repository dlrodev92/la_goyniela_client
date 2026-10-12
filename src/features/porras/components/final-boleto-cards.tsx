import { CaretRight } from "@phosphor-icons/react/dist/ssr/CaretRight";
import { AppLink } from "@/components/shell/app-link";
import { Card } from "@/components/ui/card";
import { Sticker } from "@/components/ui/sticker";
import { loadMyGroups } from "@/features/groups/server/queries";
import { loadActiveMatchdays } from "@/features/matchdays/server/queries";
import { ServiceError } from "@/lib/http/errors";
import footballAsset from "../../../../public/asset_football.png";
import { porraFormatLabel } from "../domain/porra-view";
import { loadPorrasOfGroups } from "../server/queries";

/** "Boleto de tu peña": one link per porra of the caller's peñas whose admin already confirmed the boleto, in any active jornada. */
export async function FinalBoletoCards() {
  let items: { groupId: string; name: string; porraId: string; format: string; jornada: number }[] = [];
  try {
    const [groups, matchdays] = await Promise.all([loadMyGroups(), loadActiveMatchdays()]);
    if (matchdays.length === 0 || groups.length === 0) return null;
    const names = new Map(groups.map(group => [group.id, group.name]));
    const numbers = new Map(matchdays.map(matchday => [matchday.id, matchday.number]));
    // One request per peña (no jornada filter), then keep the porras of the active jornadas.
    const entries = await loadPorrasOfGroups(groups.map(group => group.id));
    items = entries
      .filter(entry => entry.porra.hasBoleto && numbers.has(entry.porra.jornadaId))
      .map(({ groupId, porra }) => ({ groupId, name: names.get(groupId) ?? "tu peña", porraId: porra.id, format: porraFormatLabel(porra), jornada: numbers.get(porra.jornadaId) ?? 0 }))
      .sort((a, b) => a.jornada - b.jornada);
  } catch (error) {
    if (!(error instanceof ServiceError)) throw error;
    return null;
  }
  if (items.length === 0) return null;
  return (
    <Card as="section" surface={1} padding="lg" pixelCorner sticker={<Sticker src={footballAsset} width={80} tilt={-10} className="absolute -right-3 -top-7" />} aria-labelledby="final-boleto-heading" header={<h2 id="final-boleto-heading" className="pr-16 leading-none">{items.length === 1 ? "Boleto de tu peña" : "Boletos de tus peñas"}</h2>}>
      <ul className="grid gap-3">
        {items.map(item => (
          <li key={item.porraId}>
            <AppLink
              href={`/groups/${item.groupId}/porras/${item.porraId}/final`}
              transitionTypes={["nav-forward"]}
              className="fx-row flex min-h-touch items-center justify-between gap-3 rounded-control border-(length:--bw) border-border-soft bg-surface-2 px-4 py-3 text-fg no-underline"
            >
              <span className="grid min-w-0 gap-1">
                <span className="break-words font-bold">Ver el boleto de {item.name}</span>
                <span className="text-label text-fg-muted">Jornada {item.jornada} · {item.format}</span>
              </span>
              <CaretRight size={20} weight="bold" aria-hidden="true" className="shrink-0 text-action" />
            </AppLink>
          </li>
        ))}
      </ul>
    </Card>
  );
}
