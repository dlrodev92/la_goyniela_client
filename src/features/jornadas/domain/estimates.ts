import type { MatchEstimate } from "../../matchdays/domain/matchdays";
import type { LosillaMatch } from "../../results/domain/results";

const hasData = (estimate: Pick<MatchEstimate, "percentages" | "pleno"> | undefined): boolean =>
  !!estimate && (estimate.percentages !== null || estimate.pleno !== null);

/**
 * Percentages per match position. The persisted `estimaciones` of the jornada detail win; Losilla's live endpoint
 * (by jornada number) fills every position they do not cover, field by field. Positions with neither are absent.
 */
export function mergeEstimates(estimates: readonly MatchEstimate[], losilla: readonly LosillaMatch[]): Map<number, MatchEstimate> {
  const merged = new Map<number, MatchEstimate>();
  for (const match of losilla) {
    const estimate: MatchEstimate = { position: match.position, percentages: match.percentages ?? null, pleno: match.pleno ?? null };
    if (hasData(estimate)) merged.set(match.position, estimate);
  }
  for (const own of estimates) {
    if (!hasData(own)) continue;
    const fallback = merged.get(own.position);
    merged.set(own.position, {
      position: own.position,
      percentages: own.percentages ?? fallback?.percentages ?? null,
      pleno: own.pleno ?? fallback?.pleno ?? null,
    });
  }
  return merged;
}
