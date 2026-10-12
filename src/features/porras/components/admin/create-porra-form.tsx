"use client";

import { useState, useTransition } from "react";
import { Reveal } from "@/components/motion/reveal";
import { AppLink } from "@/components/shell/app-link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusMessage } from "@/components/ui/status-message";
import { cn } from "@/lib/cn";
import { formatEuro } from "@/lib/format-money";
import { columnasText, specLabel } from "../../domain/modes";
import { createPorraAction, type CreatePorraState } from "../../server/actions";
import { ModeChooser, type ModeSelection } from "./mode-chooser";

export type JornadaChoice = { id: string; number: number; seasonLabel: string };

type Props = {
  groupId: string;
  /** Jornadas a porra can be created for right now (inside the voting window). */
  jornadas: JornadaChoice[];
  /** Why no jornada is available while some are active (sale not open yet, voting closed...); null when there is simply none. */
  blockedReason?: string | null;
  defaultJornadaId: string | null;
};

/** Admin wizard: jornada, budget, then a mode and an option that fit. Creating redirects to the new porra. */
export function CreatePorraForm({ groupId, jornadas, blockedReason = null, defaultJornadaId }: Props) {
  const [jornadaId, setJornadaId] = useState(defaultJornadaId ?? jornadas[0]?.id ?? "");
  const [selection, setSelection] = useState<ModeSelection | null>(null);
  const [outcome, setOutcome] = useState<CreatePorraState | null>(null);
  const [pending, startTransition] = useTransition();

  if (jornadas.length === 0) {
    return (
      <Card surface={1} padding="lg">
        <p className="font-display text-h2 uppercase">{blockedReason ? "Ahora no se puede crear la porra" : "Todavía no hay jornada abierta"}</p>
        <p className="text-label text-fg-muted">{blockedReason ?? "Cuando se abra la próxima jornada podrás crear la porra de tu peña."}</p>
      </Card>
    );
  }

  const create = () => {
    if (!selection) return;
    setOutcome(null);
    startTransition(async () => {
      const result = await createPorraAction(groupId, { jornadaId, budgetRaw: selection.budgetEur, spec: selection.spec });
      setOutcome(result);
    });
  };

  const summary = selection ? `${specLabel(selection.spec)} · ${columnasText(selection.columns)} · ${formatEuro(selection.costEur, { fixed: true })}` : null;

  return (
    <div className="grid gap-4">
      <Card as="section" surface={2} padding="lg" aria-labelledby="step-jornada">
        <h2 id="step-jornada" className="font-display text-h2 uppercase">1. Jornada</h2>
        <fieldset className="grid gap-2">
          <legend className="sr-only">Jornada de la porra</legend>
          {jornadas.map(jornada => (
            <label key={jornada.id} className="relative block">
              <input
                type="radio" name="jornada" value={jornada.id} checked={jornadaId === jornada.id} className="peer sr-only"
                onChange={() => { setJornadaId(jornada.id); setSelection(null); setOutcome(null); }}
              />
              <span className={cn(
                "tap-peer flex min-h-touch items-center justify-between gap-3 rounded-control border border-border-soft bg-surface-1 px-4 py-3 [--press-scale:0.985] hover-fine:border-action",
                "peer-checked:border-action peer-checked:bg-surface-3 peer-ring",
              )}>
                <span className="text-body font-bold tabular-nums">Jornada {jornada.number}</span>
                <span className="text-label text-fg-muted">{jornada.seasonLabel}</span>
              </span>
            </label>
          ))}
        </fieldset>
      </Card>

      <Card as="section" surface={2} padding="lg" aria-label="Presupuesto, modo y formato">
        <ModeChooser key={jornadaId} groupId={groupId} jornadaId={jornadaId} onSelect={next => { setSelection(next); setOutcome(null); }} headings={{ budget: "2. Presupuesto", formats: "3. Modo y formato" }} />
      </Card>

      <div className="grid gap-3">
        <Reveal className="[--reveal-gap:0.75rem]">
          {outcome?.status === "exists" && (
            <StatusMessage tone="info">
              {outcome.message}{" "}
              {outcome.porraId && <AppLink href={`/groups/${groupId}/porras/${outcome.porraId}`} indicator={false} className="fx-link font-bold text-action">Ir a la porra</AppLink>}
            </StatusMessage>
          )}
        </Reveal>
        <Reveal className="[--reveal-gap:0.75rem]">{outcome?.status === "error" && <StatusMessage tone="error">{outcome.message}</StatusMessage>}</Reveal>
        <Reveal live={false} className="[--reveal-gap:0.75rem]">{summary && <p className="text-label font-bold tabular-nums">Resumen: {summary}</p>}</Reveal>
        <Button fullWidth disabled={!selection} loading={pending} onClick={create}>Crear porra</Button>
        <Reveal live={false} className="[--reveal-gap:0.75rem]">{!selection && <p className="text-meta text-fg-muted">Elige un modo y una opción para poder crear la porra.</p>}</Reveal>
      </div>
    </div>
  );
}
