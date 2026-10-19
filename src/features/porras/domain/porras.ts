/** Signs of matches 1-14, in the order a printed quiniela shows them. */
export type Sign = "1" | "X" | "2";
export const SIGNS: readonly Sign[] = ["1", "X", "2"];

/** Goals of one team in the pleno al 15; "M" means more than two. */
export type Goals = "0" | "1" | "2" | "M";
export const GOALS: readonly Goals[] = ["0", "1", "2", "M"];

export const MATCH_COUNT = 14;
export const PLENO_POSITION = 15;

/** Decimal-as-string money, exactly as the backend sends it ("12.00"). Never converted to float. */
export type Money = string;

/**
 * The backend types `status` as a free string and never writes "closed" today, so anything but those two values is
 * "unknown" (it never fails a parse). The voting state of a porra comes from the jornada phase, see `porraLifecycle`.
 */
export type PorraStatus = "open" | "closed" | "unknown";
export type PickKind = "simple" | "doble" | "triple";

/** One match 1..14 and the 1-3 unique signs marked on it. */
export type Pick = { position: number; signs: Sign[] };

/** Pleno al 15: one value per team. */
export type Pleno = { home: Goals; away: Goals };

/** A member's vote: one column of 14 matches for múltiple and reducida, N columns for sencilla and Intuición, plus the single pleno. */
export type Vote = { columnas: BoletoColumn[]; pleno: Pleno };

export type TeamRef = { name: string; shortName: string | null; logoUrl: string | null };

/** Teams of one match (position 15 is the pleno match). Null when the backend lost the team row. */
export type MatchTeams = { position: number; home: TeamRef | null; away: TeamRef | null };

export type PorraFormat = { dobles: number; triples: number; columns: number; costEur: Money };

/** How the peña's final boleto is built. Chosen by the admin when the porra is created. */
export type PorraModo = "multiple" | "sencilla" | "reducida" | "intuicion";
/** Official reductions of the Quiniela (see `REDUCCIONES` in `modes.ts`). */
export type ReduccionCode = "R1" | "R2" | "R3" | "R4" | "R5" | "R6";

/** One feasible (columnas, fijos) pair of the Intuición budget advisor, priced by the API. */
export type IntuicionOption = { columnas: number; fijos: number; variables: number; costEur: Money };

export type MissingVoter = { userId: string; displayName: string };
export type Participation = { voted: number; totalMembers: number; missingVoters: MissingVoter[] };

export type Porra = {
  id: string;
  groupId: string;
  jornadaId: string;
  createdByUserId: string;
  budgetEur: Money;
  modo: PorraModo;
  dobles: number;
  triples: number;
  /** Intuición only: the partidos (1-based, ascending) that carry the same sign in every column. Null in the other modes. */
  fijos: number[] | null;
  /** Sencilla and Intuición only: how many columns the boleto plays. Null in the other modes. */
  columnas: number | null;
  /** Reducida only: the official reduction. The API may omit it; the gateway then derives it from (dobles, triples). */
  reduccion: ReduccionCode | null;
  /** Price of one column, as the backend resolved it for the jornada (0.75 EUR in 2026/27). */
  precioApuestaEur: Money;
  status: PorraStatus;
  createdAt: string;
  updatedAt: string;
  columns: number;
  costEur: Money;
  hasBoleto: boolean;
};

export type PorraDetail = Porra & {
  /** Formats that fit the current budget (same shape as `formats()`). */
  formatsPreview: PorraFormat[];
  participation: Participation | null;
};

/**
 * One member's picks as the backend reports them. `columnas` holds one entry per voted column (one for múltiple and
 * reducida); `picks` is the first of them. `pleno` is null when the pleno row is missing.
 */
export type PicksSheet = { picks: Pick[]; columnas: Pick[][]; pleno: Pleno | null; matches: MatchTeams[] };

export type MemberPicks = {
  userId: string;
  displayName: string;
  voted: boolean;
  votedAt: string | null;
  /** Null unless the group shows picks (`showPicks`) and the member voted. */
  sheet: PicksSheet | null;
};

export type PicksView = { porraId: string; showPicks: boolean; members: MemberPicks[] };

export type PropuestaMatch = {
  position: number;
  /** Vote weight per sign (each member contributes 1 per match, split among the signs they marked). */
  weights: Record<Sign, number>;
  signs: Sign[];
  kind: PickKind;
};

export type PlenoCounts = Record<Goals, number>;

/** The proposal of one column: its 14 rows, from the votes of that column. */
export type PropuestaColumn = { index: number; matches: PropuestaMatch[] };

