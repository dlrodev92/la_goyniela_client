import { GOALS, MATCH_COUNT, SIGNS, type Goals, type Money, type PickKind, type PicksSheet, type PlenoCounts, type Pleno, type PorraFormat, type PorraModo, type Propuesta, type Sign, type Vote } from "./porras";

/** Editable ballot: `picks[i]` holds the signs marked on match i+1; the pleno may be incomplete. */
export type BoletoDraft = {
  picks: Sign[][];
  pleno: { home: Goals | null; away: Goals | null };
};

export type FieldErrors = Record<string, string>;

export function emptyDraft(): BoletoDraft {
  return { picks: Array.from({ length: MATCH_COUNT }, () => []), pleno: { home: null, away: null } };
}

export function draftFromVote(vote: Vote): BoletoDraft {
  const draft = emptyDraft();
  for (const pick of vote.columnas[0] ?? []) {
    if (pick.position >= 1 && pick.position <= MATCH_COUNT) draft.picks[pick.position - 1] = sortSigns(pick.signs);
  }
  draft.pleno = { home: vote.pleno.home, away: vote.pleno.away };
  return draft;
}

/** The caller's saved picks as a draft; an empty draft when they have not voted. A missing pleno stays unmarked. */
export function draftFromSheet(sheet: PicksSheet | null): BoletoDraft {
  const draft = emptyDraft();
  if (!sheet) return draft;
  for (const pick of sheet.picks) {
    if (pick.position >= 1 && pick.position <= MATCH_COUNT) draft.picks[pick.position - 1] = sortSigns(pick.signs);
  }
  if (sheet.pleno) draft.pleno = { home: sheet.pleno.home, away: sheet.pleno.away };
  return draft;
}

/** Unique signs in printed order (1, X, 2). */
export function sortSigns(signs: readonly Sign[]): Sign[] {
  return SIGNS.filter(sign => signs.includes(sign));
}

/** Adds the sign when absent, removes it when present. Pure: returns a new draft. */
export function toggleSign(draft: BoletoDraft, position: number, sign: Sign): BoletoDraft {
  if (position < 1 || position > MATCH_COUNT) return draft;
  const current = draft.picks[position - 1];
  const next = current.includes(sign) ? current.filter(item => item !== sign) : sortSigns([...current, sign]);
  return { ...draft, picks: draft.picks.map((signs, index) => (index === position - 1 ? next : signs)) };
}

export function setPleno(draft: BoletoDraft, team: "home" | "away", value: Goals): BoletoDraft {
  return { ...draft, pleno: { ...draft.pleno, [team]: value } };
}

/** Columns of a multiple ticket: 2^dobles * 3^triples (all simples = 1). */
export function columnsFor(dobles: number, triples: number): number {
  return 2 ** dobles * 3 ** triples;
}

export function kindOf(signs: readonly Sign[]): PickKind | null {
  const count = new Set(signs).size;
  return count === 1 ? "simple" : count === 2 ? "doble" : count === 3 ? "triple" : null;
}

// ---- Decimal-safe money: integers scaled by 10^6, never floats. ----

const SCALE = 6;
const UNIT = BigInt(1000000);
const HALF_CENT = BigInt(5000);
const CENT = BigInt(10000);
const HUNDRED = BigInt(100);

/** "0.75" / "12" / "12.5" -> scaled bigint; null for anything that is not a plain non-negative decimal. */
export function moneyUnits(raw: Money | null | undefined): bigint | null {
  const value = raw?.trim();
  if (!value) return null;
  const match = /^(\d+)(?:\.(\d{1,6}))?$/.exec(value);
  if (!match) return null;
  return BigInt(match[1]) * UNIT + BigInt((match[2] ?? "").padEnd(SCALE, "0"));
}

/** Scaled bigint -> "12.00" (two decimals, half up). */
export function formatMoneyUnits(units: bigint): Money {
  const cents = (units + HALF_CENT) / CENT;
  const whole = cents / HUNDRED;
  const rest = cents % HUNDRED;
  return `${whole}.${rest.toString().padStart(2, "0")}`;
}

/** Cost of a ticket: columns x price per column, as a two-decimal string; null when the price is invalid. */
export function costFor(columns: number, price: Money): Money | null {
  const unit = moneyUnits(price);
  if (unit === null || !Number.isInteger(columns) || columns < 0) return null;
  return formatMoneyUnits(unit * BigInt(columns));
}

