import type { CSSProperties } from "react";
import { AppLink } from "@/components/shell/app-link";
import { TeamCrest } from "@/components/ui/team-crest";
import { cn } from "@/lib/cn";
import type { TickerChip } from "../domain/ticker";
import { loadTicker } from "../server/ticker";

type ChipProps = { chip: TickerChip; href: string; decorative: boolean };

function Chip({ chip, href, decorative }: ChipProps) {
  return (
    <li>
      <AppLink
        href={href}
        indicator={false}
        transitionTypes={["nav-forward"]}
        // The second copy of the track only exists for the seamless loop: it is hidden from assistive tech and the tab order.
        tabIndex={decorative ? -1 : undefined}
        aria-label={`Partido ${chip.position}: ${chip.homeName} contra ${chip.awayName}${chip.label ? `, ${chip.label}` : ""}`}
        className="tap inline-flex h-8 items-center gap-2 rounded-pill border-(length:--bw) border-border-soft bg-surface-1 px-3 text-meta font-bold uppercase tracking-wide text-fg no-underline whitespace-nowrap [--press-scale:0.96] hover-fine:border-action"
      >
        {chip.label && (
          <span className={cn("tabular-nums", chip.played ? "rounded-pill bg-ink px-2 py-0.5 text-cream" : "text-action")}>{chip.label}</span>
        )}
        <TeamCrest name={chip.homeName} logoUrl={chip.homeLogoUrl} size="xs" />
        <span aria-hidden="true">{chip.homeName} - {chip.awayName}</span>
        <TeamCrest name={chip.awayName} logoUrl={chip.awayLogoUrl} size="xs" />
      </AppLink>
    </li>
  );
}

/**
 * Sticky scores-style strip right under the app header: a brand pill with the jornada plus one chip per match drifting
 * on a CSS-only marquee (two identical groups, translated by -50% for a seamless loop). Paused on hover / focus, and a
 * plain scrollable row under reduced motion (see `.ticker*` in globals.css). Renders nothing without an active jornada.
 */
export async function JornadaTicker() {
  const data = await loadTicker();
  if (!data || data.chips.length === 0) return null;
  const href = `/jornadas/${data.matchdayId}`;
  const group = (decorative: boolean) => (
    <ul aria-hidden={decorative || undefined} className="ticker-group">
      {data.chips.map(chip => <Chip key={chip.position} chip={chip} href={href} decorative={decorative} />)}
    </ul>
  );
  return (
    <nav
      aria-label={`Jornada ${data.number}: partidos`}
      className="ticker sticky top-[calc(4rem+var(--shell-edge)+env(safe-area-inset-top))] z-10 border-b-(length:--shell-edge) border-(--shell-edge-color) bg-(--shell-bg) [backdrop-filter:var(--shell-blur)]"
    >
      <div className="mx-auto flex h-11 w-full max-w-160 items-center gap-2 px-2 lg:px-0">
        <AppLink
          href={href}
          indicator={false}
          transitionTypes={["nav-forward"]}
          className="tap inline-flex h-8 shrink-0 items-center rounded-pill border-(length:--bw) border-edge bg-action px-3 font-display text-meta uppercase tracking-wider text-on-action no-underline [--press-scale:0.96]"
        >
          Jornada {data.number}
        </AppLink>
        <div className="ticker-viewport min-w-0 flex-1">
          <div className="ticker-track" style={{ "--ticker-chips": data.chips.length } as CSSProperties}>
            {group(false)}
            {group(true)}
          </div>
        </div>
      </div>
    </nav>
  );
}
