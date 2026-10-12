"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { loadComposicionAction, type ComposicionLoad } from "../server/actions";
import { ComposicionRow } from "./composicion-row";
import { LoadError } from "./load-error";
import { PanelButton } from "./panel-ui";

/**
 * The 15 partidos of one jornada. Mounted only while its row is expanded: it fetches the composición then (one admin request
 * plus the public detail for names and crests) and shows skeleton rows meanwhile. Collapsing the row drops it; no polling.
 */
export function ComposicionEditor({ jornadaId }: { jornadaId: string }) {
  const [load, setLoad] = useState<ComposicionLoad | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loadComposicionAction(jornadaId).then(
      result => { if (!cancelled) setLoad(result); },
      () => { if (!cancelled) setLoad({ ok: false, message: "No hemos podido cargar la composición.", rateLimited: false }); },
    );
    return () => { cancelled = true; };
  }, [jornadaId, attempt]);

  return (
    <section aria-label="Composición" className="grid gap-1">
      <h3 className="text-meta font-medium uppercase tracking-wider text-fg-muted">Composición · 15 partidos</h3>
      {load === null ? (
        <div aria-busy="true" className="grid gap-2 py-1.5">
          <span className="sr-only" role="status">Cargando la composición…</span>
          {[0, 1, 2, 3].map(index => <Skeleton key={index} className="h-8 w-full rounded-md" />)}
        </div>
      ) : !load.ok ? (
        <div className="grid justify-items-start gap-2">
          <LoadError message={load.message} rateLimited={load.rateLimited} />
          <PanelButton onClick={() => { setLoad(null); setAttempt(value => value + 1); }}>Reintentar</PanelButton>
        </div>
      ) : load.rows.length === 0 ? (
        <p className="text-label text-fg-muted">Esta jornada aún no tiene composición.</p>
      ) : (
        <ul className="divide-y divide-border-soft">
          {load.rows.map(row => (
            <ComposicionRow key={row.position} jornadaId={jornadaId} row={row} home={load.teams[row.position]?.home ?? null} away={load.teams[row.position]?.away ?? null} />
          ))}
        </ul>
      )}
    </section>
  );
}