export type FormatUsage = { dobles: number; triples: number; simples: number; incomplete: number; columns: number };

/** How many dobles/triples a draft (or an edited boleto) uses; rows without signs count as incomplete. */
export function formatUsage(draft: Pick<BoletoDraft, "picks">): FormatUsage {
  let dobles = 0;
  let triples = 0;
  let simples = 0;
  let incomplete = 0;
  for (const signs of draft.picks) {
    const kind = kindOf(signs);
    if (kind === "doble") dobles += 1;
    else if (kind === "triple") triples += 1;
    else if (kind === "simple") simples += 1;
    else incomplete += 1;
  }
  return { dobles, triples, simples, incomplete, columns: columnsFor(dobles, triples) };
}

/** True when the draft's columns cost more than the budget. Compared in scaled integers; invalid money counts as over. */
export function overBudget(usage: Pick<FormatUsage, "columns">, budgetEur: Money, priceEur: Money): boolean {
  const budget = moneyUnits(budgetEur);
  const price = moneyUnits(priceEur);
  if (budget === null || price === null) return true;
  return price * BigInt(usage.columns) > budget;
}

/** True when the draft uses exactly the porra's format. */
export function matchesFormat(usage: Pick<FormatUsage, "dobles" | "triples" | "incomplete">, format: { dobles: number; triples: number }): boolean {
  return usage.incomplete === 0 && usage.dobles === format.dobles && usage.triples === format.triples;
}

const MATCH_FIELD = (position: number) => `pick-${position}`;
export const pickField = MATCH_FIELD;
export const PLENO_HOME_FIELD = "pleno-home";
export const PLENO_AWAY_FIELD = "pleno-away";

/** Spanish per-field errors. Keys: `pick-N` (1..14), `pleno-home`, `pleno-away`. Empty object means valid. */
export function validateVote(draft: BoletoDraft): FieldErrors {
  const errors: FieldErrors = {};
  for (let position = 1; position <= MATCH_COUNT; position += 1) {
    const signs = draft.picks[position - 1] ?? [];
    if (signs.length === 0) errors[MATCH_FIELD(position)] = `Partido ${position}: marca al menos un signo.`;
    else if (signs.length > 3 || new Set(signs).size !== signs.length || signs.some(sign => !SIGNS.includes(sign))) {
      errors[MATCH_FIELD(position)] = `Partido ${position}: marca entre uno y tres signos distintos.`;
    }
  }
  if (!draft.pleno.home || !GOALS.includes(draft.pleno.home)) errors[PLENO_HOME_FIELD] = "Pleno al 15: elige los goles del equipo local.";
  if (!draft.pleno.away || !GOALS.includes(draft.pleno.away)) errors[PLENO_AWAY_FIELD] = "Pleno al 15: elige los goles del equipo visitante.";
  return errors;
}

/** The wire-ready single-column vote when the draft is valid, otherwise null. */
export function voteFromDraft(draft: BoletoDraft): Vote | null {
  if (Object.keys(validateVote(draft)).length > 0 || !draft.pleno.home || !draft.pleno.away) return null;
  return {
    columnas: [draft.picks.map((signs, index) => ({ position: index + 1, signs: sortSigns(signs) }))],
    pleno: { home: draft.pleno.home, away: draft.pleno.away },
  };
}

const SIGN_WORDS: Record<Sign, string> = { "1": "1", X: "X", "2": "2" };

/** "1", "1 y X", "1, X y 2"; "sin marcar" when empty. */
export function signsText(signs: readonly Sign[]): string {
  const sorted = sortSigns(signs).map(sign => SIGN_WORDS[sign]);
  if (sorted.length === 0) return "sin marcar";
  if (sorted.length === 1) return sorted[0];
  return `${sorted.slice(0, -1).join(", ")} y ${sorted[sorted.length - 1]}`;
}

/** Screen-reader equivalent of a boleto row: "Partido 3, Barcelona contra Getafe: 1 y X". */
export function rowText(position: number, home: string, away: string, signs: readonly Sign[]): string {
  return `Partido ${position}, ${home} contra ${away}: ${signsText(signs)}`;
}

