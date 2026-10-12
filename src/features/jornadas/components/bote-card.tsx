import { AnimatedNumber } from "@/components/motion/animated-number";
import { Card } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format-date";
import { parseAmount } from "@/lib/format-money";
import type { JornadaBote } from "../../results/domain/results";

/** "Bote y recaudación" of the live pool. Renders nothing when no figure is presentable. */
export function BoteCard({ bote }: { bote: JornadaBote }) {
  // Same rules as formatEuro (whole amounts trimmed, unit prices fixed at 2 decimals); the number rolls up when it scrolls into view.
  const stats = [
    { label: "Bote", amount: parseAmount(bote.jackpotEur), fixed: false },
    { label: "Bote estimado", amount: parseAmount(bote.estimatedJackpotEur), fixed: false },
    { label: "Recaudación", amount: parseAmount(bote.collectedEur), fixed: false },
    { label: "Precio por apuesta", amount: parseAmount(bote.betCostEur), fixed: true },
  ].filter((stat): stat is { label: string; amount: number; fixed: boolean } => stat.amount !== null);
  if (stats.length === 0) return null;
  const closes = formatDateTime(bote.bettingClosesAt);
  return (
    <Card as="section" surface={1} aria-labelledby="bote-heading" header={<h2 id="bote-heading">Bote y recaudación</h2>}>
      <dl className="grid grid-cols-2 gap-3">
        {stats.map(stat => (
          <div key={stat.label} className="grid gap-1 rounded-control bg-surface-2 p-3">
            <dt className="text-meta font-bold uppercase tracking-wider text-fg-muted">{stat.label}</dt>
            <dd className="font-display text-h2 tabular-nums text-action">
              <AnimatedNumber value={stat.amount} suffix=" €" minimumFractionDigits={stat.fixed ? 2 : 0} maximumFractionDigits={2} />
            </dd>
          </div>
        ))}
      </dl>
      {closes && <p className="text-label text-fg-muted">Fin de apuestas: {closes}</p>}
    </Card>
  );
}
