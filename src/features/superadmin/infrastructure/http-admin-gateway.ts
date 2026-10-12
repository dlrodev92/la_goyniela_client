import "server-only";
import type { AdminGateway } from "../domain/admin";
import { adminStatusMap } from "../domain/errors";
import { createAuthenticatedClient } from "../../../lib/http/json-client";
import {
  composicionListSchema, composicionSchema, ingestSchema, jornadaListSchema, jornadaSchema, logoSchema, publicTeamListSchema, teamListSchema, teamSchema,
  toComposicion, toIngestReport, toJornada, toTeam, toTeamOption, toUser, userListSchema, userSchema,
} from "./admin-schemas";

const ADMIN = "/api/v1/admin";
const part = (value: string) => encodeURIComponent(value);
const query = (params: Record<string, string | number | boolean | null | undefined>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== null && value !== undefined && value !== "") search.set(key, String(value));
  const text = search.toString();
  return text ? `?${text}` : "";
};

/**
 * Superadmin gateway. The base URL is the API origin: admin routes live under `/api/v1/admin`, while the logo upload is the
 * legacy `/admin/teams/{id}/logo` (no version prefix). Admin routes are rate limited (429 -> `rate-limit` with the
 * Retry-After seconds); nothing here retries.
 */
export function createAdminGateway(baseUrl: string, token: string, fetcher: typeof fetch = fetch, timeoutMs = 15000): AdminGateway {
  const request = createAuthenticatedClient(baseUrl, token, fetcher, timeoutMs);
  return {
    async listUsers({ onlySuperadmins, limit, offset }) {
      const path = `${ADMIN}/users${query({ only_superadmins: onlySuperadmins ? true : null, limit, offset })}`;
      return (await request(path, userListSchema)).map(toUser);
    },
    async patchUser(userId, patch) {
      const body = { is_superadmin: patch.isSuperadmin, is_active: patch.isActive };
      return toUser(await request(`${ADMIN}/users/${part(userId)}`, userSchema, { method: "PATCH", body, statusMap: adminStatusMap("user-patch") }));
    },
    async listTeams({ includeDeleted, limit, offset }) {
      const path = `${ADMIN}/teams${query({ include_deleted: includeDeleted ? true : null, limit, offset })}`;
      return (await request(path, teamListSchema)).map(toTeam);
    },
    async createTeam(input) {
      const body = {
        entity_id: input.entityId, canonical_name: input.name, short_name: input.shortName, gender: input.gender, gender_known: input.genderKnown,
        country: input.country, logo_url: input.logoUrl, competition_id: input.competitionId,
      };
      return toTeam(await request(`${ADMIN}/teams`, teamSchema, { method: "POST", body, statusMap: adminStatusMap("team-create") }));
    },
    async patchTeam(teamId, patch) {
      const body: Record<string, unknown> = {};
      if (patch.name !== undefined) body.canonical_name = patch.name;
      if (patch.shortName !== undefined) body.short_name = patch.shortName;
      if (patch.gender !== undefined) body.gender = patch.gender;
      if (patch.genderKnown !== undefined) body.gender_known = patch.genderKnown;
      if (patch.country !== undefined) body.country = patch.country;
      if (patch.logoUrl !== undefined) body.logo_url = patch.logoUrl;
      if (patch.competitionId !== undefined) body.competition_id = patch.competitionId;
      return toTeam(await request(`${ADMIN}/teams/${part(teamId)}`, teamSchema, { method: "PATCH", body, statusMap: adminStatusMap("team-patch") }));
    },
    async deleteTeam(teamId) {
      return toTeam(await request(`${ADMIN}/teams/${part(teamId)}`, teamSchema, { method: "DELETE", statusMap: adminStatusMap("team-delete") }));
    },
    async restoreTeam(teamId) {
      return toTeam(await request(`${ADMIN}/teams/${part(teamId)}/restore`, teamSchema, { method: "POST" }));
    },
    async uploadTeamLogo(teamId, file) {
      const form = new FormData();
      form.append("file", new Blob([file.bytes], { type: file.contentType }), file.name);
      // Legacy route: it is guarded by "admin of at least one group", not by the superadmin flag, so a 403 can happen here.
      const result = await request(`/admin/teams/${part(teamId)}/logo`, logoSchema, { method: "POST", body: form, statusMap: adminStatusMap("logo") });
      return result.logo_url;
    },
    async searchTeams(text, limit = 8) {
      const result = await request(`/api/v1/teams${query({ q: text.trim(), limit })}`, publicTeamListSchema);
      return result.items.map(toTeamOption);
    },
    async listJornadas({ includeDeleted, status, limit, offset }) {
      const path = `${ADMIN}/jornadas${query({ include_deleted: includeDeleted ? true : null, status, limit, offset })}`;
      return (await request(path, jornadaListSchema)).map(toJornada);
    },
    async getJornada(jornadaId) {
      return toJornada(await request(`${ADMIN}/jornadas/${part(jornadaId)}`, jornadaSchema));
    },
    async patchJornada(jornadaId, patch) {
      const body: Record<string, unknown> = {};
      if (patch.status !== undefined) body.status = patch.status;
      if (patch.saleOpensAt !== undefined) body.sale_opens_at = patch.saleOpensAt;
      if (patch.votingClosesAt !== undefined) body.voting_closes_at = patch.votingClosesAt;
      return toJornada(await request(`${ADMIN}/jornadas/${part(jornadaId)}`, jornadaSchema, { method: "PATCH", body, statusMap: adminStatusMap("jornada-patch") }));
    },
    async transitionJornada(jornadaId, transition, body) {
      const wire = body ? { sale_opens_at: body.saleOpensAt } : undefined;
      const statusMap = transition === "restore" ? {} : adminStatusMap("jornada-transition");
      return toJornada(await request(`${ADMIN}/jornadas/${part(jornadaId)}/${transition}`, jornadaSchema, { method: "POST", body: wire, statusMap }));
    },
    async deleteJornada(jornadaId) {
      return toJornada(await request(`${ADMIN}/jornadas/${part(jornadaId)}`, jornadaSchema, { method: "DELETE" }));
    },
    async listComposicion(jornadaId) {
      return (await request(`${ADMIN}/jornadas/${part(jornadaId)}/composicion`, composicionListSchema)).map(toComposicion).sort((a, b) => a.position - b.position);
    },
    async patchComposicion(jornadaId, position, patch) {
      const body: Record<string, unknown> = {};
      if (patch.homeTeamId !== undefined) body.local_team_id = Number(patch.homeTeamId);
      if (patch.awayTeamId !== undefined) body.visitante_team_id = Number(patch.awayTeamId);
      if (patch.kickoffAt !== undefined) body.kickoff_at = patch.kickoffAt;
      if (patch.competition !== undefined) body.competicion_raw = patch.competition;
      return toComposicion(await request(`${ADMIN}/jornadas/${part(jornadaId)}/composicion/${position}`, composicionSchema, { method: "PATCH", body, statusMap: adminStatusMap("composicion-patch") }));
    },
    async ingestQuiniwin(input) {
      const body = {
        temporada: input.temporada, jornada_range_start: input.jornadaRangeStart, jornada_range_end: input.jornadaRangeEnd,
        forward_cap: input.forwardCap, fetch_timeout_sec: input.fetchTimeoutSec, run_losilla: input.runLosilla,
      };
      // The ingest scrapes Quiniwin and Losilla in sequence: it can take far longer than a normal call.
      const slow = createAuthenticatedClient(baseUrl, token, fetcher, 120000);
      return toIngestReport(await slow(`${ADMIN}/ingest/quiniwin`, ingestSchema, { method: "POST", body, statusMap: adminStatusMap("ingest") }));
    },
  };
}

