import "server-only";
import { z } from "zod";
import type { Fixture, Matchday, MatchdayDetail, MatchdaysGateway, MatchEstimate } from "../domain/matchdays";
import { parseEffectivePhase } from "../domain/matchdays";
import { plenoSharesOf, signPercentagesOf } from "../domain/estimates";
import { createAuthenticatedClient } from "../../../lib/http/json-client";
import { fullNameOf, logoUrlOf, shortNameOf, teamRefSchema } from "../../../lib/http/team-wire";

const id = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const timestamp = z.string().datetime({ offset: true });

const matchdaySchema = z.object({
  id,
  temporada: z.number().int().positive(),
  temporada_str: z.string(),
  numero: z.number().int().positive(),
  status: z.enum(["draft", "active", "past"]),
  sale_opens_at: timestamp.nullable().optional(),
  voting_closes_at: timestamp.nullable().optional(),
  kickoff_first_match_at: timestamp.nullable().optional(),
  fetched_at: timestamp,
  deleted_at: timestamp.nullable().optional(),
  // Lenient on purpose: an unknown phase (or a malformed clock) must not fail the matchday; the domain derives it instead.
  effective_phase: z.unknown().optional().transform(parseEffectivePhase),
  now: timestamp.nullable().optional().catch(null),
});
const fixtureSchema = z.object({
  posicion: z.number().int().min(1).max(15),
  local_raw: z.string(),
  visitante_raw: z.string(),
  kickoff_at: timestamp.nullable().optional(),
  competicion_raw: z.string().nullable().optional(),
  local_team: teamRefSchema.nullable().optional(),
  visitante_team: teamRefSchema.nullable().optional(),
});
// Live percentages: decorative, so a malformed block degrades to "none" instead of failing the whole matchday.
const share = z.number().nullable().optional();
const split = z.record(z.string(), z.number()).nullable().optional();
const estimateSchema = z.object({
  partido_orden: z.number().int().min(1).max(15),
  uno_porcentaje: share, x_porcentaje: share, dos_porcentaje: share, pleno_local: split, pleno_visitante: split,
});
const detailSchema = matchdaySchema.extend({
  partidos: z.array(fixtureSchema),
  estimaciones: z.array(estimateSchema).catch([]),
});

// The backend answers a bare array (not the {items,total,...} envelope from API.md §1.5).
export const matchdayListSchema = z.array(matchdaySchema);
export const matchdayDetailSchema = detailSchema;

function toMatchday(wire: z.infer<typeof matchdaySchema>): Matchday {
  return {
    id: String(wire.id), season: wire.temporada, seasonLabel: wire.temporada_str, number: wire.numero,
    status: wire.status, saleOpensAt: wire.sale_opens_at ?? null, votingClosesAt: wire.voting_closes_at ?? null,
    firstKickoffAt: wire.kickoff_first_match_at ?? null, fetchedAt: wire.fetched_at,
    deletedAt: wire.deleted_at ?? null, effectivePhase: wire.effective_phase, serverNow: wire.now ?? null,
  };
}
function toEstimate(wire: z.infer<typeof estimateSchema>): MatchEstimate {
  return {
    position: wire.partido_orden,
    percentages: signPercentagesOf(wire.uno_porcentaje, wire.x_porcentaje, wire.dos_porcentaje),
    pleno: plenoSharesOf(wire.pleno_local, wire.pleno_visitante),
  };
}
function toFixture(wire: z.infer<typeof fixtureSchema>): Fixture {
  return { position: wire.posicion, home: wire.local_raw, away: wire.visitante_raw,
    kickoffAt: wire.kickoff_at ?? null, competition: wire.competicion_raw ?? null,
    homeLogoUrl: logoUrlOf(wire.local_team), awayLogoUrl: logoUrlOf(wire.visitante_team),
    homeShortName: shortNameOf(wire.local_team), awayShortName: shortNameOf(wire.visitante_team),
    homeFullName: fullNameOf(wire.local_team), awayFullName: fullNameOf(wire.visitante_team) };
}
function toDetail(wire: z.infer<typeof detailSchema>): MatchdayDetail {
  const fixtures = wire.partidos.map(toFixture).sort((a, b) => a.position - b.position);
  const estimates = wire.estimaciones.map(toEstimate).sort((a, b) => a.position - b.position);
  return { ...toMatchday(wire), fixtures, estimates };
}

export function createMatchdaysGateway(baseUrl: string, token: string, fetcher: typeof fetch = fetch, timeoutMs?: number): MatchdaysGateway {
  const request = createAuthenticatedClient(baseUrl, token, fetcher, timeoutMs);
  return {
    async list(filter = {}) {
      const query = new URLSearchParams();
      if (filter.status) query.set("status", filter.status);
      if (filter.season !== undefined) query.set("season", String(filter.season));
      if (filter.limit !== undefined) query.set("limit", String(filter.limit));
      const queryString = query.toString();
      const suffix = queryString ? `?${queryString}` : "";
      return (await request(`/jornadas${suffix}`, matchdayListSchema)).map(toMatchday);
    },
    async get(matchdayId) {
      return toDetail(await request(`/jornadas/${encodeURIComponent(matchdayId)}`, matchdayDetailSchema));
    },
  };
}
