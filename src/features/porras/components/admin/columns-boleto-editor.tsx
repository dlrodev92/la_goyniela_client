"use client";

import { useState, useTransition } from "react";
import { Reveal } from "@/components/motion/reveal";
import { AppLink } from "@/components/shell/app-link";
import { Button } from "@/components/ui/button";
import { StatusMessage } from "@/components/ui/status-message";
import { formatEuro } from "@/lib/format-money";
import { Boleto, type BoletoFixture, type BoletoProposal } from "../boleto";
import { checkColumns, copyPreviousColumn, fijosOf, fijosSentence, fitColumns, setColumnSign, type ColumnsDraft } from "../../domain/columns";
import { type FieldErrors, type PorraTerms } from "../../domain/logic";
import { columnasText } from "../../domain/modes";
import type { Sign } from "../../domain/porras";
import { confirmBoletoAction, type ConfirmBoletoState } from "../../server/actions";

type Props = {
  groupId: string;
  porraId: string;
  jornada: number;
  temporada: string;
  fixtures: BoletoFixture[];
  /** The existing final boleto when there is one, otherwise the seeded proposal. */
  initialDraft: ColumnsDraft;
  source: "boleto" | "propuesta";
  /** The seeded proposal, to go back to it; null when it could not be computed. */
  proposalDraft: ColumnsDraft | null;
  proposal: BoletoProposal | null;
  /** A sencilla or Intuición porra. */
  terms: PorraTerms & { modo: "sencilla" | "intuicion"; columnas: number };
};

const money = (value: string | null) => (value === null ? "" : formatEuro(value, { fixed: true }) ?? value);

/**
 * Admin editor of the final boleto for the modes that print several columns. All columns sit side by side on the paper boleto (one sign per
 * match in each). In Intuición the fijos are edited once and mirrored.
 */
export function ColumnsBoletoEditor({ groupId, porraId, jornada, temporada, fixtures, initialDraft, source, proposalDraft, proposal, terms }: Props) {
  const fijos = fijosOf({ modo: terms.modo, fijos: terms.fijos });
  const [draft, setDraft] = useState(() => fitColumns(initialDraft, terms.columnas, fijos));
  const [savedDraft, setSavedDraft] = useState<ColumnsDraft | null>(null);
  const [result, setResult] = useState<ConfirmBoletoState | null>(null);
  const [serverFields, setServerFields] = useState<FieldErrors>({});
  const [pending, startTransition] = useTransition();
  const check = checkColumns(draft, terms);
  const saved = savedDraft !== null && JSON.stringify(savedDraft) === JSON.stringify(draft) && result?.status === "saved";
  const finalHref = `/groups/${groupId}/porras/${porraId}/final`;
  const intuicion = terms.modo === "intuicion";

  const change = (next: ColumnsDraft) => {
    setDraft(next);
    setResult(null);
    setServerFields({});
  };

  const confirm = () => {
    if (!check.canConfirm) return;
    startTransition(async () => {
      const outcome = await confirmBoletoAction(groupId, porraId, draft);
      setResult(outcome);
      if (outcome.status === "saved") { setSavedDraft(draft); setServerFields({}); }
      else setServerFields(outcome.fields);
    });
  };

  return (
    <div className="grid gap-3">
      <p className="text-label text-fg-muted">
        {source === "boleto" ? "Partimos del boleto de la peña que ya está guardado." : "Partimos de la propuesta calculada con los votos de cada columna."}
      </p>
      <div className="grid gap-1 rounded-card border border-border-soft bg-surface-2 px-4 py-3">
        <p className="font-display text-h2 uppercase tabular-nums">Formato: {columnasText(terms.columnas)} · {money(terms.costEur ?? check.costEur)}</p>
        <p className="text-label text-fg-muted">
          {intuicion
            ? `${fijosSentence(fijos)}: se marcan una vez y valen para todas las columnas. Los otros ${14 - fijos.length} cambian de una columna a otra.`
            : "Cada columna lleva un solo signo por partido y es independiente de las demás."}
        </p>
      </div>
      {proposalDraft && source === "boleto" && (
        <Button variant="secondary" fullWidth onClick={() => { change(fitColumns(proposalDraft, terms.columnas, fijos)); }}>Volver a la propuesta</Button>
      )}

      <Boleto
        mode="edit" jornada={jornada} temporada={temporada} fixtures={fixtures}
        caption={intuicion ? "Marca un signo por partido en cada columna. Los partidos fijos valen para todas" : "Marca un signo por partido en cada columna"}
        value={{ picks: [], pleno: draft.pleno }}
        columnPicks={draft.columns}
        onChange={next => change({ ...draft, pleno: next.pleno })}
        onColumnSign={(column, position, sign: Sign) => change(setColumnSign(draft, column, position, sign, fijos))}
        onCopyColumn={column => change(copyPreviousColumn(draft, column, fijos))}
        lockedRows={fijos}
        errors={serverFields} proposal={proposal ?? undefined}
      />

      <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-10 grid gap-2 rounded-card border border-border-soft bg-surface-2 px-4 py-3">
        <p className="text-label font-bold tabular-nums" aria-live="polite">
          Ahora: {check.completeColumns}/{check.totalColumns} columnas completas
          {intuicion ? ` · Fijos ${check.fijosMarked}/${check.fijosTotal}` : ""} · {columnasText(check.columns)} · {money(check.costEur)} de {money(terms.budgetEur)}
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
