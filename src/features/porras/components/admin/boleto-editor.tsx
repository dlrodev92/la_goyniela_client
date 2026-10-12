"use client";

import { useState, useTransition } from "react";
import { Reveal } from "@/components/motion/reveal";
import { AppLink } from "@/components/shell/app-link";
import { Button } from "@/components/ui/button";
import { StatusMessage } from "@/components/ui/status-message";
import { Boleto, type BoletoFixture, type BoletoProposal } from "../boleto";
import { formatEuro } from "@/lib/format-money";
import { columnsDraftFromSingle } from "../../domain/columns";
import { draftsEqual, editCheck, formatName, type BoletoDraft, type FieldErrors, type PorraTerms } from "../../domain/logic";
import { columnasText, MODE_LABEL } from "../../domain/modes";
import { confirmBoletoAction, type ConfirmBoletoState } from "../../server/actions";

type Props = {
  groupId: string;
  porraId: string;
  jornada: number;
  temporada: string;
  fixtures: BoletoFixture[];
  /** The existing final boleto when there is one, otherwise the proposal. */
  initialDraft: BoletoDraft;
  /** Where the draft comes from, for the intro text. */
  source: "boleto" | "propuesta";
  /** The computed proposal as a draft, to go back to it; null when it could not be computed. */
  proposalDraft: BoletoDraft | null;
  proposal: BoletoProposal | null;
  terms: PorraTerms;
};

const money = (value: string | null) => (value === null ? "" : formatEuro(value, { fixed: true }) ?? value);

/**
 * Admin editor of the final boleto for múltiple and reducida (one printed column). Two figures only: the porra's
 * "Formato" at the top and the live "Ahora" in the bar; confirm is blocked until the boleto fits the porra.
 */
export function BoletoEditor({ groupId, porraId, jornada, temporada, fixtures, initialDraft, source, proposalDraft, proposal, terms }: Props) {
  const [draft, setDraft] = useState(initialDraft);
  const [savedDraft, setSavedDraft] = useState<BoletoDraft | null>(null);
  const [result, setResult] = useState<ConfirmBoletoState | null>(null);
  const [serverFields, setServerFields] = useState<FieldErrors>({});
  const [pending, startTransition] = useTransition();
  const check = editCheck(draft, terms);
  const saved = savedDraft !== null && draftsEqual(savedDraft, draft) && result?.status === "saved";
  const finalHref = `/groups/${groupId}/porras/${porraId}/final`;

  const change = (next: BoletoDraft) => {
    setDraft(next);
    setResult(null);
    setServerFields({});
  };

  const confirm = () => {
    if (!check.canConfirm) return;
    startTransition(async () => {
      const outcome = await confirmBoletoAction(groupId, porraId, columnsDraftFromSingle(draft));
      setResult(outcome);
      if (outcome.status === "saved") { setSavedDraft(draft); setServerFields({}); }
      else setServerFields(outcome.fields);
    });
  };

  return (
    <div className="grid gap-3">
      <p className="text-label text-fg-muted">
        {source === "boleto" ? "Partimos del boleto de la peña que ya está guardado." : "Partimos de la propuesta calculada con los votos."}{" "}
        Marca de 1 a 3 signos por partido.
      </p>
      <div className="grid gap-1 rounded-card border border-border-soft bg-surface-2 px-4 py-3">
        <p className="font-display text-h2 uppercase tabular-nums">
          Formato: {formatName(terms.dobles, terms.triples)} · {columnasText(check.formatColumns)} · {money(check.formatCostEur)}
        </p>
        <p className="text-label text-fg-muted">
          {terms.modo === "reducida" ? `${MODE_LABEL.reducida}: las apuestas son fijas, así que respeta exactamente los dobles y triples.` : "Marca justo esos dobles y triples; el resto de partidos son simples."}
        </p>
      </div>
      <Reveal live={false} className="[--reveal-gap:0.75rem]">
        {check.overPlacement.length > 0 && !saved && (
          <StatusMessage tone="error">{check.overPlacement.join(" ")} Quita signos para poder confirmar.</StatusMessage>
        )}
      </Reveal>
      {proposalDraft && source === "boleto" && (
        <Button variant="secondary" fullWidth onClick={() => change(proposalDraft)}>Volver a la propuesta</Button>
      )}
      <Boleto mode="edit" jornada={jornada} temporada={temporada} fixtures={fixtures} value={draft} onChange={change} errors={serverFields} proposal={proposal ?? undefined} />
      <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-10 grid gap-2 rounded-card border border-border-soft bg-surface-2 px-4 py-3">
        <p className="text-label font-bold tabular-nums" aria-live="polite">
          Ahora: Dobles {check.usage.dobles}/{terms.dobles} · Triples {check.usage.triples}/{terms.triples} · {columnasText(check.columns)} · {money(check.costEur)} de {money(terms.budgetEur)}
        </p>
        <Reveal live={false} className="[--reveal-gap:0.5rem]">
          {!check.canConfirm && (
            <ul className="grid gap-1 text-meta text-fg-muted" aria-label="Por qué no se puede confirmar todavía">
              {check.reasons.map(reason => <li key={reason}>{reason}</li>)}
            </ul>
          )}
        </Reveal>
        <Reveal className="[--reveal-gap:0.5rem]">{result?.status === "error" && <StatusMessage tone="error">{result.message}</StatusMessage>}</Reveal>
        <Reveal className="[--reveal-gap:0.5rem]">
          {saved && (
            <StatusMessage tone="success">
              Boleto de la peña confirmado.{" "}
              <AppLink href={finalHref} indicator={false} className="fx-link font-bold text-action">Ver boleto de la peña</AppLink>
            </StatusMessage>
          )}
        </Reveal>
        <Button fullWidth loading={pending} disabled={!check.canConfirm || saved} onClick={confirm}>
          {saved ? "Boleto confirmado" : "Confirmar boleto de la peña"}
        </Button>
      </div>
    </div>
  );
}