export type Propuesta = {
  porraId: string;
  modo: PorraModo;
  /** Intuición only: the partidos (1-based, ascending) already locked to one sign across the columns. */
  fijos: number[] | null;
  /** Apuestas the boleto plays and their cost, as the API computed them. */
  columns: number;
  costEur: Money;
  /** One entry for múltiple and reducida, N for sencilla and Intuición, ordered by column. */
  columnas: PropuestaColumn[];
  /** Rows of the first column (what the single-column modes use). */
  matches: PropuestaMatch[];
  /** Pleno al 15 proposal, shared by every column. */
  pleno: Pleno;
  participation: Participation;
};

/** The 14 matches of one printed column of the boleto. */
export type BoletoColumn = Pick[];

export type Boleto = {
  porraId: string;
  modo: PorraModo;
  setAt: string;
  setByUserId: string | null;
  /** The printed columns: one for múltiple and reducida, N for sencilla and Intuición. */
  columnas: BoletoColumn[];
  pleno: Pleno;
  /** Apuestas played (the API's count; never recomputed here). */
  columns: number;
  costEur: Money;
  reduccion: ReduccionCode | null;
};

/** The body of the admin's final boleto: every printed column plus the single pleno. */
export type BoletoInput = { columnas: BoletoColumn[]; pleno: Pleno };

/** A downloadable file proxied from the API: the stream plus the headers worth keeping. */
export type BoletoPdf = { body: ReadableStream<Uint8Array> | null; contentType: string; contentDisposition: string | null };

/** The mode and its own parameters; the rest of the porra's fields follow from them on the server. */
export type PorraSpec =
  | { modo: "multiple"; dobles: number; triples: number }
  | { modo: "sencilla"; columnas: number }
  | { modo: "reducida"; reduccion: ReduccionCode }
  | { modo: "intuicion"; fijos: number[]; columnas: number };

/** The price is never sent: the backend resolves it from the jornada's Losilla data and returns it as `precioApuestaEur`. */
export type NewPorra = { jornadaId: string; budgetEur: Money; spec: PorraSpec };
/** Last-resort display price per column when no porra or format value exists. Never a source of truth. */
export const FALLBACK_PRECIO_APUESTA_EUR: Money = "0.75";
/** The smallest sellable boleto: 2 columns (1 doble or 1 triple). A single column is not a Quiniela product. */
export const MIN_COLUMNS = 2;
/** A patch: the budget, the mode and its parameters, or both. Changing `spec` is refused by the API while a boleto exists. */
export type PorraChanges = { budgetEur?: Money; spec?: PorraSpec };

export interface PorrasGateway {
  list(groupId: string, jornadaId?: string): Promise<Porra[]>;
  /** Admin only: the (dobles, triples) pairs that fit the budget, most columns first. */
  formats(groupId: string, jornadaId: string, budgetEur: Money): Promise<PorraFormat[]>;
  /** Any member: the (columnas, fijos) options of the Intuición mode that fit the budget, most columns first. */
  intuicionOptions(groupId: string, budgetEur: Money): Promise<IntuicionOption[]>;
  /** Admin only. `porra-exists` when the group already has a porra for that jornada. */
  create(groupId: string, input: NewPorra): Promise<PorraDetail>;
  get(groupId: string, porraId: string): Promise<PorraDetail>;
  /** Admin only, while open. `porra-closed`, `over-budget` or `boleto-locked` on rejection. */
  patch(groupId: string, porraId: string, changes: PorraChanges): Promise<PorraDetail>;
  /** Idempotent: replaces the caller's picks. `porra-closed`, one of the window codes (`sale-not-opened`, `voting-window-closed`, ...), `forbidden` for a non-member (or the generic `voting-closed`) when voting is refused. */
  submitPicks(groupId: string, porraId: string, vote: Vote): Promise<PicksView>;
  listPicks(groupId: string, porraId: string): Promise<PicksView>;
  /** Null when the caller has not voted yet (404). */
  myPicks(groupId: string, porraId: string): Promise<PicksSheet | null>;
  /** Admin only. Computed on demand, never saved. */
  propuesta(groupId: string, porraId: string): Promise<Propuesta>;
  /** Null while the admin has not decided the boleto (404). */
  getBoleto(groupId: string, porraId: string): Promise<Boleto | null>;
  /** Admin only. `format-mismatch` or `over-budget` on rejection. */
  putBoleto(groupId: string, porraId: string, input: BoletoInput): Promise<Boleto>;
  /** Admin only: removes the final boleto (keeps the porra and the picks) so the format can change. `not-found` when there is none. */
  deleteBoleto(groupId: string, porraId: string): Promise<void>;
  /** Any member: the PDF of the final boleto. `not-found` without a boleto, `forbidden` for a non-member. */
  boletoPdf(groupId: string, porraId: string): Promise<BoletoPdf>;
}
