"use client";

import { useId, useState, type ReactNode } from "react";
import { Info } from "@phosphor-icons/react/dist/ssr/Info";
import { Reveal } from "@/components/motion/reveal";
import { TeamCrest } from "@/components/ui/team-crest";
import { cn } from "@/lib/cn";
import { formatEuro } from "@/lib/format-money";
import {
  PLENO_AWAY_FIELD, PLENO_HOME_FIELD, kindOf, pickField, plenoText, proposeGoals, rowText, setPleno, sharesOf, toggleSign, type BoletoDraft, type FieldErrors,
} from "../../domain/logic";
import { columnasText } from "../../domain/modes";
import { GOALS, SIGNS, type Goals, type PickKind, type Pleno, type PlenoCounts, type Sign } from "../../domain/porras";

export type BoletoFixture = {
  position: number;
  homeName: string;
  awayName: string;
  homeShort?: string | null;
  awayShort?: string | null;
  homeLogoUrl?: string | null;
  awayLogoUrl?: string | null;
};

/**
 * `vote` (member): interactive. `final`: read-only official boleto with its stamp.
 * `proposal` (admin): read-only media of the votes, with the share bars 1/X/2 and the kind of each row.
 * `edit` (admin): interactive, with live dobles/triples counters against the porra's format.
 */
export type BoletoMode = "vote" | "final" | "proposal" | "edit";

type Shared = {
  fixtures: readonly BoletoFixture[];
  jornada: number;
  /** e.g. "2026/2027". */
  temporada?: string;
  /** Printed columns drawn faded next to the voting column (`vote` only; default 8). Decoration: the real count comes from `columns`. */
  totalColumns?: number;
  /** Interactive columns among the printed ones (default 1). */
  activeColumns?: number;
  /** Sentence under the title; overrides the one each mode writes. */
  caption?: string;
  /** Renders an info button per row (and for the pleno match, position 15). */
  onInfo?: (position: number) => void;
  /** Spanish messages keyed `pick-N`, `pleno-home`, `pleno-away` (see validateVote). */
  errors?: FieldErrors;
  /** Vote weights per row (keys 1..14) and pleno counts: draws the share bars (proposal, edit). */
  proposal?: BoletoProposal;
  /**
   * Several printed columns side by side (`vote`, `edit` and `final`; sencilla, Intuición): `columnPicks[c][r]` holds the signs of
   * match r+1 in column c. The pleno stays single, in `value`. Without it the boleto draws the one column of `value`.
   */
  columnPicks?: readonly (readonly (readonly Sign[])[])[];
  className?: string;
};

/** What the admin's proposal adds to the ticket. Plain data so it can cross the server/client boundary. */
export type BoletoProposal = {
  weights: Record<number, Record<Sign, number>>;
  /** Votes per value for each team; the API no longer sends them, so the tally only shows when given. */
  plenoCounts?: { home: PlenoCounts; away: PlenoCounts };
  /** The computed pleno proposal. */
  pleno?: Pleno;
};

type Editable = Shared & {
  mode: "vote" | "edit";
  value: BoletoDraft;
  onChange: (next: BoletoDraft) => void;
  /**
   * One sign per match (sencilla, Intuición): the 1/X/2 boxes behave as a radio group and a click calls this with the
   * chosen sign instead of toggling it through `onChange`. The pleno still goes through `onChange`.
   */
  onSign?: (position: number, sign: Sign) => void;
  /** With `onSign`: matches 1..lockedRows are tagged "Fijo" (they are edited once and mirrored to every column). */
  lockedRows?: number;
  /** With `columnPicks` (`vote`, `edit`): a click on a sign of column `column` (0-based). The domain helper mirrors the fijos. */
  onColumnSign?: (column: number, position: number, sign: Sign) => void;
  /** With `columnPicks` (`vote`, `edit`): shows a "copy the previous column" control in the header of every column but the first. */
  onCopyColumn?: (column: number) => void;
};
type ReadOnly = Shared & {
  mode: "final" | "proposal";
  value: BoletoDraft;
  /** Columns and cost of the boleto, shown in the footer when both are given. */
  columns?: number;
  costEur?: string;
  /** Stamp text of the `final` mode (default "Boleto de la peña"); null hides it, e.g. for a member's own read-only picks. */
  stamp?: string | null;
};

