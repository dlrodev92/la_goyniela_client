import type { ComposicionPatch, JornadaPatch, TeamInput } from "../domain/admin";
import { madridLocalToIso } from "../domain/datetime";
import { parseAdminStatus } from "../domain/jornadas";

export type Parsed<T> = { ok: true; value: T } | { ok: false; fields: Record<string, string> };

export const TEAM_NAME_MAX = 120;
export const TEAM_ENTITY_MAX = 80;
export const GENDERS = [{ value: "men", label: "Masculino" }, { value: "women", label: "Femenino" }] as const;

const text = (values: Record<string, string>, key: string) => (values[key] ?? "").trim();
const optional = (value: string) => value || null;

/** Team create/edit form. `entityId` is only required on create (the slug cannot be patched). */
export function parseTeamForm(values: Record<string, string>, mode: "create" | "edit"): Parsed<TeamInput> {
  const fields: Record<string, string> = {};
  const entityId = text(values, "entityId");
  const name = text(values, "name");
  const competitionId = text(values, "competitionId");
  const country = text(values, "country").toUpperCase();
  const logoUrl = text(values, "logoUrl");
  const gender = text(values, "gender");
  if (mode === "create" && (!entityId || entityId.length > TEAM_ENTITY_MAX)) fields.entityId = `Obligatorio, hasta ${TEAM_ENTITY_MAX} caracteres.`;
  if (!name || name.length > TEAM_NAME_MAX) fields.name = `Obligatorio, hasta ${TEAM_NAME_MAX} caracteres.`;
  if (!competitionId) fields.competitionId = "Indica la competición (por ejemplo laliga-ea-sports).";
  if (country && !/^[A-Z]{3}$/.test(country)) fields.country = "Usa el código de 3 letras (por ejemplo ESP).";
  if (gender && gender !== "men" && gender !== "women") fields.gender = "Elige masculino, femenino o déjalo vacío.";
  if (logoUrl && !/^https?:\/\/\S+$/i.test(logoUrl)) fields.logoUrl = "Usa una dirección que empiece por http:// o https://.";
  if (Object.keys(fields).length > 0) return { ok: false, fields };
  return {
    ok: true,
    value: {
      entityId, name, shortName: optional(text(values, "shortName")), gender: optional(gender), genderKnown: values.genderKnown === "on" || values.genderKnown === "true",
      country: optional(country), logoUrl: optional(logoUrl), competitionId,
    },
  };
}

/** Jornada PATCH form: status, sale_opens_at and voting_closes_at (datetime-local values in Madrid time). */
export function parseJornadaForm(values: Record<string, string>): Parsed<JornadaPatch> {
  const fields: Record<string, string> = {};
  const status = parseAdminStatus(values.status);
  if (!status) fields.status = "Elige un estado válido.";
  const dates: Record<"saleOpensAt" | "votingClosesAt", string | null> = { saleOpensAt: null, votingClosesAt: null };
  for (const key of ["saleOpensAt", "votingClosesAt"] as const) {
    const raw = text(values, key);
    if (!raw) continue;
    const iso = madridLocalToIso(raw);
    if (!iso) fields[key] = "Esa fecha u hora no existe (por ejemplo, por el cambio de hora). Elige otra.";
    else dates[key] = iso;
  }
  if (Object.keys(fields).length > 0 || !status) return { ok: false, fields };
  return { ok: true, value: { status, saleOpensAt: dates.saleOpensAt, votingClosesAt: dates.votingClosesAt } };
}

/** Open (draft -> active) needs sale_opens_at. */
export function parseOpenForm(values: Record<string, string>): Parsed<{ saleOpensAt: string }> {
  const raw = text(values, "saleOpensAt");
  if (!raw) return { ok: false, fields: { saleOpensAt: "Indica cuándo se abre la venta." } };
  const iso = madridLocalToIso(raw);
  if (!iso) return { ok: false, fields: { saleOpensAt: "Esa fecha u hora no existe (por ejemplo, por el cambio de hora). Elige otra." } };
  return { ok: true, value: { saleOpensAt: iso } };
}

const TEAM_ID = /^[1-9]\d{0,14}$/;

/** One composicion row: both team ids, kickoff (datetime-local, Madrid) and competition text. */
export function parseComposicionForm(values: Record<string, string>): Parsed<ComposicionPatch> {
  const fields: Record<string, string> = {};
  const homeTeamId = text(values, "homeTeamId");
  const awayTeamId = text(values, "awayTeamId");
  if (!TEAM_ID.test(homeTeamId)) fields.homeTeamId = "Elige el equipo local.";
  if (!TEAM_ID.test(awayTeamId)) fields.awayTeamId = "Elige el equipo visitante.";
  let kickoffAt: string | null = null;
  const rawKickoff = text(values, "kickoffAt");
  if (rawKickoff) {
    kickoffAt = madridLocalToIso(rawKickoff);
    if (!kickoffAt) fields.kickoffAt = "Esa fecha u hora no existe (por ejemplo, por el cambio de hora). Elige otra.";
  }
  const competition = text(values, "competition");
  if (competition.length > 200) fields.competition = "Usa como máximo 200 caracteres.";
  if (Object.keys(fields).length > 0) return { ok: false, fields };
  return { ok: true, value: { homeTeamId, awayTeamId, kickoffAt, competition: optional(competition) } };
}
