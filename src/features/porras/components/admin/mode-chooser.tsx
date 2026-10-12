"use client";

import { useId, useState, useTransition, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { Reveal } from "@/components/motion/reveal";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { StatusMessage } from "@/components/ui/status-message";
import { TextInput } from "@/components/ui/text-input";
import { cn } from "@/lib/cn";
import { formatEuro } from "@/lib/format-money";
import { formatName, formatOptionLabel, type FormatOption } from "../../domain/logic";
import {
  columnasText, intuicionOptionLabel, MODE_BLURB, MODE_LABEL, PORRA_MODES, reduccionOptions, sameSpec, sencillaOptions, specKey,
} from "../../domain/modes";
import { FALLBACK_PRECIO_APUESTA_EUR, type IntuicionOption, type PorraModo, type PorraSpec } from "../../domain/porras";
import { loadOptionsAction, type OptionsState } from "../../server/actions";

/** What the admin picked: the budget, the mode with its parameters, and the apuestas and cost the options list showed. */
export type ModeSelection = { budgetEur: string; spec: PorraSpec; columns: number; costEur: string };

export const BUDGET_CHIPS = [3, 6, 12, 24] as const;

type Props = {
  groupId: string;
  jornadaId: string;
  /** Text the budget input starts with (e.g. "6" or the porra's current budget). */
  initialBudget?: string;
  /** Format already in use: its option is tagged "Actual" and its mode starts selected. */
  current?: PorraSpec;
  /** Called with the chosen option, or null when nothing is chosen (budget or mode edited, new list). */
  onSelect: (selection: ModeSelection | null) => void;
  /** Optional headings of the steps (budget, mode and options), e.g. "2. Presupuesto". */
  headings?: { budget: string; formats: string };
};

const optionClasses = cn(
  "tap-peer grid min-h-touch gap-1 rounded-control border border-border-soft bg-surface-1 px-4 py-3 [--press-scale:0.985] hover-fine:border-action",
  "peer-checked:border-action peer-checked:bg-surface-3 peer-ring peer-disabled:cursor-not-allowed peer-disabled:opacity-50 peer-disabled:hover-fine:border-border-soft",
);

const currentTag = <span className="ml-2 rounded-pill bg-surface-3 px-2 py-0.5 align-middle text-meta font-bold uppercase tracking-wider text-fg-muted">Actual</span>;

/**
 * Budget input with quick chips, then the mode (Múltiple, Sencilla, Reducida, Intuición) and the options of that mode
 * that fit the budget. Múltiple and Intuición options come from the API; sencilla and reducida are priced at the
 * jornada's price the API implies. Columns and cost shown are display only: the API computes the real ones.
 */
export function ModeChooser({ groupId, jornadaId, initialBudget = "", current, onSelect, headings }: Props) {
  const uid = useId();
  const [budget, setBudget] = useState(initialBudget);
  const [result, setResult] = useState<OptionsState | null>(null);
  const [modo, setModo] = useState<PorraModo>(current?.modo ?? "multiple");
  const [selected, setSelected] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const perColumn = result?.status === "ok" ? result.pricePerColumn : null;
  const price = perColumn ?? FALLBACK_PRECIO_APUESTA_EUR;

  const reset = () => { setSelected(null); onSelect(null); };

  const load = (text: string) => {
    reset();
    startTransition(async () => { setResult(await loadOptionsAction(groupId, jornadaId, text)); });
  };

  const edit = (text: string) => {
    setBudget(text);
    setResult(null);
    reset();
  };

  const chip = (amount: number) => {
    setBudget(String(amount));
    load(String(amount));
  };

  const keyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    load(budget);
  };

  const choose = (spec: PorraSpec, columns: number, costEur: string) => {
    if (result?.status !== "ok") return;
    setSelected(specKey(spec));
    onSelect({ budgetEur: result.budgetEur, spec, columns, costEur });
  };

  const radio = (spec: PorraSpec, index: number, content: ReactNode, apply: () => void, disabled = false) => {
    const key = specKey(spec);
    return (
      <label key={key} className="pop-stagger relative block" style={{ "--i": index } as CSSProperties}>
        <input type="radio" name={`${uid}-option`} checked={selected === key} disabled={disabled} onChange={apply} className="peer sr-only" />
        <span className={optionClasses}>
          <span className="break-words text-body font-bold">{content}{sameSpec(spec, current) && currentTag}</span>
        </span>
      </label>
    );
  };

  const options = (data: Extract<OptionsState, { status: "ok" }>) => {
    if (modo === "multiple") {
      return data.formats.map((option: FormatOption, index) =>
        radio({ modo, dobles: option.dobles, triples: option.triples }, index, formatOptionLabel(option), () => choose({ modo, dobles: option.dobles, triples: option.triples }, option.columns, option.costEur)));
    }
    if (modo === "sencilla") {
      return sencillaOptions(data.budgetEur, price).map(({ columnas, costEur }, index) =>
        radio({ modo, columnas }, index, `${columnasText(columnas)} · ${formatEuro(costEur, { fixed: true })}`, () => choose({ modo, columnas }, columnas, costEur)));
    }
    if (modo === "reducida") {
      return reduccionOptions(data.budgetEur, price).map((option, index) =>
        radio(
          { modo, reduccion: option.code }, index,
          <>
            {option.code} · {formatName(option.dobles, option.triples)} · {option.apuestas} apuestas · {formatEuro(option.costEur, { fixed: true })}
            {!option.fits && <span className="block text-meta font-normal text-fg-muted">Supera el presupuesto</span>}
          </>,
          () => choose({ modo, reduccion: option.code }, option.apuestas, option.costEur), !option.fits,
        ));
    }
    return data.intuicion.map((option: IntuicionOption, index) =>
      radio({ modo, fijos: option.fijos, columnas: option.columnas }, index, intuicionOptionLabel(option), () => choose({ modo, fijos: option.fijos, columnas: option.columnas }, option.columnas, option.costEur)));
  };

  const list = result?.status === "ok" ? options(result) : [];
  const fits = modo === "reducida" && result?.status === "ok" ? reduccionOptions(result.budgetEur, price).some(option => option.fits) : list.length > 0;

  return (
    <div className="grid gap-5">
      <section className="grid gap-3" aria-labelledby={`${uid}-budget-h`}>
        {headings && <h3 id={`${uid}-budget-h`} className="font-display text-h2 uppercase">{headings.budget}</h3>}
        <Field id={`${uid}-budget`} label="Presupuesto en euros" hint={perColumn ? `Cada columna cuesta ${formatEuro(perColumn, { fixed: true })}. El boleto mínimo es de 2 columnas.` : "El boleto mínimo es de 2 columnas."}>
          {control => (
            <div className="flex items-stretch gap-2">
              <TextInput {...control} inputMode="decimal" autoComplete="off" placeholder="Por ejemplo, 6" value={budget} onChange={event => edit(event.target.value)} onKeyDown={keyDown} className="min-w-0 flex-1" />
              <span aria-hidden="true" className="flex items-center text-body font-bold text-fg-muted">€</span>
            </div>
          )}
        </Field>
        <div role="group" aria-label="Presupuestos rápidos" className="flex flex-wrap gap-2">
          {BUDGET_CHIPS.map(amount => (
            <button
              key={amount}
              type="button"
              onClick={() => chip(amount)}
              className="tap inline-flex min-h-touch min-w-touch items-center justify-center rounded-pill border border-border-soft px-4 text-label font-bold tabular-nums hover-fine:border-action hover-fine:bg-action/10"
            >
              {amount} €
            </button>
          ))}
        </div>
        <Button variant="secondary" fullWidth loading={pending} onClick={() => load(budget)}>Ver opciones</Button>
      </section>

      <section className="grid gap-3" aria-labelledby={`${uid}-formats-h`}>
        {headings && <h3 id={`${uid}-formats-h`} className="font-display text-h2 uppercase">{headings.formats}</h3>}
        <fieldset className="grid gap-2">
          <legend className="mb-2 text-label font-bold">Modo del boleto</legend>
          {PORRA_MODES.map(item => (
            <label key={item} className="relative block">
              <input
                type="radio" name={`${uid}-modo`} value={item} checked={modo === item} className="peer sr-only"
                onChange={() => { setModo(item); reset(); }}
              />
              <span className={optionClasses}>
                <span className="text-body font-bold">{MODE_LABEL[item]}</span>
                <span className="text-label font-normal text-fg-muted">{MODE_BLURB[item]}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <div className="grid gap-3" aria-live="polite">
          <Reveal live={false} className="[--reveal-gap:0.75rem]">
            {result === null && <p className="text-label text-fg-muted">Escribe un presupuesto y pulsa «Ver opciones» para ver lo que cabe en cada modo.</p>}
          </Reveal>
          <Reveal live={false} className="[--reveal-gap:0.75rem]">{result?.status === "error" && <StatusMessage tone="error">{result.message}</StatusMessage>}</Reveal>
          <Reveal live={false} className="[--reveal-gap:0.75rem]">
            {result?.status === "ok" && !fits && (
              <StatusMessage tone="info">
                {modo === "intuicion" ? "Con ese presupuesto no cabe ninguna opción de Intuición: la más barata son 2 columnas." : "Con ese presupuesto no cabe ninguna opción en este modo. Sube el presupuesto o prueba otro modo."}
              </StatusMessage>
            )}
          </Reveal>
          {result?.status === "ok" && list.length > 0 && (
            <fieldset className="grid gap-2">
              <legend className="mb-2 text-label font-bold">
                {modo === "sencilla" ? "¿Cuántas columnas?" : modo === "reducida" ? "Elige una reducción" : `Elige una opción (${list.length})`}
              </legend>
              {list}
            </fieldset>
          )}
        </div>
      </section>
    </div>
  );
}
