import { costFor, euro, overBudget, sortSigns, validateVote, type BoletoDraft, type FieldErrors } from "./logic";
import { GOALS, MATCH_COUNT, SIGNS, type Boleto, type BoletoInput, type Goals, type Money, type PicksSheet, type Porra, type PorraModo, type PorraSpec, type Propuesta, type PropuestaMatch, type Sign, type Vote } from "./porras";
import { MAX_COLUMNAS } from "./modes";

/**
 * Editable boleto with several printed columns (sencilla, Intuición, and a single-column múltiple or reducida too).
 * `columns[c][r]` holds the signs marked on match r+1 of column c; the pleno is shared (one per boleto).
 */
export type ColumnsDraft = {
  columns: Sign[][][];
  pleno: { home: Goals | null; away: Goals | null };
};

const emptyColumn = (): Sign[][] => Array.from({ length: MATCH_COUNT }, () => []);

export function emptyColumnsDraft(count: number): ColumnsDraft {
  return { columns: Array.from({ length: Math.max(0, count) }, emptyColumn), pleno: { home: null, away: null } };
}

export function columnsDraftFromBoleto(boleto: Pick<Boleto, "columnas" | "pleno">): ColumnsDraft {
  return {
    columns: boleto.columnas.map(column => {
      const rows = emptyColumn();
      for (const pick of column) if (pick.position >= 1 && pick.position <= MATCH_COUNT) rows[pick.position - 1] = sortSigns(pick.signs);
      return rows;
    }),
    pleno: { home: boleto.pleno.home, away: boleto.pleno.away },
  };
}

/** A single-column draft (múltiple, reducida) as the general shape. */
export const columnsDraftFromSingle = (draft: BoletoDraft): ColumnsDraft => ({
  columns: [draft.picks.map(signs => sortSigns(signs))],
  pleno: { home: draft.pleno.home, away: draft.pleno.away },
});

/** Column `index` as the single-column draft the paper boleto renders. */
export function singleFromColumns(draft: ColumnsDraft, index: number): BoletoDraft {
  return { picks: (draft.columns[index] ?? emptyColumn()).map(signs => [...signs]), pleno: { ...draft.pleno } };
}

/** True when an untrusted value has the shape of a `ColumnsDraft` (1 to 12 columns of 14 rows of at most 3 signs, pleno or null). */
export function isColumnsDraft(value: unknown): value is ColumnsDraft {
  if (typeof value !== "object" || value === null) return false;
  const { columns, pleno } = value as { columns?: unknown; pleno?: unknown };
  if (!Array.isArray(columns) || columns.length < 1 || columns.length > MAX_COLUMNAS) return false;
  const rowsOk = (rows: unknown) =>
    Array.isArray(rows) && rows.length === MATCH_COUNT
    && rows.every(signs => Array.isArray(signs) && signs.length <= 3 && signs.every(sign => SIGNS.includes(sign)));
  if (!columns.every(rowsOk)) return false;
  if (typeof pleno !== "object" || pleno === null) return false;
  const { home, away } = pleno as { home?: unknown; away?: unknown };
  return (home === null || GOALS.includes(home as Goals)) && (away === null || GOALS.includes(away as Goals));
}

/** The partidos (1-based) locked to one sign across all columns. None outside Intuición. */
export const fijosOf = (spec: Pick<PorraSpec, "modo"> & { fijos?: readonly number[] | null }): number[] => (spec.modo === "intuicion" ? [...(spec.fijos ?? [])] : []);

/** True when match `row` (0-based) is one of the fijos. */
const isFijoRow = (fijos: readonly number[], row: number): boolean => fijos.includes(row + 1);

