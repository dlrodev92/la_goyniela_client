import { columnsFor, costFor, formatName, isValidFormat, moneyUnits } from "./logic";
import { MATCH_COUNT, type IntuicionOption, type Money, type Porra, type PorraModo, type PorraSpec, type ReduccionCode } from "./porras";

/** Fewest columns a sencilla or Intuición boleto plays: a single column is not a Quiniela product. */
export const MIN_COLUMNAS = 2;
/** Most columns a sencilla or Intuición boleto plays (the API's bound). */
export const MAX_COLUMNAS = 12;
/** Most partidos an Intuición boleto can lock (at least one must vary). */
export const MAX_FIJOS = MATCH_COUNT - 1;

export const PORRA_MODES: readonly PorraModo[] = ["multiple", "sencilla", "reducida", "intuicion"];

export const MODE_LABEL: Record<PorraModo, string> = { multiple: "Múltiple", sencilla: "Sencilla", reducida: "Reducida", intuicion: "Intuición" };

/** One line that tells the admin what each mode does. */
export const MODE_BLURB: Record<PorraModo, string> = {
  multiple: "Una columna con dobles y triples. Se juegan todas las combinaciones.",
  sencilla: "Varias columnas independientes con un solo signo por partido.",
  reducida: "Una columna con dobles y triples y un número fijo de apuestas, según las reducciones oficiales.",
  intuicion: "Varias columnas con los primeros partidos fijos y el resto variando.",
};

export type Reduccion = { code: ReduccionCode; dobles: number; triples: number; apuestas: number };

/**
 * The official reductions, mirrored from the API (`app/services/reducciones.py`) for display and selection only.
 * The API stamps dobles/triples and prices the porra from its own table; the client never sends them for a reducida.
 */
export const REDUCCIONES: readonly Reduccion[] = [
  { code: "R1", dobles: 0, triples: 4, apuestas: 9 },
  { code: "R2", dobles: 7, triples: 0, apuestas: 16 },
  { code: "R3", dobles: 3, triples: 3, apuestas: 24 },
  { code: "R4", dobles: 6, triples: 2, apuestas: 64 },
  { code: "R5", dobles: 0, triples: 8, apuestas: 81 },
  { code: "R6", dobles: 11, triples: 0, apuestas: 132 },
];

export const isReduccionCode = (value: unknown): value is ReduccionCode => REDUCCIONES.some(item => item.code === value);

export const reduccionOf = (code: string | null | undefined): Reduccion | null => REDUCCIONES.find(item => item.code === code) ?? null;

/** The reduction whose dobles and triples are exactly these, for an API that does not send the code. */
export const reduccionForFormat = (dobles: number, triples: number): Reduccion | null =>
  REDUCCIONES.find(item => item.dobles === dobles && item.triples === triples) ?? null;

const isInt = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value);
const inRange = (value: unknown, min: number, max: number): value is number => isInt(value) && value >= min && value <= max;

/** True when an untrusted value is a well-formed mode with in-range parameters. Cost against the budget is the API's call. */
export function isValidSpec(value: unknown): value is PorraSpec {
  if (typeof value !== "object" || value === null) return false;
  const spec = value as Record<string, unknown>;
  switch (spec.modo) {
    case "multiple": return isInt(spec.dobles) && isInt(spec.triples) && isValidFormat(spec.dobles, spec.triples);
    case "sencilla": return inRange(spec.columnas, MIN_COLUMNAS, MAX_COLUMNAS);
    case "reducida": return isReduccionCode(spec.reduccion);
    case "intuicion": return inRange(spec.fijos, 0, MAX_FIJOS) && inRange(spec.columnas, MIN_COLUMNAS, MAX_COLUMNAS);
    default: return false;
  }
}