/** "Pleno al 15, Barcelona 1, Getafe M" (or "sin marcar" per team). */
export function plenoText(home: string, away: string, pleno: { home: Goals | null; away: Goals | null }): string {
  return `Pleno al 15, ${home} ${pleno.home ?? "sin marcar"}, ${away} ${pleno.away ?? "sin marcar"}`;
}

/** Most voted value; ties go to the value with fewer goals (0 < 1 < 2 < M). Empty counts give "0". */
export function proposeGoals(counts: PlenoCounts): Goals {
  let best: Goals = "0";
  for (const value of GOALS) if (counts[value] > counts[best]) best = value;
  return best;
}

export function proposePleno(counts: { home: PlenoCounts; away: PlenoCounts }): Pleno {
  return { home: proposeGoals(counts.home), away: proposeGoals(counts.away) };
}

/** Progress shown in the minimized sheet: rows with at least one sign (n/14) and whether the pleno is complete. */
export function draftProgress(draft: BoletoDraft): { marked: number; plenoDone: boolean } {
  return { marked: draft.picks.filter(signs => signs.length > 0).length, plenoDone: draft.pleno.home !== null && draft.pleno.away !== null };
}

export function draftsEqual(a: BoletoDraft, b: BoletoDraft): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export const draftStorageKey = (porraId: string) => `goyniela:boleto-draft:${porraId}`;

/** Stored with the server baseline it was started from, so a draft made against an older saved boleto is never revived. */
export function encodeDraft(base: BoletoDraft, draft: BoletoDraft): string {
  return JSON.stringify({ base, draft });
}

/** True when an untrusted value has the shape of a `BoletoDraft` (14 rows of at most 3 signs, pleno values or null). */
export function isBoletoDraft(value: unknown): value is BoletoDraft {
  if (typeof value !== "object" || value === null) return false;
  const { picks, pleno } = value as { picks?: unknown; pleno?: unknown };
  if (!Array.isArray(picks) || picks.length !== MATCH_COUNT) return false;
  if (!picks.every(signs => Array.isArray(signs) && signs.length <= 3 && signs.every(sign => SIGNS.includes(sign)))) return false;
  if (typeof pleno !== "object" || pleno === null) return false;
  const { home, away } = pleno as { home?: unknown; away?: unknown };
  return (home === null || GOALS.includes(home as Goals)) && (away === null || GOALS.includes(away as Goals));
}

/** The stored draft when it is well formed and was started from `base`; otherwise null. */
export function decodeDraft(raw: string | null, base: BoletoDraft): BoletoDraft | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const { base: storedBase, draft } = parsed as { base?: unknown; draft?: unknown };
    if (!isBoletoDraft(storedBase) || !isBoletoDraft(draft) || !draftsEqual(storedBase, base)) return null;
    return { picks: draft.picks.map(sortSigns), pleno: { home: draft.pleno.home, away: draft.pleno.away } };
  } catch {
    return null;
  }
}

/** Marks the rows the backend flagged on a 422 (1-based, 15 = pleno). */
export function flaggedFields(rows: readonly number[]): FieldErrors {
  const errors: FieldErrors = {};
  for (const row of rows) {
    if (row >= 1 && row <= MATCH_COUNT) errors[pickField(row)] = `Partido ${row}: revisa esta fila.`;
    else if (row === 15) {
      errors[PLENO_HOME_FIELD] = "Pleno al 15: revisa los goles.";
      errors[PLENO_AWAY_FIELD] = "Pleno al 15: revisa los goles.";
    }
  }
  return errors;
}

// ---- Admin: formats, proposal and final boleto editing ----

/** A sellable format: counts are integers, at most 14 matches are upgraded and never (0, 0): the minimum is 2 columns. */
export function isValidFormat(dobles: number, triples: number): boolean {
  return Number.isInteger(dobles) && Number.isInteger(triples) && dobles >= 0 && triples >= 0 && dobles + triples <= MATCH_COUNT && dobles + triples >= 1;
}

/** Cost of a (dobles, triples) format at `price` per column: 2^D * 3^T columns x price; null when the price is invalid. */
export function formatCost(dobles: number, triples: number, price: Money): Money | null {
  return costFor(columnsFor(dobles, triples), price);
}

