"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { Reveal } from "@/components/motion/reveal";
import { AppLink } from "@/components/shell/app-link";
import { Button } from "@/components/ui/button";
import { StatusMessage } from "@/components/ui/status-message";
import { cn } from "@/lib/cn";
import { Boleto, type BoletoFixture } from "../boleto";
import type { Sign } from "../../domain/porras";
import {
  columnsProgress, copyPreviousColumn, decodeColumnsDraft, draftsAreEqual, encodeColumnsDraft, isMultiColumnRules, setColumnSign, singleFromColumns, validateColumnsVote, voteCaption,
  type ColumnsDraft, type VoteRules,
} from "../../domain/columns";
import { draftStorageKey, formatUsage, type BoletoDraft, type FieldErrors } from "../../domain/logic";
import type { MatchInfo } from "../../domain/porra-view";
import { saveBoletoAction, type SaveBoletoState } from "../../server/actions";
import { BoletoFrame } from "./boleto-frame";
import { MatchInfoDrawer } from "./match-info-drawer";

type Props = {
  /** `modal`: opened over the porra page (intercepting route); `page`: direct visit as a full page. */
  variant: "modal" | "page";
  groupId: string;
  porraId: string;
  groupName: string;
  jornada: number;
  temporada: string;
  fixtures: BoletoFixture[];
  matchInfo: MatchInfo[];
  /** How many columns the porra asks of a member, one sign per row or free signs, and the Intuición fijos. */
  rules: VoteRules;
  /** The caller's saved picks, with exactly the porra's columns (empty when none). */
  initialDraft: ColumnsDraft;
  hasVoted: boolean;
  /** False when the porra or the voting is closed: the boleto is read-only and `closedReason` explains why. */
  canVote: boolean;
  closedReason: string | null;
};

const noopSubscribe = () => () => undefined;
function readStored(key: string): string | null {
  try { return window.sessionStorage.getItem(key); } catch { return null; }
}

const progressText = (draft: ColumnsDraft, multi: boolean) => {
  const { marked, plenoDone, completeColumns, totalColumns } = columnsProgress(draft);
  return `${multi ? `${completeColumns}/${totalColumns} columnas` : `${marked}/14`} · pleno ${plenoDone ? "✓" : "pendiente"}`;
};

