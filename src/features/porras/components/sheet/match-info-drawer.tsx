"use client";

import { X } from "@phosphor-icons/react/dist/ssr/X";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { PlenoShareBars, SignShareBars } from "@/components/ui/share-bars";
import type { MatchInfo } from "../../domain/porra-view";

type Props = { info: MatchInfo; /** Slides in when true and out when false; the drawer stays mounted. */ open: boolean; onClose: () => void; className?: string };

/**
 * Info of one match shown inside the boleto sheet: schedule, result, editorial comment and Losilla's percentages.
 * Escape closes only the drawer (the keydown is consumed so the sheet stays open).
 */
export function MatchInfoDrawer({ info, open, onClose, className }: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (open) headingRef.current?.focus(); }, [info.position, open]);
  const pleno = info.position === 15;
  const title = `${pleno ? "Pleno al 15" : `Partido ${info.position}`}: ${info.home} contra ${info.away}`;
  const percentages = info.percentages;
  return (
    <section
      role="region"
      aria-labelledby="match-info-title"
      data-open={open}
      onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onClose(); } }}
      className={cn("drawer grid gap-3 border-t-(length:--bw-thick) border-border-soft bg-surface-2 p-4 text-fg shadow-(--elev-sheet)", className)}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 id="match-info-title" ref={headingRef} tabIndex={-1} className="min-w-0 break-words font-display text-h2 uppercase outline-none">{title}</h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar la información del partido"
          className="fx-icon inline-flex size-touch shrink-0 items-center justify-center rounded-pill"
        >
          <X size={22} weight="bold" aria-hidden="true" />
        </button>
      </div>
      <dl className="grid gap-2 text-label">
        <div className="flex flex-wrap gap-x-2"><dt className="font-bold text-fg-muted">Horario</dt><dd>{info.schedule ?? "Horario por confirmar"}</dd></div>
        <div className="flex flex-wrap gap-x-2">
          <dt className="font-bold text-fg-muted">Resultado</dt>
          <dd>{info.result ? `${info.result}${info.resultSign && !pleno ? `, signo ${info.resultSign}` : ""}` : "Sin jugar"}</dd>
        </div>
      </dl>
      <div className="grid gap-1">
        <h4 className="text-meta font-bold uppercase tracking-wider text-fg-muted">Comentario</h4>
        <p className="text-label leading-relaxed">{info.comment ?? "Todavía no hay comentario para este partido."}</p>
      </div>
      <div className="grid gap-2">
        <h4 className="text-meta font-bold uppercase tracking-wider text-fg-muted">Porcentajes de Losilla</h4>
        {pleno && info.pleno ? (
          <PlenoShareBars home={info.pleno.home} away={info.pleno.away} homeName={info.home} awayName={info.away} />
        ) : percentages ? (
          <SignShareBars percentages={percentages} />
        ) : (
          <p className="text-label text-fg-muted">Losilla aún no ha publicado los porcentajes de este partido.</p>
        )}
      </div>
    </section>
  );
}
