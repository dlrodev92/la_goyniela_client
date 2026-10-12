import { AnimatedNumber } from "@/components/motion/animated-number";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { formatEuro } from "@/lib/format-money";
import type { EffectivePhase } from "@/features/matchdays/domain/matchdays";
import { porraLifecycle } from "../domain/lifecycle";
import { columnsLabel, porraFormatLabel, porraTotals } from "../domain/porra-view";
import { PorraLifecycleBadge } from "./porra-lifecycle-badge";
import type { PicksView, PorraDetail } from "../domain/porras";

type Props = {
  groupName: string;
  jornada: number;
  temporada: string;
  porra: PorraDetail;
  /** Phase of the porra's jornada: it decides the state shown, not `porra.status`. */
  phase: EffectivePhase;
  /** Voters with their avatar, when the participation list loaded. */
  view: PicksView | null;
  avatars: Record<string, string | null>;
};

const MAX_AVATARS = 8;

/** Header card of the porra: peña, jornada, format, columns, cost, budget, state and participation. */
export function PorraHeader({ groupName, jornada, temporada, porra, phase, view, avatars }: Props) {
  const voted = view ? view.members.filter(member => member.voted) : [];
  const votedCount = porra.participation?.voted ?? voted.length;
  const total = porra.participation?.totalMembers ?? view?.members.length ?? 0;
  const totals = porraTotals(porra);
  const stats = [
    { label: "Formato", value: porraFormatLabel(porra) },
    { label: "Columnas", value: columnsLabel(totals.columns) },
    { label: "Coste", value: formatEuro(totals.costEur, { fixed: true }) ?? totals.costEur },
    { label: "Presupuesto", value: formatEuro(porra.budgetEur, { fixed: true }) ?? porra.budgetEur },
  ];
  return (
    <Card as="section" surface={2} padding="lg" pixelCorner aria-labelledby="porra-heading">
      <div className="flex flex-wrap items-center gap-2">
        <PorraLifecycleBadge state={porraLifecycle({ phase, hasBoleto: porra.hasBoleto, status: porra.status })} />
        <span className="text-label text-fg-muted">Temporada {temporada}</span>
      </div>
      <div className="grid gap-1">
        <h2 id="porra-heading" className="break-words font-display text-h1 uppercase">Porra de {groupName}</h2>
        <p className="text-label text-fg-muted">Jornada {jornada}</p>
      </div>
      <dl className="grid grid-cols-2 gap-3">
        {stats.map(stat => (
          <div key={stat.label} className="grid gap-1 rounded-control bg-surface-1 p-3">
            <dt className="text-meta font-bold uppercase tracking-wider text-fg-muted">{stat.label}</dt>
            <dd className="break-words text-label font-bold tabular-nums">{stat.value}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-label font-bold tabular-nums"><AnimatedNumber value={votedCount} /> de <AnimatedNumber value={total} /> han votado</p>
        {voted.length > 0 && (
          <ul aria-label="Miembros que han votado" className="flex items-center">
            {voted.slice(0, MAX_AVATARS).map(member => (
              <li key={member.userId} className="-ml-2 first:ml-0">
                <Avatar name={member.displayName || "Jugador"} alt={`Avatar de ${member.displayName || "Jugador"}`} src={avatars[member.userId] ?? null} size="sm" className="m-0" />
              </li>
            ))}
            {voted.length > MAX_AVATARS && <li className="ml-2 text-meta font-bold text-fg-muted">+{voted.length - MAX_AVATARS}</li>}
          </ul>
        )}
      </div>
    </Card>
  );
}