export type BoletoProps = Editable | ReadOnly;

const SIGN_LABEL: Record<Sign, (home: string, away: string) => string> = {
  "1": (home) => `Gana ${home}, signo 1`,
  X: () => "Empate, signo X",
  "2": (_home, away) => `Gana ${away}, signo 2`,
};

const GOALS_LABEL: Record<Goals, string> = { "0": "0 goles", "1": "1 gol", "2": "2 goles", M: "Más de 2 goles" };

const nameOf = (full: string, short?: string | null) => short?.trim() || full;

const KIND_LABEL: Record<PickKind, string> = { simple: "Simple", doble: "Doble", triple: "Triple" };
const KIND_STYLE: Record<PickKind, string> = {
  simple: "border-ink/40 text-ink/70",
  doble: "border-ink/60 bg-ink/15 text-ink",
  triple: "border-ink bg-ink text-cream",
};

/** Row tag: "Simple", "Doble" or "Triple" (or "Sin marcar" while empty). */
function KindTag({ signs }: { signs: readonly Sign[] }) {
  const kind = kindOf(signs);
  return (
    <span className={cn("inline-flex min-h-5 shrink-0 items-center rounded-pill border px-2 text-meta font-bold uppercase tracking-wide", kind ? KIND_STYLE[kind] : "border-dashed border-ink/40 text-ink/50")}>
      {kind ? KIND_LABEL[kind] : "Sin marcar"}
    </span>
  );
}

/** Row tag of an Intuición fijo: its sign is the same in every column. */
function FixedTag() {
  return <span className="inline-flex min-h-5 shrink-0 items-center rounded-pill border border-ink bg-ink px-2 text-meta font-bold uppercase tracking-wide text-cream">Fijo</span>;
}

/** Share (%) of each sign as a small bar under its own box (same 44px columns as the boxes). Decorative: the row legend has the text. */
function ShareBars({ weights, chosen }: { weights: Record<Sign, number>; chosen: readonly Sign[] }) {
  const shares = sharesOf(weights);
  return (
    <div aria-hidden="true" className="flex gap-1">
      {SIGNS.map(sign => (
        <span key={sign} className="grid w-11 gap-0.5">
          <span className="h-2 overflow-hidden rounded-pill bg-ink/15">
            <span className={cn("block h-full rounded-pill", chosen.includes(sign) ? "bg-ink" : "bg-ink/40")} style={{ width: `${shares[sign]}%` }} />
          </span>
          <span className={cn("text-center text-meta tabular-nums", chosen.includes(sign) ? "font-bold text-ink" : "text-ink/60")}>{shares[sign]}%</span>
        </span>
      ))}
    </div>
  );
}

const shareText = (weights: Record<Sign, number>) => {
  const shares = sharesOf(weights);
  return `Reparto de votos: 1 ${shares["1"]} %, X ${shares.X} %, 2 ${shares["2"]} %`;
};

const countsText = (counts: PlenoCounts) => GOALS.map(goal => `${goal}: ${counts[goal]}`).join(" · ");

type BoxProps = {
  kind: "checkbox" | "radio";
  name?: string;
  label: string;
  text: string;
  checked: boolean;
  interactive: boolean;
  size: "lg" | "md" | "sm";
  onChange?: () => void;
  className?: string;
};