/** Marks exactly `sign` on match `position` of column `index`. A fijo (Intuición) is mirrored to every column. */
export function setColumnSign(draft: ColumnsDraft, index: number, position: number, sign: Sign, fijos: readonly number[] = []): ColumnsDraft {
  if (position < 1 || position > MATCH_COUNT || index < 0 || index >= draft.columns.length) return draft;
  const locked = fijos.includes(position);
  return {
    ...draft,
    columns: draft.columns.map((rows, column) => (
      column === index || locked ? rows.map((signs, row) => (row === position - 1 ? [sign] : signs)) : rows
    )),
  };
}

export function setColumnsPleno(draft: ColumnsDraft, team: "home" | "away", value: Goals): ColumnsDraft {
  return { ...draft, pleno: { ...draft.pleno, [team]: value } };
}

/** Copies the variable rows of the previous column into column `index`. The fijos already match in every column. */
export function copyPreviousColumn(draft: ColumnsDraft, index: number, fijos: readonly number[] = []): ColumnsDraft {
  if (index < 1 || index >= draft.columns.length) return draft;
  const previous = draft.columns[index - 1];
  return {
    ...draft,
    columns: draft.columns.map((rows, column) => (column === index ? rows.map((signs, row) => (isFijoRow(fijos, row) ? signs : [...previous[row]])) : rows)),
  };
}

/** Same number of columns as the porra plays: extra ones are dropped, missing ones start from a copy of the first. Fijos are mirrored from column 1. */
export function fitColumns(draft: ColumnsDraft, count: number, fijos: readonly number[] = []): ColumnsDraft {
  const columns = draft.columns.slice(0, count).map(rows => rows.map(signs => [...signs]));
  while (columns.length < count) columns.push((columns[0] ?? emptyColumn()).map((signs, row) => (isFijoRow(fijos, row) ? [...signs] : [])));
  const first = columns[0];
  return { ...draft, columns: columns.map(rows => rows.map((signs, row) => (isFijoRow(fijos, row) && first ? [...first[row]] : signs))) };
}

// ---- Validation per mode ----

export type ColumnsTerms = {
  modo: PorraModo;
  columnas?: number | null;
  fijos?: readonly number[] | null;
  budgetEur: Money;
  precioApuestaEur: Money;
  /** The porra's apuestas as the API computed them; without it the planned number of columns stands in. */
  columns?: number;
};

export type ColumnsCheck = {
  /** Columns with all 14 matches marked. */
  completeColumns: number;
  totalColumns: number;
  /** Fijos with a sign (Intuición); both zero in the other modes. */
  fijosMarked: number;
  fijosTotal: number;
  /** Apuestas the boleto plays and their cost. */
  columns: number;
  costEur: Money | null;
  over: boolean;
  /** Spanish reasons the boleto cannot be confirmed yet; empty when it can. */
  reasons: string[];
  canConfirm: boolean;
};

const joinNumbers = (values: readonly number[]): string =>
  values.length <= 1 ? String(values[0] ?? "") : `${values.slice(0, -1).join(", ")} y ${values[values.length - 1]}`;