/** The mode and parameters a porra currently has. */
export function specOf(porra: Pick<Porra, "modo" | "dobles" | "triples" | "fijos" | "columnas" | "reduccion">): PorraSpec {
  switch (porra.modo) {
    case "sencilla": return { modo: "sencilla", columnas: porra.columnas ?? MIN_COLUMNAS };
    case "intuicion": return { modo: "intuicion", fijos: porra.fijos ?? 0, columnas: porra.columnas ?? MIN_COLUMNAS };
    case "reducida": {
      const reduccion = porra.reduccion ?? reduccionForFormat(porra.dobles, porra.triples)?.code ?? REDUCCIONES[0].code;
      return { modo: "reducida", reduccion };
    }
    default: return { modo: "multiple", dobles: porra.dobles, triples: porra.triples };
  }
}

export function sameSpec(a: PorraSpec | null | undefined, b: PorraSpec | null | undefined): boolean {
  if (!a || !b || a.modo !== b.modo) return false;
  switch (a.modo) {
    case "multiple": return b.modo === "multiple" && a.dobles === b.dobles && a.triples === b.triples;
    case "sencilla": return b.modo === "sencilla" && a.columnas === b.columnas;
    case "reducida": return b.modo === "reducida" && a.reduccion === b.reduccion;
    case "intuicion": return b.modo === "intuicion" && a.fijos === b.fijos && a.columnas === b.columnas;
  }
}

