import { AnimatedNumber } from "@/components/motion/animated-number";
import { StatusMessage } from "@/components/ui/status-message";
import { Card } from "@/components/ui/card";
import type { Escrutinio } from "../domain/results";

const euro = (amount: string) => `${amount} €`;

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 rounded-control bg-surface-2 p-3">
      <dt className="text-meta font-bold uppercase tracking-wider text-fg-muted">{label}</dt>
      <dd className="font-display text-h2 tabular-nums text-action">{value}</dd>
    </div>
  );
}

function PrizeCard({ title, winners, prize }: { title: string; winners: number; prize: string }) {
  return (
    <li>
      <Card surface={2} padding="md" className="gap-2">
        <p className="font-display text-h2 uppercase">{title}</p>
        <dl className="grid grid-cols-2 gap-3">
          <div className="grid gap-0.5">
            <dt className="text-meta font-bold uppercase tracking-wider text-fg-muted">Acertantes</dt>
            <dd className="text-body font-bold tabular-nums"><AnimatedNumber value={winners} /></dd>
          </div>
          <div className="grid gap-0.5">
            <dt className="text-meta font-bold uppercase tracking-wider text-fg-muted">Premio</dt>
            <dd className="text-body font-bold tabular-nums text-action">{euro(prize)}</dd>
          </div>
        </dl>
      </Card>
    </li>
  );
}

/** Official prize table exactly as published: amounts are provider strings in EU format and are not recomputed. */
export function EscrutinioTable({ escrutinio }: { escrutinio: Escrutinio }) {
  return (
    <>
      {escrutinio.estimated && <StatusMessage>Cifras provisionales: todavía no se ha publicado el escrutinio oficial definitivo.</StatusMessage>}
      <p className="text-label text-fg-muted">
        Jornada {escrutinio.matchdayLabel} ({escrutinio.seasonLabel}) · {escrutinio.dateLabel}
      </p>
      <dl className="grid grid-cols-2 gap-3">
        <Stat label="Recaudación" value={euro(escrutinio.collectedEur)} />
        <Stat label="Bote" value={euro(escrutinio.jackpotEur)} />
      </dl>
      {escrutinio.categories.length > 0 && (
        <ul aria-label="Categorías de premio" className="grid gap-3 sm:grid-cols-2">
          {escrutinio.categories.map(category => (
            <PrizeCard key={category.hits} title={`${category.hits} aciertos`} winners={category.winners} prize={category.prizeEur} />
          ))}
          {escrutinio.elige8 && <PrizeCard title="Elige 8" winners={escrutinio.elige8.winners} prize={escrutinio.elige8.prizeEur} />}
        </ul>
      )}
    </>
  );
}