/** Live check of an N-column boleto (sencilla, Intuición) against the porra: the counts, one sign per match, fijos and budget. */
export function checkColumns(draft: ColumnsDraft, terms: ColumnsTerms): ColumnsCheck {
  const planned = terms.columnas ?? draft.columns.length;
  const fijos = terms.modo === "intuicion" ? terms.fijos ?? [] : [];
  const reasons: string[] = [];
  const incomplete: number[] = [];
  const multiSign: string[] = [];
  let complete = 0;
  draft.columns.forEach((rows, column) => {
    const missing = rows.filter(signs => signs.length === 0).length;
    if (missing === 0) complete += 1;
    else incomplete.push(column + 1);
    rows.forEach((signs, row) => { if (signs.length > 1) multiSign.push(`columna ${column + 1}, partido ${row + 1}`); });
  });
  if (draft.columns.length !== planned) {
    reasons.push(`La porra juega ${planned} ${planned === 1 ? "columna" : "columnas"} y el boleto tiene ${draft.columns.length}.`);
  }
  if (incomplete.length > 0) {
    reasons.push(incomplete.length === 1 ? `Faltan partidos por marcar en la columna ${incomplete[0]}.` : `Faltan partidos por marcar en las columnas ${joinNumbers(incomplete)}.`);
  }
  if (multiSign.length > 0) {
    reasons.push(`En este modo cada partido lleva un solo signo (${multiSign.slice(0, 2).join("; ")}${multiSign.length > 2 ? "…" : ""}).`);
  }
  const first = draft.columns[0];
  const unlocked: number[] = [];
  let fijosMarked = 0;
  if (fijos.length > 0 && first) {
    for (const position of fijos) {
      const row = position - 1;
      if (row < 0 || row >= MATCH_COUNT) continue;
      const sign = first[row][0];
      if (first[row].length > 0) fijosMarked += 1;
      if (draft.columns.some(rows => rows[row].length !== first[row].length || rows[row][0] !== sign)) unlocked.push(row + 1);
    }
    if (unlocked.length > 0) reasons.push(`Los partidos fijos (${joinNumbers(unlocked)}) deben llevar el mismo signo en todas las columnas.`);
  }
  const columns = terms.columns !== undefined && terms.columns > 0 ? terms.columns : planned;
  const over = overBudget({ columns }, terms.budgetEur, terms.precioApuestaEur);
  const costEur = costFor(columns, terms.precioApuestaEur);
  if (over) reasons.push(`El boleto cuesta ${euro(costEur ?? "0")} y el presupuesto es de ${euro(terms.budgetEur)}.`);
  if (!draft.pleno.home || !draft.pleno.away) reasons.push("Elige los goles de los dos equipos del pleno al 15.");
  return {
    completeColumns: complete, totalColumns: draft.columns.length, fijosMarked, fijosTotal: fijos.length,
    columns, costEur, over, reasons, canConfirm: reasons.length === 0,
  };
}

/** The wire-ready boleto when every column is complete and the pleno is set; otherwise null. */
export function boletoInputFromColumns(draft: ColumnsDraft): BoletoInput | null {
  const { home, away } = draft.pleno;
  if (!home || !away || draft.columns.length === 0) return null;
  const columnas = draft.columns.map(rows => rows.map((signs, row) => ({ position: row + 1, signs: sortSigns(signs) })));
  if (columnas.some(column => column.some(pick => pick.signs.length === 0 || pick.signs.length > 3))) return null;
  return { columnas, pleno: { home, away } };
}

// ---- Seeding the editor from the per-column proposal ----

/** The single sign of a proposal row: the most voted of its `reparto` (ties: 1, X, 2). A row without signs gives none. */
function topSign(match: Pick<PropuestaMatch, "weights" | "signs">): Sign[] {
  const best = [...match.signs].sort((a, b) => (match.weights[b] ?? 0) - (match.weights[a] ?? 0) || SIGNS.indexOf(a) - SIGNS.indexOf(b))[0];
  return best ? [best] : [];
}

/**
 * Starting boleto for the admin's editor from `POST /propuesta`, which already computes one proposal per column.
 * - Múltiple and reducida: the proposal of its only column, with its dobles and triples as they are.
 * - Sencilla and Intuición: every column of the proposal as it comes (one sign per row); the API locks the Intuición fijos
 *   across the columns. A missing column starts as a copy of the first (see `fitColumns`).
 */
export function columnsDraftFromPropuesta(propuesta: Pick<Propuesta, "columnas" | "pleno">, spec: PorraSpec): ColumnsDraft {
  const pleno = { home: propuesta.pleno.home, away: propuesta.pleno.away };
  const rowsOf = (matches: readonly PropuestaMatch[], pick: (match: PropuestaMatch) => Sign[]): Sign[][] => {
    const rows = emptyColumn();
    for (const match of matches) if (match.position >= 1 && match.position <= MATCH_COUNT) rows[match.position - 1] = pick(match);
    return rows;
  };
  if (spec.modo === "multiple" || spec.modo === "reducida") {
    return { columns: [rowsOf(propuesta.columnas[0]?.matches ?? [], match => sortSigns(match.signs))], pleno };
  }
  const columns = propuesta.columnas.slice(0, spec.columnas).map(column => rowsOf(column.matches, topSign));
  return fitColumns({ columns: columns.length > 0 ? columns : [emptyColumn()], pleno }, spec.columnas, fijosOf(spec));
}