/** A format as the admin sees it: the API's columns and cost, never recomputed. */
export type FormatOption = { dobles: number; triples: number; columns: number; costEur: Money };

/**
 * The API's feasible formats as options, most columns first (ties: more dobles first). (0, 0) and anything that is not a
 * valid format is dropped defensively, and so is any format whose own cost is above the budget.
 */
export function formatOptions(formats: readonly PorraFormat[], budgetEur: Money): FormatOption[] {
  const budget = moneyUnits(budgetEur);
  const options: FormatOption[] = [];
  for (const { dobles, triples, columns, costEur } of formats) {
    const cost = moneyUnits(costEur);
    if (!isValidFormat(dobles, triples) || cost === null || (budget !== null && cost > budget)) continue;
    options.push({ dobles, triples, columns: columns > 0 ? columns : columnsFor(dobles, triples), costEur });
  }
  return options.sort((a, b) => b.columns - a.columns || b.dobles - a.dobles);
}

/** Price of one column implied by the options (cost / columns, e.g. "0.75"); null without options. */
export function pricePerColumn(options: readonly Pick<FormatOption, "columns" | "costEur">[]): Money | null {
  for (const { columns, costEur } of options) {
    const cost = moneyUnits(costEur);
    if (cost !== null && columns > 0) return formatMoneyUnits(cost / BigInt(columns));
  }
  return null;
}

/** "1 doble + 1 triple". (0, 0) is only the shape of the modes that play simples; there it reads "solo simples". */
export function formatName(dobles: number, triples: number): string {
  const parts = [dobles > 0 ? `${dobles} ${dobles === 1 ? "doble" : "dobles"}` : null, triples > 0 ? `${triples} ${triples === 1 ? "triple" : "triples"}` : null];
  return parts.filter((part): part is string => part !== null).join(" + ") || "solo simples";
}

/** "4,50 €" (two decimals, es-ES). */
export const euro = (money: Money) => `${new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(money))} €`;

/** "1 doble + 1 triple · 6 columnas · 4,50 €". */
export function formatOptionLabel(option: FormatOption): string {
  return `${formatName(option.dobles, option.triples)} · ${option.columns} ${option.columns === 1 ? "columna" : "columnas"} · ${euro(option.costEur)}`;
}

/** A stored budget ("6.00", "6.50") as the text the budget input starts with ("6", "6,50"). Empty for anything that is not money. */
export function budgetText(budgetEur: Money): string {
  const units = moneyUnits(budgetEur);
  if (units === null) return "";
  const [whole, cents] = formatMoneyUnits(units).split(".");
  return cents === "00" ? whole : `${whole},${cents}`;
}

/** Plain decimal ("6", "6,5", "6.50") to the wire form "6.50"; null when empty, not a number, zero or above 10 000. */
export function parseBudget(raw: string): Money | null {
  const text = raw.trim().replace(/\s|€/g, "").replace(",", ".");
  const units = moneyUnits(text);
  if (units === null || units <= BigInt(0) || units > BigInt(10000) * UNIT) return null;
  return formatMoneyUnits(units);
}

/** Percentages (0-100, summing 100 when anyone voted) of one proposal row's vote weights; all 0 without votes. */
export function sharesOf(weights: Record<Sign, number>): Record<Sign, number> {
  const total = SIGNS.reduce((sum, sign) => sum + Math.max(0, weights[sign] ?? 0), 0);
  const out: Record<Sign, number> = { "1": 0, X: 0, "2": 0 };
  if (!(total > 0)) return out;
  const exact = SIGNS.map(sign => (Math.max(0, weights[sign] ?? 0) / total) * 100);
  SIGNS.forEach((sign, index) => { out[sign] = Math.floor(exact[index]); });
  let missing = 100 - SIGNS.reduce((sum, sign) => sum + out[sign], 0);
  const order = SIGNS.map((sign, index) => ({ sign, rest: exact[index] - Math.floor(exact[index]), index })).sort((a, b) => b.rest - a.rest || a.index - b.index);
  for (const { sign } of order) {
    if (missing <= 0) break;
    out[sign] += 1;
    missing -= 1;
  }
  return out;
}

