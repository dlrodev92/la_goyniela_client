import type { PlenoShares, PlenoSplit, SignPercentages } from "./matchdays";

const GOALS = ["0", "1", "2", "M"] as const;
const isShare = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;

/** 1X2 shares only when the three are published: a partial set would mislead. */
export function signPercentagesOf(one: number | null | undefined, x: number | null | undefined, two: number | null | undefined): SignPercentages | null {
  return isShare(one) && isShare(x) && isShare(two) ? { one, x, two } : null;
}

/** Keeps the known goal buckets with valid shares; null when none is usable. */
export function plenoSplitOf(raw: Record<string, number> | null | undefined): PlenoSplit | null {
  if (!raw) return null;
  const split: PlenoSplit = {};
  for (const goal of GOALS) if (isShare(raw[goal])) split[goal] = raw[goal];
  return Object.keys(split).length > 0 ? split : null;
}

/** Both sides are needed for the pleno to mean anything. */
export function plenoSharesOf(home: Record<string, number> | null | undefined, away: Record<string, number> | null | undefined): PlenoShares | null {
  const left = plenoSplitOf(home);
  const right = plenoSplitOf(away);
  return left && right ? { home: left, away: right } : null;
}
