"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CaretDown } from "@phosphor-icons/react/dist/ssr/CaretDown";
import { TeamCrest } from "@/components/ui/team-crest";
import { cn } from "@/lib/cn";
import { searchTeamsAction } from "../server/actions";
import type { TeamOption } from "../domain/admin";
import { panelControl } from "./panel-ui";

const MIN_QUERY = 2;
const DEBOUNCE_MS = 300;

type Chosen = { id: string; name: string; logoUrl: string | null };

/**
 * Inline team picker: the current team shows as a compact field; clicking it turns it into a search box whose results drop
 * down right below (public teams list through a server action, not rate limited, after a short pause). The chosen id travels
 * in a hidden input named `name`.
 */
export function TeamPicker({ name, label, initial, error }: { name: string; label: string; initial: Chosen; error?: string }) {
  const uid = useId();
  const root = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<Chosen>(initial);
  const [changing, setChanging] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TeamOption[]>([]);
  const [failure, setFailure] = useState("");
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    const needle = query.trim();
    if (!changing || needle.length < MIN_QUERY) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      searchTeamsAction(needle).then(result => {
        if (cancelled) return;
        setResults(result.teams);
        setFailure(result.error ?? "");
        setSearched(true);
      }, () => { if (!cancelled) setFailure("No hemos podido buscar equipos."); });
    }, DEBOUNCE_MS);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, changing]);

  const reset = () => { setChanging(false); setQuery(""); setResults([]); setSearched(false); setFailure(""); };
  const shown = query.trim().length >= MIN_QUERY ? results : [];
  return (
    <div
      ref={root}
      className="relative grid gap-1"
      onKeyDown={event => { if (event.key === "Escape" && changing) { event.stopPropagation(); reset(); } }}
      onBlur={event => { if (changing && !root.current?.contains(event.relatedTarget)) reset(); }}
    >
      <input type="hidden" name={name} value={selected.id} />
      {changing ? (
        <input
          type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={`${label}: busca por nombre…`}
          autoComplete="off" autoFocus aria-label={`Buscar equipo: ${label}`} aria-controls={`${uid}-list`} className={panelControl}
        />
      ) : (
        <button
          type="button" onClick={() => setChanging(true)} aria-label={`${label}: ${selected.name}. Cambiar`} title={selected.name}
          className={cn(panelControl, "flex items-center gap-2 text-left", error && "border-danger")}
        >
          <TeamCrest name={selected.name} logoUrl={selected.logoUrl} size="xs" />
          <span className="min-w-0 flex-1 truncate">{selected.name}</span>
          <CaretDown size={12} weight="bold" aria-hidden="true" className="shrink-0 text-fg-muted" />
        </button>
      )}
      {changing && query.trim().length >= MIN_QUERY && (
        <div id={`${uid}-list`} onMouseDown={event => event.preventDefault()} className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-md border border-border-soft bg-surface-2 p-1 shadow-(--elev-sheet)">
          {failure && <p role="alert" className="px-2 py-1 text-label text-danger">{failure}</p>}
          {shown.map(team => (
            <button
              key={team.id} type="button"
              onClick={() => { setSelected({ id: team.id, name: team.name, logoUrl: team.logoUrl }); reset(); }}
              className="flex h-8 w-full items-center gap-2 rounded px-2 text-left text-label hover-fine:bg-surface-3"
            >
              <TeamCrest name={team.name} logoUrl={team.logoUrl} size="xs" />
              <span className="min-w-0 flex-1 truncate">{team.name}</span>
              {team.country && <span className="text-meta text-fg-muted">{team.country}</span>}
            </button>
          ))}
          {searched && shown.length === 0 && !failure && <p className="px-2 py-1 text-label text-fg-muted">Ningún equipo coincide.</p>}
        </div>
      )}
      {error && <p role="alert" className="text-meta text-danger">{error}</p>}
    </div>
  );
}