/** Stable id of a spec, for radio values and list keys. */
export function specKey(spec: PorraSpec): string {
  switch (spec.modo) {
    case "multiple": return `multiple-${spec.dobles}-${spec.triples}`;
    case "sencilla": return `sencilla-${spec.columnas}`;
    case "reducida": return `reducida-${spec.reduccion}`;
    case "intuicion": return `intuicion-${spec.fijos}-${spec.columnas}`;
  }
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** Single place for the Spanish "N columna(s)" wording. */
export const columnasText = (count: number) => plural(count, "columna", "columnas");

/** "Sencilla · 6 columnas" style summary of a spec, for the option lists. */
export function specLabel(spec: PorraSpec): string {
  switch (spec.modo) {
    case "multiple": return `${MODE_LABEL.multiple} · ${formatName(spec.dobles, spec.triples)}`;
    case "sencilla": return `${MODE_LABEL.sencilla} · ${columnasText(spec.columnas)}`;
    case "reducida": {
      const reduccion = reduccionOf(spec.reduccion);
      return reduccion ? `${MODE_LABEL.reducida} ${reduccion.code} · ${formatName(reduccion.dobles, reduccion.triples)}` : MODE_LABEL.reducida;
    }
    case "intuicion": return `${MODE_LABEL.intuicion} · ${plural(spec.fijos, "fijo", "fijos")} y ${plural(MATCH_COUNT - spec.fijos, "variable", "variables")}`;
  }
}

/** The "Formato" of a porra in lists and headers. */
export const porraFormatLabel = (porra: Pick<Porra, "modo" | "dobles" | "triples" | "fijos" | "columnas" | "reduccion">): string => specLabel(specOf(porra));

/** Apuestas the spec plays, as far as the client can tell without the API. Display only: the API's `columns` is the truth. */
export function specColumns(spec: PorraSpec): number {
  switch (spec.modo) {
    case "multiple": return columnsFor(spec.dobles, spec.triples);
    case "reducida": return reduccionOf(spec.reduccion)?.apuestas ?? 0;
    default: return spec.columnas;
  }
}

export type PricedOption = { columns: number; costEur: Money; fits: boolean };

const priced = (columns: number, budgetEur: Money, priceEur: Money): PricedOption | null => {
  const costEur = costFor(columns, priceEur);
  const cost = moneyUnits(costEur);
  const budget = moneyUnits(budgetEur);
  if (costEur === null || cost === null || budget === null) return null;
  return { columns, costEur, fits: cost <= budget };
};

/** Largest number of columns (2..12) a budget pays at this price; 0 when not even two fit. */
export function maxColumnas(budgetEur: Money, priceEur: Money): number {
  const budget = moneyUnits(budgetEur);
  const price = moneyUnits(priceEur);
  if (budget === null || price === null || price <= BigInt(0)) return 0;
  const fit = Number(budget / price);
  return fit >= MIN_COLUMNAS ? Math.min(MAX_COLUMNAS, fit) : 0;
}

/** Sencilla options: every N from the most the budget pays down to 2, priced at the porra's price. */
export function sencillaOptions(budgetEur: Money, priceEur: Money): { columnas: number; costEur: Money }[] {
  const max = maxColumnas(budgetEur, priceEur);
  const out: { columnas: number; costEur: Money }[] = [];
  for (let columnas = max; columnas >= MIN_COLUMNAS; columnas -= 1) {
    const option = priced(columnas, budgetEur, priceEur);
    if (option) out.push({ columnas, costEur: option.costEur });
  }
  return out;
}

export type ReduccionOption = Reduccion & { costEur: Money; fits: boolean };

/** All six reductions with their cost at this price. Those over the budget stay in the list, flagged, so the admin sees why. */
export function reduccionOptions(budgetEur: Money, priceEur: Money): ReduccionOption[] {
  const out: ReduccionOption[] = [];
  for (const reduccion of REDUCCIONES) {
    const option = priced(reduccion.apuestas, budgetEur, priceEur);
    if (option) out.push({ ...reduccion, costEur: option.costEur, fits: option.fits });
  }
  return out;
}

/** "6 columnas · 10 fijos · 4 variables · 4,50 €". */
export function intuicionOptionLabel(option: IntuicionOption): string {
  const euro = `${new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(option.costEur))} €`;
  return `${columnasText(option.columnas)} · ${plural(option.fijos, "fijo", "fijos")} · ${plural(option.variables, "variable", "variables")} · ${euro}`;
}

/** Intuición options that really fit the budget at the API's price, most columns first (the list is defensive: the API filters too). */
export function intuicionOptionsFor(options: readonly IntuicionOption[], budgetEur: Money): IntuicionOption[] {
  const budget = moneyUnits(budgetEur);
  return options
    .filter(option => {
      const cost = moneyUnits(option.costEur);
      return option.columnas >= MIN_COLUMNAS && option.columnas <= MAX_COLUMNAS && option.fijos >= 0 && option.fijos <= MAX_FIJOS && cost !== null && (budget === null || cost <= budget);
    })
    .sort((a, b) => b.columnas - a.columnas || a.fijos - b.fijos);
}

const toInt = (raw: string | null): number | null => (raw !== null && /^\d{1,3}$/.test(raw.trim()) ? Number(raw.trim()) : null);

/**
 * Reads a spec from named string fields (a submitted form): `modo` plus `dobles`+`triples`, `columnas`, `reduccion`
 * or `fijos`+`columnas`. Null when the mode is unknown or its fields are missing or out of range.
 */
export function specFromFields(get: (name: string) => string | null): PorraSpec | null {
  const modo = get("modo");
  let spec: unknown = null;
  if (modo === "multiple") spec = { modo, dobles: toInt(get("dobles")), triples: toInt(get("triples")) };
  else if (modo === "sencilla") spec = { modo, columnas: toInt(get("columnas")) };
  else if (modo === "reducida") spec = { modo, reduccion: get("reduccion") };
  else if (modo === "intuicion") spec = { modo, fijos: toInt(get("fijos")), columnas: toInt(get("columnas")) };
  return isValidSpec(spec) ? spec : null;
}

/** The named fields a spec submits (the inverse of `specFromFields`), for hidden inputs. */
export function specFields(spec: PorraSpec): Record<string, string> {
  switch (spec.modo) {
    case "multiple": return { modo: spec.modo, dobles: String(spec.dobles), triples: String(spec.triples) };
    case "sencilla": return { modo: spec.modo, columnas: String(spec.columnas) };
    case "reducida": return { modo: spec.modo, reduccion: spec.reduccion };
    case "intuicion": return { modo: spec.modo, fijos: String(spec.fijos), columnas: String(spec.columnas) };
  }
}