// ---- A member's vote: N columns ----

/** What a member's vote has to look like for a porra: how many columns, one sign per row or free, how many fijos. */
export type VoteRules = { modo: PorraModo; columnas: number; fijos: number[] };

/** One column, free signs: what múltiple and reducida ask of a member. */
export const SINGLE_COLUMN_RULES: VoteRules = { modo: "multiple", columnas: 1, fijos: [] };

/** True for sencilla and Intuición: N columns with one sign per row. */
export const isMultiColumnRules = (rules: Pick<VoteRules, "modo">): boolean => rules.modo === "sencilla" || rules.modo === "intuicion";

export function voteRulesOf(porra: Pick<Porra, "modo" | "columnas" | "fijos">): VoteRules {
  if (porra.modo === "sencilla") return { modo: "sencilla", columnas: Math.max(1, porra.columnas ?? 1), fijos: [] };
  if (porra.modo === "intuicion") return { modo: "intuicion", columnas: Math.max(1, porra.columnas ?? 1), fijos: porra.fijos ?? [] };
  return { modo: porra.modo, columnas: 1, fijos: [] };
}

/** The caller's saved columns as a draft with exactly the columns the porra plays; an empty draft when they have not voted. */
export function columnsDraftFromSheet(sheet: PicksSheet | null, rules: VoteRules): ColumnsDraft {
  if (!sheet) return emptyColumnsDraft(rules.columnas);
  const columns = sheet.columnas.map(column => {
    const rows = emptyColumn();
    for (const pick of column) if (pick.position >= 1 && pick.position <= MATCH_COUNT) rows[pick.position - 1] = sortSigns(pick.signs);
    return rows;
  });
  const pleno = { home: sheet.pleno?.home ?? null, away: sheet.pleno?.away ?? null };
  return fitColumns({ columns: columns.length > 0 ? columns : [emptyColumn()], pleno }, rules.columnas, rules.fijos);
}

/** Sentence under the title of the member's boleto. The boleto adds the final full stop. */
export function voteCaption(rules: VoteRules): string | undefined {
  if (!isMultiColumnRules(rules)) return undefined;
  const base = `Rellena ${rules.columnas === 1 ? "la columna" : `las ${rules.columnas} columnas`}: un signo por partido en cada una`;
  if (rules.modo !== "intuicion" || rules.fijos.length < 1) return base;
  return `${base}. ${fijosSentence(rules.fijos)}: el mismo signo en todas las columnas`;
}

/** "El primer partido es fijo", "Los primeros 10 partidos son fijos" or "Los partidos 3, 5 y 8 son fijos". */
export function fijosSentence(fijos: readonly number[]): string {
  if (fijos.length === 0) return "Ningún partido es fijo";
  const leading = fijos.every((position, index) => position === index + 1);
  if (leading) return fijos.length === 1 ? "El primer partido es fijo" : `Los primeros ${fijos.length} partidos son fijos`;
  return fijos.length === 1 ? `El partido ${fijos[0]} es fijo` : `Los partidos ${joinNumbers(fijos)} son fijos`;
}

/**
 * Spanish per-field errors of a member's vote: `pick-N` (a row, for every column at once), `pleno-home`, `pleno-away` and
 * `columnas` (wrong number of columns). One column (múltiple, reducida): 1 to 3 signs per row. N columns: exactly one sign
 * per row in every column, and in Intuición the `fijos` rows identical in all of them. Empty object means valid.
 */