/** The member's boleto: editable draft (kept in sessionStorage until saved), info drawer per match and save. */
export function BoletoFlow({ variant, groupId, porraId, groupName, jornada, temporada, fixtures, matchInfo, rules, initialDraft, hasVoted, canVote, closedReason }: Props) {
  const storageKey = draftStorageKey(porraId);
  // The unsaved draft of an earlier visit. Read through useSyncExternalStore so the server render and hydration
  // use the saved boleto and the client then switches to the stored draft without a mismatch.
  const stored = useSyncExternalStore(noopSubscribe, () => readStored(storageKey), () => null);
  const multi = isMultiColumnRules(rules);
  const [edited, setEdited] = useState<ColumnsDraft | null>(null);
  const [savedDraft, setSavedDraft] = useState<ColumnsDraft | null>(null);
  const baseline = savedDraft ?? initialDraft;
  const restoredDraft = decodeColumnsDraft(stored, initialDraft);
  const draft = edited ?? restoredDraft ?? initialDraft;
  const restored = edited === null && restoredDraft !== null && !draftsAreEqual(restoredDraft, initialDraft);
  const [attempted, setAttempted] = useState(false);
  const [serverFields, setServerFields] = useState<FieldErrors>({});
  const [result, setResult] = useState<SaveBoletoState | null>(null);
  const [closedNow, setClosedNow] = useState(false);
  const [infoPosition, setInfoPosition] = useState<number | null>(null);
  // The drawer stays mounted once used (it slides in and out), so "open" is separate from "which match".
  const [infoOpen, setInfoOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);
  const infoOpener = useRef<HTMLElement | null>(null);
  const editable = canVote && !closedNow;
  const closedMessage = closedNow && result?.status === "error" ? result.message : closedReason;

  // Persist the unsaved draft once the member edits; drop it when it equals what is saved.
  useEffect(() => {
    if (edited === null) return;
    try {
      if (draftsAreEqual(edited, baseline)) window.sessionStorage.removeItem(storageKey);
      else window.sessionStorage.setItem(storageKey, encodeColumnsDraft(baseline, edited));
    } catch { /* storage unavailable: the draft just lives in memory */ }
  }, [edited, baseline, storageKey]);

  const change = useCallback((next: ColumnsDraft) => {
    setEdited(next);
    setResult(null);
    setServerFields({});
  }, []);

  const problems = validateColumnsVote(draft, rules);
  const errors: FieldErrors = { ...(attempted && editable ? problems : {}), ...serverFields };
  const invalidCount = Object.keys(problems).length;
  const usage = formatUsage(singleFromColumns(draft, 0));
  const fijos = rules.fijos;
  const dirty = !draftsAreEqual(draft, baseline);
  const saved = result?.status === "saved" && !dirty;

  const submit = () => {
    setAttempted(true);
    if (invalidCount > 0) {
      requestAnimationFrame(() => scrollRef.current?.querySelector('[role="alert"]')?.scrollIntoView({ block: "center", behavior: "smooth" }));
      return;
    }
    startTransition(async () => {
      const outcome = await saveBoletoAction(groupId, porraId, draft);
      setResult(outcome);
      if (outcome.status === "saved") { setSavedDraft(draft); setServerFields({}); }
      else {
        setServerFields(outcome.fields);
        if (outcome.closed) setClosedNow(true);
      }
    });
  };

  const openInfo = (position: number) => {
    infoOpener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setInfoPosition(position);
    setInfoOpen(true);
  };
  const closeInfo = () => {
    setInfoOpen(false);
    infoOpener.current?.focus();
  };
  const info = infoPosition === null ? null : matchInfo.find(item => item.position === infoPosition) ?? null;

  // One column (múltiple, reducida) is drawn as the single boleto; sencilla and Intuición print every column side by side.
  const first = singleFromColumns(draft, 0);
  const boleto = (
    <Boleto
      {...(editable
        ? multi
          ? {
            mode: "vote" as const, value: { picks: first.picks, pleno: draft.pleno }, columnPicks: draft.columns, lockedRows: fijos, caption: voteCaption(rules),
            onChange: (next: BoletoDraft) => change({ ...draft, pleno: next.pleno }),
            onColumnSign: (column: number, position: number, sign: Sign) => change(setColumnSign(draft, column, position, sign, fijos)),
            onCopyColumn: (column: number) => change(copyPreviousColumn(draft, column, fijos)),
          }
          : { mode: "vote" as const, value: first, onChange: (next: BoletoDraft) => change({ columns: [next.picks], pleno: next.pleno }) }
        : { mode: "final" as const, value: first, columnPicks: multi ? draft.columns : undefined, stamp: null, caption: "Tus pronósticos" })}
      jornada={jornada}
      temporada={temporada}
      fixtures={fixtures}
      errors={errors}
      onInfo={openInfo}
    />
  );

  const footer = (
    <div className={cn("grid gap-2 border-t border-border-soft/60 bg-surface-2 px-4 py-3", variant === "page" && "sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-10")}>
      <Reveal live={false} className="[--reveal-gap:0.5rem]">
        {!editable && <StatusMessage tone="info">{closedMessage}{!hasVoted && " No enviaste boleto."}</StatusMessage>}
      </Reveal>
      <Reveal live={false} className="[--reveal-gap:0.5rem]">
        {editable && restored && !saved && !pending && <p className="text-meta text-fg-muted">Hemos recuperado tu borrador sin guardar.</p>}
      </Reveal>
      <Reveal live={false} className="[--reveal-gap:0.5rem]">
        {editable && attempted && invalidCount > 0 && !saved && (
          <StatusMessage tone="error">
            {multi
              ? `${invalidCount === 1 ? "Hay 1 punto por revisar" : `Hay ${invalidCount} puntos por revisar`} antes de guardar.${problems.columnas ? ` ${problems.columnas}` : ""}`
              : `${invalidCount === 1 ? "Falta 1 casilla por marcar." : `Faltan ${invalidCount} casillas por marcar.`}`} Revisa las filas señaladas.
          </StatusMessage>
        )}
      </Reveal>
      <Reveal live={false} className="[--reveal-gap:0.5rem]">
        {result?.status === "error" && editable && <StatusMessage tone="error">{result.message}</StatusMessage>}
      </Reveal>
      <Reveal live={false} className="[--reveal-gap:0.5rem]">{saved && <StatusMessage tone="success">Boleto guardado</StatusMessage>}</Reveal>
      {editable && (
        <>
          <p className="text-meta tabular-nums text-fg-muted" aria-live="polite">
            {progressText(draft, multi)}{multi ? "" : ` · Simples ${usage.simples} · Dobles ${usage.dobles} · Triples ${usage.triples}`}
          </p>
          <Button onClick={submit} loading={pending} fullWidth>{hasVoted || savedDraft ? "Guardar cambios" : "Guardar mi boleto"}</Button>
        </>
      )}
      {variant === "modal" && !editable && <p className="text-meta text-fg-muted">Puedes cerrar esta hoja para volver a la porra.</p>}
    </div>
  );

  const drawer = info && (
    <MatchInfoDrawer
      info={info}
      open={infoOpen}
      onClose={closeInfo}
      className={variant === "modal" ? "absolute inset-x-0 bottom-0 z-10 max-h-[70%] overflow-y-auto" : "fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 max-h-[70dvh] overflow-y-auto lg:left-auto lg:w-[30rem]"}
    />
  );

  if (variant === "modal") {
    return (
      <BoletoFrame title={`Mi boleto · ${groupName}`} progress={progressText(draft, multi)}>
        <div className="relative flex min-h-0 flex-1 flex-col">
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-4 pt-3">{boleto}</div>
          {footer}
          {drawer}
        </div>
      </BoletoFrame>
    );
  }
  return (
    <div className="grid gap-3">
      <AppLink href={`/groups/${groupId}/porras/${porraId}`} transitionTypes={["nav-back"]} indicator={false} className="fx-link inline-flex min-h-touch w-fit items-center text-label font-bold text-action no-underline">Volver a la porra</AppLink>
      <div ref={scrollRef}>{boleto}</div>
      {footer}
      {drawer}
    </div>
  );
}