/** The first column of the proposal as an editable draft: its chosen signs per row and the proposed pleno. */
export function draftFromPropuesta(propuesta: Pick<Propuesta, "matches" | "pleno">): BoletoDraft {
  const draft = emptyDraft();
  for (const match of propuesta.matches) {
    if (match.position >= 1 && match.position <= MATCH_COUNT) draft.picks[match.position - 1] = sortSigns(match.signs);
  }
  draft.pleno = { home: propuesta.pleno.home, away: propuesta.pleno.away };
  return draft;
}

/**
 * What the admin's editor checks a boleto against. `columns` and `costEur` are the porra's own totals as the API
 * computed them (apuestas played and their cost); without them they derive from the format and the price.
 * `modo` defaults to múltiple. For a reducida `dobles`/`triples` are the reduction's.
 */
export type PorraTerms = {
  dobles: number;
  triples: number;
  budgetEur: Money;
  precioApuestaEur: Money;
  modo?: PorraModo;
  fijos?: number[] | null;
  columnas?: number | null;
  columns?: number;
  costEur?: Money;
};

export type EditCheck = {
  usage: FormatUsage;
  /** Columns and cost of the boleto as it is now (2^D x 3^T of the dobles and triples placed). */
  columns: number;
  costEur: Money | null;
  /** Columns and cost the porra's format calls for: what the finished boleto covers. */
  formatColumns: number;
  formatCostEur: Money | null;
  /** Dobles / triples still to place (negative: too many placed). */
  remaining: { dobles: number; triples: number };
  over: boolean;
  /** Dobles, triples and completeness all match the porra's format. */
  matches: boolean;
  /** Spanish reasons the boleto cannot be confirmed yet; empty when it can. */
  reasons: string[];
  /** The "te sobra" reasons alone: more dobles or triples placed than the format allows. Shown as a warning while editing. */
  overPlacement: string[];
  canConfirm: boolean;
};

const countText = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** "Te faltan 2 dobles por colocar." / "Te sobra 1 triple." / null when it matches. */
function remainingReason(remaining: number, one: string, many: string): string | null {
  if (remaining > 0) return `${remaining === 1 ? "Te falta" : "Te faltan"} ${countText(remaining, one, many)} por colocar.`;
  if (remaining < 0) return `${remaining === -1 ? "Te sobra" : "Te sobran"} ${countText(-remaining, one, many)}.`;
  return null;
}

/** Live check of the admin's edited boleto against the porra's format and budget. A legacy boleto (e.g. all simples) just reports what is missing. */
export function editCheck(draft: BoletoDraft, terms: PorraTerms): EditCheck {
  const usage = formatUsage(draft);
  // A reducida plays the reduction's fixed apuestas, not the 2^D x 3^T of its dobles and triples.
  const reducida = terms.modo === "reducida";
  const formatColumns = terms.columns !== undefined && terms.columns > 0 ? terms.columns : columnsFor(terms.dobles, terms.triples);
  const columns = reducida ? formatColumns : usage.columns;
  const over = overBudget({ columns }, terms.budgetEur, terms.precioApuestaEur);
  const matches = matchesFormat(usage, terms);
  const remaining = { dobles: terms.dobles - usage.dobles, triples: terms.triples - usage.triples };
  const reasons: string[] = [];
  if (usage.incomplete > 0) reasons.push(usage.incomplete === 1 ? "Falta 1 partido por marcar." : `Faltan ${usage.incomplete} partidos por marcar.`);
  const overPlacement: string[] = [];
  for (const [left, one, many] of [[remaining.dobles, "doble", "dobles"], [remaining.triples, "triple", "triples"]] as const) {
    const reason = remainingReason(left, one, many);
    if (reason) reasons.push(reason);
    if (reason && left < 0) overPlacement.push(reason);
  }
  if (over) reasons.push(`El boleto cuesta ${euro(costFor(columns, terms.precioApuestaEur) ?? "0")} y el presupuesto es de ${euro(terms.budgetEur)}.`);
  if (!draft.pleno.home || !draft.pleno.away) reasons.push("Elige los goles de los dos equipos del pleno al 15.");
  return {
    usage, columns, costEur: costFor(columns, terms.precioApuestaEur), formatColumns, formatCostEur: costFor(formatColumns, terms.precioApuestaEur),
    remaining, over, matches, reasons, overPlacement, canConfirm: reasons.length === 0,
  };
}
