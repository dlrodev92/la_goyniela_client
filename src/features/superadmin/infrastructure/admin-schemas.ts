import { z } from "zod";
import type {
  AdminComposicionRow, AdminJornada, AdminTeam, AdminUser, TeamOption,
} from "../domain/admin";
import type { IngestReport } from "../domain/ingest";

const id = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const timestamp = z.string().datetime({ offset: true });
const nullableTimestamp = timestamp.nullable();

export const userSchema = z.object({
  id, email: z.string(), display_name: z.string(), is_active: z.boolean(), is_superadmin: z.boolean(), created_at: timestamp,
});
export const userListSchema = z.array(userSchema);

export const teamSchema = z.object({
  id, entity_id: z.string(), canonical_name: z.string(), short_name: z.string().nullable(), gender: z.string().nullable(),
  gender_known: z.boolean(), country: z.string().nullable(), logo_url: z.string().nullable(), competition_id: z.string(),
  deleted_at: nullableTimestamp,
});
export const teamListSchema = z.array(teamSchema);

/** Public `/api/v1/teams` envelope (used by the team picker search). */
export const publicTeamListSchema = z.object({
  items: z.array(z.object({
    id, entity_id: z.string(), competition_id: z.string(), canonical_name: z.string(),
    short_name: z.string().nullable().optional(), gender: z.string().nullable().optional(),
    country: z.string().nullable().optional(), logo_url: z.string().nullable().optional(),
  })),
  total: z.number().int(),
});

export const logoSchema = z.object({ team_id: id, entity_id: z.string(), logo_url: z.string().url(), size: z.number().int() });

export const jornadaSchema = z.object({
  id, temporada: z.number().int(), temporada_str: z.string(), numero: z.number().int().positive(),
  status: z.enum(["draft", "active", "past"]),
  sale_opens_at: nullableTimestamp, voting_closes_at: nullableTimestamp,
  kickoff_first_match_at: nullableTimestamp, kickoff_last_match_at: nullableTimestamp, escrutinio_expected_at: nullableTimestamp,
  fetched_at: timestamp, deleted_at: nullableTimestamp,
});
export const jornadaListSchema = z.array(jornadaSchema);

export const composicionSchema = z.object({
  posicion: z.number().int().min(1).max(15), local_team_id: id, visitante_team_id: id,
  local_raw: z.string(), visitante_raw: z.string(), kickoff_at: nullableTimestamp, competicion_raw: z.string().nullable(),
});
export const composicionListSchema = z.array(composicionSchema);

// §6.11. The OpenAPI types the response as a free object, so every field is lenient and defaulted.
const count = z.number().int().nonnegative().catch(0);
const ingestJornada = z.object({
  status: z.enum(["ok", "error"]).catch("error"), jornada: z.number().int(),
  jornadas_inserted: count, jornadas_existing: count, composicion_inserted: count, composicion_existing: count, stubs_created: count,
});
const ingestLosilla = z.object({
  status: z.enum(["ok", "error"]).catch("error"),
  escrutinio_inserted: z.boolean().catch(false), escrutinio_existed: z.boolean().catch(false),
  comentarios_inserted: count, comentarios_updated: count, comentarios_existing: count,
  network_failures: z.array(z.string()).catch([]), error: z.string().nullish(),
});
export const ingestSchema = z.object({
  quiniwin: z.object({
    status: z.enum(["ok", "partial", "noop"]).catch("partial"),
    temporada: z.number().int().nullish(), max_known_jornada: z.number().int().nullish(),
    jornadas: z.array(ingestJornada).catch([]), ok_count: count, fail_count: count,
  }),
  losilla_per_jornada: z.record(z.string(), ingestLosilla).nullish(),
});

export const toUser = (wire: z.infer<typeof userSchema>): AdminUser => ({
  id: String(wire.id), email: wire.email, displayName: wire.display_name, isActive: wire.is_active, isSuperadmin: wire.is_superadmin, createdAt: wire.created_at,
});
export const toTeam = (wire: z.infer<typeof teamSchema>): AdminTeam => ({
  id: String(wire.id), entityId: wire.entity_id, name: wire.canonical_name, shortName: wire.short_name, gender: wire.gender, genderKnown: wire.gender_known,
  country: wire.country, logoUrl: wire.logo_url, competitionId: wire.competition_id, deletedAt: wire.deleted_at,
});
export const toTeamOption = (wire: z.infer<typeof publicTeamListSchema>["items"][number]): TeamOption => ({
  id: String(wire.id), name: wire.canonical_name, shortName: wire.short_name ?? null, logoUrl: wire.logo_url ?? null, country: wire.country ?? null,
});
export const toJornada = (wire: z.infer<typeof jornadaSchema>): AdminJornada => ({
  id: String(wire.id), season: wire.temporada, seasonLabel: wire.temporada_str, number: wire.numero, status: wire.status,
  saleOpensAt: wire.sale_opens_at, votingClosesAt: wire.voting_closes_at, kickoffFirstAt: wire.kickoff_first_match_at,
  kickoffLastAt: wire.kickoff_last_match_at, escrutinioExpectedAt: wire.escrutinio_expected_at, fetchedAt: wire.fetched_at, deletedAt: wire.deleted_at,
});
export const toComposicion = (wire: z.infer<typeof composicionSchema>): AdminComposicionRow => ({
  position: wire.posicion, homeTeamId: String(wire.local_team_id), awayTeamId: String(wire.visitante_team_id),
  homeRaw: wire.local_raw, awayRaw: wire.visitante_raw, kickoffAt: wire.kickoff_at, competition: wire.competicion_raw,
});
export function toIngestReport(wire: z.infer<typeof ingestSchema>): IngestReport {
  const losilla = Object.entries(wire.losilla_per_jornada ?? {})
    .map(([jornada, row]) => ({
      jornada: Number(jornada), status: row.status, escrutinioInserted: row.escrutinio_inserted, escrutinioExisted: row.escrutinio_existed,
      comentariosInserted: row.comentarios_inserted, comentariosUpdated: row.comentarios_updated, comentariosExisting: row.comentarios_existing,
      networkFailures: row.network_failures, error: row.error ?? null,
    }))
    .sort((a, b) => a.jornada - b.jornada);
  return {
    quiniwinStatus: wire.quiniwin.status, season: wire.quiniwin.temporada ?? null, maxKnownJornada: wire.quiniwin.max_known_jornada ?? null,
    jornadas: wire.quiniwin.jornadas.map(row => ({
      jornada: row.jornada, status: row.status, inserted: row.jornadas_inserted, existing: row.jornadas_existing,
      composicionInserted: row.composicion_inserted, composicionExisting: row.composicion_existing, stubsCreated: row.stubs_created,
    })).sort((a, b) => a.jornada - b.jornada),
    okCount: wire.quiniwin.ok_count, failCount: wire.quiniwin.fail_count, losilla,
  };
}
