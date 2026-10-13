"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { STANDINGS, STANDINGS_MAX_WIDTH, standingsFrameView, type StandingsEmbed, type StandingsLoadState } from "../domain/standings";

/** If the iframe never reports `load` within this time, a quiet fallback link replaces the loader. */
const LOAD_TIMEOUT_MS = 12000;

/** "Clasificaciones" of the Spanish leagues and the UEFA competitions: one Sofascore widget per tab, mounted client-side for the active tab only. */
export function StandingsSection() {
  const baseId = useId();
  const [activeId, setActiveId] = useState<StandingsEmbed["id"]>(STANDINGS[0].id);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const active = STANDINGS.find(embed => embed.id === activeId) ?? STANDINGS[0];

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = STANDINGS.length - 1;
    const target = event.key === "ArrowRight" ? (index === last ? 0 : index + 1)
      : event.key === "ArrowLeft" ? (index === 0 ? last : index - 1)
      : event.key === "Home" ? 0
      : event.key === "End" ? last
      : null;
    if (target === null) return;
    event.preventDefault();
    setActiveId(STANDINGS[target].id);
    tabRefs.current[target]?.focus();
  }

  return (
    <Card as="section" surface={1} aria-labelledby={`${baseId}-heading`} header={<h2 id={`${baseId}-heading`}>Clasificaciones</h2>}>
      <div className="grid gap-4">
        {/* Folder tabs: each one overlaps its neighbour, the active one comes to the front and joins the sheet below. */}
        <div className="mx-auto grid w-full" style={{ maxWidth: STANDINGS_MAX_WIDTH }}>
          <div role="tablist" aria-label="Competición" className="-mb-[2px] flex overflow-x-auto overscroll-x-contain pt-2 [scrollbar-width:none]">
            {STANDINGS.map((embed, index) => {
              const selected = embed.id === activeId;
              return (
                <button
                  key={embed.id}
                  ref={node => { tabRefs.current[index] = node; }}
                  type="button"
                  role="tab"
                  id={`${baseId}-tab-${embed.id}`}
                  aria-selected={selected}
                  aria-controls={`${baseId}-panel`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setActiveId(embed.id)}
                  onKeyDown={event => onKeyDown(event, index)}
                  style={{ zIndex: selected ? 30 : STANDINGS.length - index }}
                  className={cn(
                    "tap relative min-h-11 shrink-0 whitespace-nowrap rounded-t-card border-2 border-b-0 border-ink px-4 text-label font-bold transition-transform duration-(--duration-fast) ease-(--ease-standard) [--press-scale:1]",
                    index > 0 && "-ml-3",
                    selected ? "-translate-y-1 bg-surface-2 text-fg" : "translate-y-0 bg-surface-1 text-fg-muted shadow-[inset_0_-6px_8px_-6px_rgb(0_0_0/0.25)] hover-fine:-translate-y-0.5 hover-fine:text-fg",
                  )}
                >
                  {embed.tabLabel}
                </button>
              );
            })}
          </div>

          <div role="tabpanel" id={`${baseId}-panel`} aria-labelledby={`${baseId}-tab-${active.id}`} className="relative z-[20] overflow-hidden rounded-card rounded-tl-none border-2 border-ink bg-surface-2">
            <p className="border-b border-border-soft px-4 py-3 font-display text-label uppercase">{active.name}</p>
            <StandingsFrame key={active.id} embed={active} />
          </div>
        </div>
        <p className="text-center text-meta text-fg-muted">
          Standings provided by{" "}
          <a href={active.attributionUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-fg">Sofascore</a>
        </p>
      </div>
    </Card>
  );
}

/**
 * One iframe plus its loader, remounted (key) on every tab switch. The iframe only exists after mount (client-side) and
 * gets its `load` listener before `src` is set, so a fast load can never be missed during hydration. It is never hidden:
 * the skeleton overlays it while loading, and the 12s fallback only swaps the skeleton for a visible link.
 */
function StandingsFrame({ embed }: { embed: StandingsEmbed }) {
  const [state, setState] = useState<StandingsLoadState>("loading");
  const frameRef = useRef<HTMLIFrameElement>(null);
  const view = standingsFrameView(state);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const onLoad = () => setState("loaded");
    frame.addEventListener("load", onLoad);
    frame.src = embed.src;
    const timer = setTimeout(() => setState(current => (current === "loading" ? "slow" : current)), LOAD_TIMEOUT_MS);
    return () => {
      frame.removeEventListener("load", onLoad);
      clearTimeout(timer);
    };
  }, [embed.src]);

  return (
    <div>
      <div className="relative" style={{ height: embed.height }}>
        <iframe
          ref={frameRef}
          title={`Clasificación ${embed.name} (Sofascore)`}
          width="100%"
          height={embed.height}
          scrolling="no"
          className="absolute inset-0 block border-0 bg-white"
        />
        <span
          aria-hidden="true"
          className={cn("skeleton pointer-events-none absolute inset-0 transition-opacity duration-(--duration-base) ease-(--ease-standard)", view.skeleton ? "opacity-100" : "opacity-0")}
        />
      </div>
      <p className="border-t border-border-soft px-4 py-3 text-center text-label text-fg-muted">
          {view.message}{" "}
          <a href={embed.attributionUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-action underline underline-offset-2">Ver clasificación en Sofascore</a>
        </p>
    </div>
  );
}