export function validateColumnsVote(draft: ColumnsDraft, rules: VoteRules): FieldErrors {
  if (!isMultiColumnRules(rules)) {
    const errors = validateVote(singleFromColumns(draft, 0));
    if (draft.columns.length !== 1) errors.columnas = "El boleto de esta porra lleva una sola columna.";
    return errors;
  }
  const errors: FieldErrors = {};
  if (draft.columns.length !== rules.columnas) {
    errors.columnas = `La porra juega ${rules.columnas === 1 ? "1 columna" : `${rules.columnas} columnas`} y el boleto tiene ${draft.columns.length}.`;
  }
  for (let row = 0; row < MATCH_COUNT; row += 1) {
    const missing: number[] = [];
    const several: number[] = [];
    draft.columns.forEach((rows, column) => {
      const signs = rows[row] ?? [];
      if (signs.length === 0) missing.push(column + 1);
      else if (signs.length > 1 || !SIGNS.includes(signs[0])) several.push(column + 1);
    });
    const label = (columns: number[]) => `${columns.length === 1 ? "la columna" : "las columnas"} ${joinNumbers(columns)}`;
    if (missing.length > 0) errors[`pick-${row + 1}`] = `Partido ${row + 1}: marca un signo en ${label(missing)}.`;
    else if (several.length > 0) errors[`pick-${row + 1}`] = `Partido ${row + 1}: solo un signo por columna (revisa ${label(several)}).`;
    else if (isFijoRow(rules.fijos, row) && draft.columns.some(rows => rows[row][0] !== draft.columns[0][row][0])) {
      errors[`pick-${row + 1}`] = `Partido ${row + 1}: es fijo y debe llevar el mismo signo en todas las columnas.`;
    }
  }
  if (!draft.pleno.home || !GOALS.includes(draft.pleno.home)) errors["pleno-home"] = "Pleno al 15: elige los goles del equipo local.";
  if (!draft.pleno.away || !GOALS.includes(draft.pleno.away)) errors["pleno-away"] = "Pleno al 15: elige los goles del equipo visitante.";
  return errors;
}

/** The wire-ready vote when the draft is valid for the rules, otherwise null. */
export function voteFromColumns(draft: ColumnsDraft, rules: VoteRules): Vote | null {
  const { home, away } = draft.pleno;
  if (Object.keys(validateColumnsVote(draft, rules)).length > 0 || !home || !away) return null;
  return { columnas: draft.columns.map(rows => rows.map((signs, row) => ({ position: row + 1, signs: sortSigns(signs) }))), pleno: { home, away } };
}

/** Progress of a member's draft: columns with the 14 rows marked, and whether the pleno is complete. */
export function columnsProgress(draft: ColumnsDraft): { completeColumns: number; totalColumns: number; marked: number; plenoDone: boolean } {
  return {
    completeColumns: draft.columns.filter(rows => rows.every(signs => signs.length > 0)).length,
    totalColumns: draft.columns.length,
    marked: (draft.columns[0] ?? []).filter(signs => signs.length > 0).length,
    plenoDone: draft.pleno.home !== null && draft.pleno.away !== null,
  };
}

export function draftsAreEqual(a: ColumnsDraft, b: ColumnsDraft): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Stored with the server baseline it was started from, so a draft made against an older saved vote is never revived. */
export function encodeColumnsDraft(base: ColumnsDraft, draft: ColumnsDraft): string {
  return JSON.stringify({ base, draft });
}

/** The stored draft when it is well formed and was started from `base`; otherwise null. */
export function decodeColumnsDraft(raw: string | null, base: ColumnsDraft): ColumnsDraft | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const { base: storedBase, draft } = parsed as { base?: unknown; draft?: unknown };
    if (!isColumnsDraft(storedBase) || !isColumnsDraft(draft) || !draftsAreEqual(storedBase, base)) return null;
    return { columns: draft.columns.map(rows => rows.map(sortSigns)), pleno: { home: draft.pleno.home, away: draft.pleno.away } };
  } catch {
    return null;
  }
}
