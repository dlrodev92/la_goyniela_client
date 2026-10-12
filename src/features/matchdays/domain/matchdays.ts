/** Set manually by the superadmin: `draft` is invisible to regular users, `active` takes votes, `past` is history. */
export type MatchdayStatus = "draft" | "active" | "past";

/**
 * Where a jornada stands for voting, as the backend derives it (`effective_phase`). `in_window` is the only phase that
 * takes votes; the other values are Spanish because the backend names them that way.
 */
export const EFFECTIVE_PHASES = ["en_preparacion", "lista_abre_pronto", "in_window", "fuera_de_ventana", "escrutinio_pendiente", "escrutinio_disponible"] as const;
export type EffectivePhase = (typeof EFFECTIVE_PHASES)[number];

/** Null for anything that is not one of the known phases, so a new backend value never fails a parse. */
export function parseEffectivePhase(value: unknown): EffectivePhase | null {
  return typeof value === "string" && (EFFECTIVE_PHASES as readonly string[]).includes(value) ? (value as EffectivePhase) : null;
}

export type Matchday = {
  id: string;
  season: number;
  seasonLabel: string;
  number: number;
  status: MatchdayStatus;
  saleOpensAt: string | null;
  votingClosesAt: string | null;
  firstKickoffAt: string | null;
  fetchedAt: string;
  /** Soft-delete instant; null (or absent in the payload) while the matchday is live. */
  deletedAt: string | null;
  /** The backend's own reading of the voting window; null when the payload lacks it or sends an unknown value. */
  effectivePhase: EffectivePhase | null;
  /** The backend clock when the matchday was served; the only clock the phase fallback may use. */
  serverNow: string | null;
};

export type Fixture = {
  /** 1..15; position 15 is the "Pleno al 15" match. */
  position: number;
  home: string;
  away: string;
  kickoffAt: string | null;
  competition: string | null;
  /** Absolute crest URLs; null until the backend embeds the teams (B1). */
  homeLogoUrl: string | null;
  awayLogoUrl: string | null;
  /** Club short names from the embedded team (e.g. "Albacete"); null when the team is not linked. */
  homeShortName?: string | null;
  awayShortName?: string | null;
  /** Canonical club names (e.g. "Albacete Balompié"). */
  homeFullName?: string | null;
  awayFullName?: string | null;
};

/** Share of votes per sign (0-100) of one match, as Losilla publishes it. */
export type SignPercentages = { one: number; x: number; two: number };

/** Split of one side of the pleno al 15 per goals bucket ("0", "1", "2", "M"), in percent. */
export type PlenoSplit = Partial<Record<"0" | "1" | "2" | "M", number>>;

/** Pleno al 15 splits for both sides. */
export type PlenoShares = { home: PlenoSplit; away: PlenoSplit };

/** Live percentages of one match: 1X2 for matches 1-14, goal splits for the pleno (15). */
export type MatchEstimate = { position: number; percentages: SignPercentages | null; pleno: PlenoShares | null };

export type MatchdayDetail = Matchday & { fixtures: Fixture[]; /** Persisted live percentages; empty until the backend has ingested them. */ estimates: MatchEstimate[] };

export type MatchdayFilter = { status?: MatchdayStatus; season?: number; limit?: number };

export interface MatchdaysGateway {
  list(filter?: MatchdayFilter): Promise<Matchday[]>;
  get(matchdayId: string): Promise<MatchdayDetail>;
}

export const FIXTURE_COUNT = 15;

/** Regular users never see drafts or soft-deleted matchdays. */
export function isVisibleMatchday(matchday: Pick<Matchday, "status" | "deletedAt">): boolean {
  return matchday.status !== "draft" && !matchday.deletedAt;
}

export function visibleMatchdays<T extends Pick<Matchday, "status" | "deletedAt">>(matchdays: readonly T[]): T[] {
  return matchdays.filter(isVisibleMatchday);
}

type PhaseInput = Pick<Matchday, "status" | "saleOpensAt" | "votingClosesAt" | "effectivePhase" | "serverNow">;

const instantOf = (iso: string | null): number | null => {
  if (iso === null) return null;
  const at = Date.parse(iso);
  return Number.isNaN(at) ? null : at;
};

/**
 * The phase of a matchday: the backend's `effective_phase` when it sent a known one, otherwise a derivation that mirrors
 * the backend exactly (draft = en_preparacion, past = escrutinio_disponible, active = lista_abre_pronto before the sale
 * opens, in_window before the deadline, fuera_de_ventana after it or when there is no deadline). The derivation uses the
 * server `now`, never the client clock; without it an active matchday reads as closed, the safe side.
 */
export function phaseOf(matchday: PhaseInput): EffectivePhase {
  if (matchday.effectivePhase) return matchday.effectivePhase;
  if (matchday.status === "draft") return "en_preparacion";
  if (matchday.status === "past") return "escrutinio_disponible";
  const now = instantOf(matchday.serverNow);
  if (now === null) return "fuera_de_ventana";
  const opens = instantOf(matchday.saleOpensAt);
  if (opens !== null && now < opens) return "lista_abre_pronto";
  const closes = instantOf(matchday.votingClosesAt);
  if (closes !== null && now < closes) return "in_window";
  return "fuera_de_ventana";
}

/** Members can send picks only inside the voting window. */
export const canVote = (phase: EffectivePhase): boolean => phase === "in_window";

/** A peña can open its porra only inside the voting window. */
export const canCreatePorra = (phase: EffectivePhase): boolean => phase === "in_window";

/** The admin can change the budget and format of an existing porra before the sale opens and while voting. */
export const canEditPorra = (phase: EffectivePhase): boolean => phase === "in_window" || phase === "lista_abre_pronto";

/** The admin can set the final boleto from the moment the sale is listed until the scrutiny is available. */
export const canSetBoleto = (phase: EffectivePhase): boolean =>
  phase === "lista_abre_pronto" || phase === "in_window" || phase === "fuera_de_ventana" || phase === "escrutinio_pendiente";

/** A matchday can take predictions only when all 15 fixtures (positions 1..15) are known. */
export function hasFullBoleto(detail: Pick<MatchdayDetail, "fixtures">): boolean {
  const positions = new Set(detail.fixtures.map(fixture => fixture.position));
  for (let position = 1; position <= FIXTURE_COUNT; position += 1) if (!positions.has(position)) return false;
  return true;
}