/** One 1/X/2 or 0/1/2/M box. Interactive boxes are real inputs; read-only ones are decorative (the row has a text equivalent). */
function Box({ kind, name, label, text, checked, interactive, size, onChange, className }: BoxProps) {
  const dims = size === "lg" ? "size-11" : size === "md" ? "size-10" : "size-4";
  if (!interactive) {
    return (
      <span className={cn("boleto-box", dims, className)} data-size={size} aria-hidden="true">
        <span className="boleto-cell" data-marked={checked}>{size !== "sm" ? text : ""}</span>
      </span>
    );
  }
  return (
    <label className={cn("boleto-box", dims, className)} data-size={size}>
      <input type={kind} name={name} checked={checked} onChange={onChange} aria-label={label} className="boleto-input" />
      <span className="boleto-cell" aria-hidden="true">{text}</span>
    </label>
  );
}

/**
 * Paper quiniela: cream sheet, 14 match rows with 1 X 2 boxes, and the pleno al 15 box.
 * Only `activeColumns` columns are interactive; the rest are decorative. Controlled: pass `value` (and `onChange` in `vote`).
 */
export function Boleto(props: BoletoProps) {
  const { fixtures, jornada, temporada, totalColumns = 8, activeColumns = 1, onInfo, errors = {}, className, value } = props;
  const editable = props.mode === "vote" || props.mode === "edit";
  const onChange = editable ? (props as Editable).onChange : undefined;
  const onSign = editable ? (props as Editable).onSign : undefined;
  const lockedRows = editable ? (props as Editable).lockedRows ?? 0 : 0;
  const onColumnSign = editable ? (props as Editable).onColumnSign : undefined;
  const onCopyColumn = editable ? (props as Editable).onCopyColumn : undefined;
  const columnPicks = props.columnPicks;
  const multi = columnPicks !== undefined && columnPicks.length > 0;
  // Multi-column sheets show one column at a time behind a switcher instead of scrolling sideways.
  const [activeColumn, setActiveColumn] = useState(0);
  const current = multi ? Math.min(activeColumn, columnPicks.length - 1) : 0;
  const uid = useId();
  const byPosition = new Map(fixtures.map((f) => [f.position, f]));
  const rows = fixtures.filter((f) => f.position >= 1 && f.position <= 14).sort((a, b) => a.position - b.position);
  const pleno = byPosition.get(15);
  // The faded printed columns only decorate the member's voting sheet; the final and edit sheets show what is really played.
  const inactive = props.mode === "vote" && !multi ?Math.max(0, totalColumns - activeColumns) : 0;
  const readOnly = editable ? null : (props as ReadOnly);
  const final = props.mode === "final" ? (props as ReadOnly) : null;
  const stamp = final ? (final.stamp === undefined ? "Boleto de la peña" : final.stamp) : null;
  const summary = readOnly?.columns !== undefined && readOnly.costEur ? `${columnasText(readOnly.columns)} · ${formatEuro(readOnly.costEur, { fixed: true }) ?? readOnly.costEur}` : null;
  const proposal = props.proposal;
  const showMeta = props.mode === "proposal" || props.mode === "edit";
  const caption = props.caption
    ?? (props.mode === "proposal" ? "Propuesta calculada con los votos de la peña"
      : props.mode === "edit" || props.mode === "vote" ? (multi ? "Marca un signo por partido en cada columna" : onSign ? "Marca un signo por partido" : "Marca de 1 a 3 signos por partido")
      : readOnly?.columns ? `Tu peña juega ${columnasText(readOnly.columns)}` : "Boleto de la peña");

  const infoButton = (position: number, content: ReactNode) =>
    onInfo ? (
      <button
        type="button"
        onClick={() => onInfo(position)}
        aria-label={`Ver información del partido ${position}`}
        className="tap relative flex min-h-touch min-w-touch flex-col items-center justify-center rounded-control font-display text-h2 leading-none text-ink hover-fine:bg-ink/10"
      >
        {content}
        <Info size={14} weight="bold" aria-hidden="true" className="mt-0.5 opacity-70" />
      </button>
    ) : (
      <span className="flex min-h-touch min-w-touch items-center justify-center font-display text-h2 leading-none text-ink/80">{content}</span>
    );

  return (
    <div className={cn("@container w-full max-w-[60rem]", className)}>
      <section aria-label={`Boleto de la jornada ${jornada}`} className="boleto-paper relative rounded-card border-(length:--bw-thick) border-ink bg-cream px-3 pb-5 pt-4 text-ink [filter:drop-shadow(6px_6px_0_var(--color-ink))] @md:px-6">
        {stamp && (
          <p className="absolute right-3 top-3 -rotate-6 border-2 border-double border-ink/70 px-2 py-0.5 font-display text-label uppercase tracking-widest text-ink/70 @md:right-6">
            {stamp}
          </p>
        )}
        <header className="grid gap-1 border-b-(length:--bw-thick) border-ink pb-3">
          <span aria-hidden="true" className="mb-1 block h-2.5 w-10 border-2 border-ink bg-signal" />
          <h2 className="font-display text-[2.75rem] uppercase leading-[0.9] text-ink">La Quiniela</h2>
          <p className="font-ui text-label font-bold uppercase tracking-wide">
            Jornada {jornada}{temporada ? ` · Temporada ${temporada}` : ""}
          </p>
          <p className="text-meta text-ink/80">
            {caption}.
            {inactive > 0 && !showMeta && <span className="@4xl:hidden"> +{inactive} {inactive === 1 ? "columna" : "columnas"} en el boleto real.</span>}
          </p>
        </header>

        {multi && columnPicks ? (
          <div className="mt-2 grid">
            <div className="flex flex-wrap items-center gap-2 border-b border-ink/30 pb-2">
              <div role="group" aria-label="Columnas del boleto" className="flex flex-wrap gap-1">
                {columnPicks.map((column, c) => {
                  const done = column.length > 0 && column.every(signs => signs.length > 0);
                  const selected = c === current;
                  return (
                    <button
                      key={c} type="button" onClick={() => setActiveColumn(c)} aria-pressed={selected}
                      aria-label={`Columna ${c + 1}, ${done ? "completa" : "incompleta"}`}
                      className={cn(
                        "tap flex min-h-touch min-w-touch items-center justify-center gap-1 rounded-control border-2 border-ink px-2 font-display text-h2 leading-none tabular-nums",
                        selected ? "bg-ink text-cream" : "bg-cream text-ink hover-fine:bg-ink/10",
                      )}
                    >
                      <span aria-hidden="true">{c + 1}</span>
                      <span aria-hidden="true" className={cn("text-meta", selected ? "text-cream" : done ? "text-ink" : "text-ink/50")}>{done ? "✓" : "…"}</span>
                    </button>
                  );
                })}
              </div>
              {onCopyColumn && current > 0 && (
                <button
                  type="button" onClick={() => onCopyColumn(current)} aria-label={`Copiar la columna ${current} en la columna ${current + 1}`}
                  className="tap ml-auto min-h-touch rounded-pill border border-ink/50 px-3 text-meta font-bold hover-fine:bg-ink/10"
                >
                  Copiar col. {current}
                </button>
              )}
            </div>
            <p className="pt-2 text-meta font-bold uppercase tracking-wide text-ink/70" aria-live="polite">Columna {current + 1} de {columnPicks.length}</p>
            {rows.map((fx, index) => {
              const signs = columnPicks[current]?.[fx.position - 1] ?? [];
              const home = nameOf(fx.homeName, fx.homeShort);
              const away = nameOf(fx.awayName, fx.awayShort);
              const error = errors[pickField(fx.position)];
              const errorId = `${uid}-err-${fx.position}`;
              const fijo = fx.position <= lockedRows;
              return (
                <fieldset key={fx.position} aria-describedby={error ? errorId : undefined} className={cn("border-b border-ink/30 py-1", index % 2 === 0 && "bg-ink/[0.04]")}>
                  <legend className="sr-only">
                    {`Columna ${current + 1}. ${rowText(fx.position, fx.homeName, fx.awayName, signs)}`}
                    {fijo ? ". Partido fijo: vale para todas las columnas" : ""}
                  </legend>
                  <div className="flex items-center gap-2">
                    {infoButton(fx.position, fx.position)}
                    <div className="grid min-w-0 flex-1 gap-0.5" aria-hidden="true">
                      <span className="flex min-w-0 items-center gap-1.5"><TeamCrest name={fx.homeName} logoUrl={fx.homeLogoUrl} size="sm" className="size-5!" /><span className="truncate text-label font-bold">{home}</span></span>
                      <span className="flex min-w-0 items-center gap-1.5"><TeamCrest name={fx.awayName} logoUrl={fx.awayLogoUrl} size="sm" className="size-5!" /><span className="truncate text-label font-bold">{away}</span></span>
                    </div>
                    <div className="flex gap-1">
                      {SIGNS.map(sign => (
                        <Box
                          key={sign} kind="radio" name={`${uid}-row-${fx.position}-col-${current}`} size="lg" text={sign} label={SIGN_LABEL[sign](home, away)}
                          checked={signs.includes(sign)} interactive={editable}
                          onChange={() => onColumnSign?.(current, fx.position, sign)}
                        />
                      ))}
                    </div>
                  </div>
                  <Reveal live={false}>{error && <p id={errorId} role="alert" className="px-2 pb-1 pt-0.5 text-meta font-bold text-[#8a2410]">{error}</p>}</Reveal>
                </fieldset>
              );
            })}
          </div>
        ) : (
        <div className="mt-2 grid">
          {rows.map((fx, index) => {
            const signs = value.picks[fx.position - 1] ?? [];
            const home = nameOf(fx.homeName, fx.homeShort);
            const away = nameOf(fx.awayName, fx.awayShort);
            const error = errors[pickField(fx.position)];
            const errorId = `${uid}-err-${fx.position}`;
            return (
              <fieldset key={fx.position} aria-describedby={error ? errorId : undefined} className={cn("border-b border-ink/30 py-1", index % 2 === 0 && "bg-ink/[0.04]")}>
                <legend className="sr-only">
                  {rowText(fx.position, fx.homeName, fx.awayName, signs)}
                  {showMeta && kindOf(signs) ? `. ${KIND_LABEL[kindOf(signs) as PickKind]}` : ""}
                  {showMeta && proposal?.weights[fx.position] ? `. ${shareText(proposal.weights[fx.position])}` : ""}
                </legend>
                <div className="flex items-center gap-2">
                  {infoButton(fx.position, fx.position)}
                  <div className="grid min-w-0 flex-1 gap-0.5" aria-hidden="true">
                    <span className="flex min-w-0 items-center gap-1.5"><TeamCrest name={fx.homeName} logoUrl={fx.homeLogoUrl} size="sm" className="size-5!" /><span className="truncate text-label font-bold">{home}</span></span>
                    <span className="flex min-w-0 items-center gap-1.5"><TeamCrest name={fx.awayName} logoUrl={fx.awayLogoUrl} size="sm" className="size-5!" /><span className="truncate text-label font-bold">{away}</span></span>
                  </div>
                  <div className="flex gap-1">
                    {SIGNS.map((sign) => (
                      <Box
                        key={sign} kind={onSign ? "radio" : "checkbox"} name={onSign ? `${uid}-row-${fx.position}` : undefined} size="lg" text={sign} label={SIGN_LABEL[sign](home, away)}
                        checked={signs.includes(sign)} interactive={editable}
                        onChange={() => (onSign ? onSign(fx.position, sign) : onChange?.(toggleSign(value, fx.position, sign)))}
                      />
                    ))}
                  </div>
                  {inactive > 0 && !showMeta && (
                    <div aria-hidden="true" className="hidden gap-2 opacity-35 @4xl:flex">
                      {Array.from({ length: inactive }, (_, col) => (
                        <div key={col} className="flex gap-0.5">{SIGNS.map((sign) => <Box key={sign} kind="checkbox" size="sm" text={sign} label="" checked={false} interactive={false} />)}</div>
                      ))}
                    </div>
                  )}
                </div>
                {showMeta && !onSign && (
                  <div className="flex items-start justify-between gap-2 pb-1 pt-1">
                    <KindTag signs={signs} />
                    {proposal?.weights[fx.position] && <ShareBars weights={proposal.weights[fx.position]} chosen={signs} />}
                  </div>
                )}
                {onSign && fx.position <= lockedRows && (
                  <div className="flex justify-end pb-1">
                    <FixedTag />
                  </div>
                )}
                <Reveal live={false}>{error && <p id={errorId} role="alert" className="px-2 pb-1 pt-0.5 text-meta font-bold text-[#8a2410]">{error}</p>}</Reveal>
              </fieldset>
            );
          })}
        </div>
        )}

        <fieldset className="mt-4 border-2 border-ink p-3">
          <legend className="sr-only">{plenoText(pleno?.homeName ?? "Local", pleno?.awayName ?? "Visitante", value.pleno)}</legend>
          <div className="mb-2 flex items-center justify-between">
            <p className="font-display text-h2 uppercase" aria-hidden="true">Pleno al 15</p>
            {pleno && infoButton(15, <span className="text-label">15</span>)}
          </div>
          {([["home", PLENO_HOME_FIELD, "Local"], ["away", PLENO_AWAY_FIELD, "Visitante"]] as const).map(([team, field, role]) => {
            const fullName = pleno ? (team === "home" ? pleno.homeName : pleno.awayName) : role;
            const shortName = pleno ? nameOf(fullName, team === "home" ? pleno.homeShort : pleno.awayShort) : role;
            const logo = pleno ? (team === "home" ? pleno.homeLogoUrl : pleno.awayLogoUrl) : null;
            const current = value.pleno[team];
            const error = errors[field];
            return (
              <fieldset key={team} aria-describedby={error ? `${uid}-${field}` : undefined} className="py-1">
                <legend className="sr-only">{`Goles de ${role.toLowerCase()}: ${fullName}`}</legend>
                <div className="flex items-center gap-2">
                  <span className="flex min-w-0 flex-1 items-center gap-1.5" aria-hidden="true">
                    <TeamCrest name={fullName} logoUrl={logo} size="sm" className="size-5!" />
                    <span className="truncate text-label font-bold">{shortName}</span>
                  </span>
                  <div className="flex gap-1">
                    {GOALS.map((goal) => (
                      <Box
                        key={goal} kind="radio" name={`${uid}-${field}`} size="lg" text={goal} label={`${GOALS_LABEL[goal]}, ${fullName}`}
                        checked={current === goal} interactive={editable}
                        onChange={() => onChange?.(setPleno(value, team, goal))}
                      />
                    ))}
                  </div>
                </div>
                {proposal?.plenoCounts && showMeta && (
                  <p className="pt-0.5 text-meta tabular-nums text-ink/75">
                    <span className="sr-only">Votos del equipo: </span>Votos · {countsText(proposal.plenoCounts[team])}
                    {props.mode === "proposal" && <span> · Propuesta: <strong>{proposal.pleno?.[team] ?? proposeGoals(proposal.plenoCounts[team])}</strong></span>}
                  </p>
                )}
                <Reveal live={false}>{error && <p id={`${uid}-${field}`} role="alert" className="pt-0.5 text-meta font-bold text-[#8a2410]">{error}</p>}</Reveal>
              </fieldset>
            );
          })}
        </fieldset>

        {summary && <p className="mt-3 text-label font-bold tabular-nums">{summary}</p>}
      </section>
    </div>
  );
}
