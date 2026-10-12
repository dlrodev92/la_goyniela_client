import type { PlenoShares, SignPercentages } from "../../matchdays/domain/matchdays";
import type { Sign } from "../../porras/domain/porras";

export type { SignPercentages };

export type Score = { home: number; away: number };

/** One of the 15 matches. `score` is null until the match has been played (or when the score is unparseable). */
export type MatchResult = {
  position: number;
  home: string;
  away: string;
  score: Score | null;
};

export type PrizeCategory = { hits: number; winners: number; prizeEur: string };

export type Escrutinio = {
  /** True while the matchday is in flight: every winner count is 0 and amounts are estimates. */
  estimated: boolean;
  collectedEur: string;
  jackpotEur: string;
  matchdayLabel: number;
  seasonLabel: string;
  dateLabel: string;
  categories: PrizeCategory[];
  elige8: { winners: number; prizeEur: string } | null;
  source: "db" | "upstream";
};

/** Per-match results of one matchday, as published by the results provider behind the backend. */
export type MatchdayResults = { matches: MatchResult[] };

/** Editorial/schedule data of one match as published by Losilla (matched to the fixture by `position`). */
export type LosillaMatch = {
  position: number;
  /** Raw weekday code ("SAB") and "HH:mm" as published; null when absent. */
  day: string | null;
  time: string | null;
  score: Score | null;
  comment: string | null;
  /** Club abbreviations as Losilla prints them ("RAYO", "ATHC"); absent when not published. */
  homeShort?: string;
  awayShort?: string;
  /** Share of votes per sign (0-100) as Losilla shows it, matches 1-14. Absent when not (fully) published. */
  percentages?: SignPercentages;
  /** Goals split of the pleno al 15 (match 15). Absent when not published. */
  pleno?: PlenoShares;
};

/** Live pool figures. Amounts are provider strings (EU "1.234,50" or plain "1500000"); null when not published. */
export type JornadaBote = {
  collectedEur: string | null;
  estimatedJackpotEur: string | null;
  jackpotEur: string | null;
  betCostEur: string | null;
  /** ISO instant when betting closes (from the provider's epoch seconds); null when absent or zero. */
  bettingClosesAt: string | null;
};

/**
 * Everything Losilla publishes for one jornada. `matches` and `bote` are empty/null when the provider's live view
 * belongs to another jornada (`ssr_shipped_jornada` differs); `escrutinio` is only kept when labelled with this jornada.
 */
export type LosillaJornada = { matches: LosillaMatch[]; bote: JornadaBote | null; escrutinio: Escrutinio | null };

export interface ResultsGateway {
  /** Full Losilla payload (schedule, comments, scores, pool, prizes), or null on backend 204. */
  getJornada(season: number, number: number): Promise<LosillaJornada | null>;
  /** Match scores for a matchday number in a season (end-year, e.g. 2027 for 2026/27). */
  getMatches(season: number, number: number): Promise<MatchdayResults>;
  /** The official prize table, or null when the provider has not published one (backend 204). */
  getEscrutinio(season: number, number: number): Promise<Escrutinio | null>;
}

/** Quiniela sign of a played score: home win 1, draw X, away win 2. */
export function signOf(score: Score): Sign {
  return score.home > score.away ? "1" : score.home < score.away ? "2" : "X";
}

/** Parses the provider's "2-1" form; "null-null" (not played) and anything else yield null. */
export function parseScore(value: string | null | undefined): Score | null {
  const match = /^(\d{1,2})-(\d{1,2})$/.exec(value ?? "");
  return match ? { home: Number(match[1]), away: Number(match[2]) } : null;
}

const hasMoney = (amount: string) => /[1-9]/.test(amount);

/**
 * True when the escrutinio carries real prize data: at least one category (or Elige 8) with winners or a non-zero prize.
 * No categories, or every winner count and amount at zero/empty, is the provider's unpublished placeholder.
 */
export function hasPublishedPrizes(escrutinio: { categories: Escrutinio["categories"]; elige8: Escrutinio["elige8"] }): boolean {
  const rows = [...escrutinio.categories, ...(escrutinio.elige8 ? [escrutinio.elige8] : [])];
  return rows.some(row => row.winners > 0 || hasMoney(row.prizeEur));
}
