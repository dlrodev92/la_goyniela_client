"use server";

import { revalidatePath } from "next/cache";
import { adminGateway } from "./gateway";
import { requireSuperadmin } from "./access";
import { matchdaysGateway } from "../../matchdays/server/gateway";
import type { Fixture } from "../../matchdays/domain/matchdays";
import { withSession } from "../../shared/server/authenticated-api";
import { ServiceError, safeMessage } from "../../../lib/http/errors";
import { isRouteId } from "../../../lib/route-id";
import {
  parseComposicionForm, parseJornadaForm, parseOpenForm, parseTeamForm,
} from "../application/forms";
import type { ActionState, AdminComposicionRow, AdminJornada, AdminGateway } from "../domain/admin";
import { parseAdminStatus, STATUS_LABELS, type AdminJornadaStatus } from "../domain/jornadas";
import { partialFailureMessage, planStatusChange, type StatusStep } from "../domain/status-change";
import { parseIngestForm, type IngestReport } from "../domain/ingest";
import type { TeamOption } from "../domain/admin";
import { checkLogoFile } from "../domain/logo";

export type ComposicionState = ActionState & { jornada?: AdminJornada };
export type StatusChangeState = ActionState & { jornada?: AdminJornada };
export type TeamLabel = { name: string; logoUrl: string | null };
export type ComposicionLoad =
  | { ok: true; rows: AdminComposicionRow[]; teams: Record<number, { home: TeamLabel | null; away: TeamLabel | null }> }
  | { ok: false; message: string; rateLimited: boolean };
export type IngestState = ActionState & { report?: IngestReport };

const text = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};
const values = (formData: FormData, keys: string[]) => Object.fromEntries(keys.map(key => [key, text(formData, key)]));

function failure(error: unknown): ActionState {
  // Framework control-flow errors (redirect, notFound) and bugs must not become form messages.
  if (!(error instanceof ServiceError)) throw error;
  return { status: "error", message: safeMessage(error) };
}
const invalid = (fields: Record<string, string>): ActionState => ({ status: "error", message: "Revisa los campos marcados.", fields });
const badId = (): ActionState => ({ status: "error", message: "No hemos encontrado lo que buscabas." });
const run = <T>(call: () => Promise<T>) => withSession(call, { clearCookie: true });

export async function ingestAction(_previous: IngestState, formData: FormData): Promise<IngestState> {
  const parsed = parseIngestForm(
    values(formData, ["temporada", "jornadaRangeStart", "jornadaRangeEnd", "forwardCap", "fetchTimeoutSec"]),
    text(formData, "runLosilla") === "true",
  );
  if (!parsed.ok) return invalid(parsed.fields);
  try {
    const report = await run(async () => (await adminGateway()).ingestQuiniwin(parsed.request));
    revalidatePanel();
    return { status: "saved", message: "", report };
  } catch (error) { return failure(error); }
}

export async function patchUserAction(userId: string, _previous: ActionState, formData: FormData): Promise<ActionState> {
  if (!isRouteId(userId)) return badId();
  const field = text(formData, "field");
  const value = text(formData, "value") === "true";
  if (field !== "isSuperadmin" && field !== "isActive") return badId();
  try {
    await run(async () => (await adminGateway()).patchUser(userId, { [field]: value }));
  } catch (error) { return failure(error); }
  revalidatePanel();
  return { status: "saved", message: "Usuario actualizado." };
}

export async function createTeamAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseTeamForm(values(formData, ["entityId", "name", "shortName", "gender", "genderKnown", "country", "logoUrl", "competitionId"]), "create");
  if (!parsed.ok) return invalid(parsed.fields);
  try {
    await run(async () => (await adminGateway()).createTeam(parsed.value));
  } catch (error) { return failure(error); }
  revalidatePanel();
  return { status: "saved", message: "Equipo creado." };
}

export async function updateTeamAction(teamId: string, _previous: ActionState, formData: FormData): Promise<ActionState> {
  if (!isRouteId(teamId)) return badId();
  const parsed = parseTeamForm(values(formData, ["name", "shortName", "gender", "genderKnown", "country", "logoUrl", "competitionId"]), "edit");
  if (!parsed.ok) return invalid(parsed.fields);
  const logo = formData.get("logo");
  const file = logo instanceof File && logo.size > 0 ? logo : null;
  if (file) {
    const problem = checkLogoFile({ type: file.type, size: file.size });
    if (problem) return invalid({ logo: problem });
  }
  const { entityId: _entityId, ...patch } = parsed.value;
  void _entityId;
  try {
    await run(async () => {
      const admin = await adminGateway();
      // The upload stores the file and sets logo_url on the team; the patch afterwards must not overwrite it with the old URL.
      if (file) {
        await admin.uploadTeamLogo(teamId, { name: file.name, contentType: file.type, bytes: await file.arrayBuffer() });
        const { logoUrl: _logoUrl, ...rest } = patch;
        void _logoUrl;
        await admin.patchTeam(teamId, rest);
      } else {
        await admin.patchTeam(teamId, patch);
      }
    });
  } catch (error) { return failure(error); }
  revalidatePanel();
  return { status: "saved", message: "Equipo actualizado." };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- signature required by useActionState
export async function deleteTeamAction(teamId: string, _previous: ActionState): Promise<ActionState> {
  if (!isRouteId(teamId)) return badId();
  try {
    await run(async () => (await adminGateway()).deleteTeam(teamId));
  } catch (error) { return failure(error); }
  revalidatePanel();
  return { status: "saved", message: "Equipo eliminado." };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- signature required by useActionState
export async function restoreTeamAction(teamId: string, _previous: ActionState): Promise<ActionState> {
  if (!isRouteId(teamId)) return badId();
  try {
    await run(async () => (await adminGateway()).restoreTeam(teamId));
  } catch (error) { return failure(error); }
  revalidatePanel();
  return { status: "saved", message: "Equipo restaurado." };
}

/** Team picker search for the composicion editor. Uses the public teams list (not rate limited). */
export async function searchTeamsAction(query: string): Promise<{ teams: TeamOption[]; error?: string }> {
  const needle = query.trim();
  if (needle.length < 2 || needle.length > 80) return { teams: [] };
  try {
    return { teams: await run(async () => (await adminGateway()).searchTeams(needle, 8)) };
  } catch (error) {
    if (!(error instanceof ServiceError)) throw error;
    return { teams: [], error: safeMessage(error) };
  }
}

const TRANSITIONS = { restore: "Jornada restaurada.", delete: "Jornada eliminada." } as const;

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- signature required by useActionState
export async function jornadaLifecycleAction(jornadaId: string, kind: keyof typeof TRANSITIONS, _previous: ActionState): Promise<ActionState> {
  if (!isRouteId(jornadaId) || !(kind in TRANSITIONS)) return badId();
  try {
    await run(async () => {
      const admin = await adminGateway();
      return kind === "delete" ? admin.deleteJornada(jornadaId) : admin.transitionJornada(jornadaId, kind);
    });
  } catch (error) { return failure(error); }
  revalidatePanel();
  return { status: "saved", message: TRANSITIONS[kind] };
}

export async function updateJornadaAction(jornadaId: string, _previous: ActionState, formData: FormData): Promise<ActionState> {
  if (!isRouteId(jornadaId)) return badId();
  const parsed = parseJornadaForm(values(formData, ["status", "saleOpensAt", "votingClosesAt"]));
  if (!parsed.ok) return invalid(parsed.fields);
  try {
    await run(async () => (await adminGateway()).patchJornada(jornadaId, parsed.value));
  } catch (error) { return failure(error); }
  revalidatePanel();
  return { status: "saved", message: "Jornada actualizada." };
}

async function runStep(admin: AdminGateway, jornadaId: string, step: StatusStep, saleOpensAt: string): Promise<AdminJornada> {
  switch (step.action) {
    case "open": return admin.transitionJornada(jornadaId, "open", { saleOpensAt });
    case "close": return admin.transitionJornada(jornadaId, "close");
    case "reopen": return admin.transitionJornada(jornadaId, "reopen");
    case "patch-draft": return admin.patchJornada(jornadaId, { status: "draft" });
  }
}

/**
 * Moves a jornada to any of the three states. The backend only allows draft <-> active and active <-> past, so draft -> past and
 * past -> draft are chained here (see `planStatusChange`). Reads the jornada first (the client's idea of its state may be stale),
 * runs the steps in order and, if a later step fails, reports where the jornada was left.
 */
export async function changeJornadaStatusAction(jornadaId: string, _previous: StatusChangeState, formData: FormData): Promise<StatusChangeState> {
  if (!isRouteId(jornadaId)) return badId();
  const target: AdminJornadaStatus | null = parseAdminStatus(text(formData, "to"));
  if (!target) return invalid({ status: "Elige un estado válido." });
  let typedSale: string | null = null;
  if (text(formData, "saleOpensAt").trim()) {
    const parsed = parseOpenForm(values(formData, ["saleOpensAt"]));
    if (!parsed.ok) return invalid(parsed.fields);
    typedSale = parsed.value.saleOpensAt;
  }
  let current: AdminJornada;
  try {
    current = await run(async () => (await adminGateway()).getJornada(jornadaId));
  } catch (error) { return failure(error); }
  const steps = planStatusChange(current.status, target, Boolean(typedSale ?? current.saleOpensAt));
  if (steps.length === 0) return { status: "saved", message: "La jornada ya estaba en ese estado.", jornada: current };
  const saleOpensAt = typedSale ?? current.saleOpensAt ?? new Date().toISOString();
  for (const [index, step] of steps.entries()) {
    try {
      current = await run(async () => runStep(await adminGateway(), jornadaId, step, saleOpensAt));
    } catch (error) {
      const base = failure(error);
      if (index === 0) return base;
      revalidatePanel();
      return { ...base, message: partialFailureMessage(current.status, target, base.message), jornada: current };
    }
  }
  revalidatePanel();
  return { status: "saved", message: `Jornada en «${STATUS_LABELS[target]}».`, jornada: current };
}

/**
 * The 15 admin rows of one jornada plus, best effort, the public detail that carries team names and crests (not rate limited;
 * a draft the public API hides just falls back to the raw names). Called when a jornada row is expanded, never up front.
 */
export async function loadComposicionAction(jornadaId: string): Promise<ComposicionLoad> {
  if (!isRouteId(jornadaId)) return { ok: false, message: "No hemos encontrado lo que buscabas.", rateLimited: false };
  await requireSuperadmin();
  try {
    const rows = await run(async () => (await adminGateway()).listComposicion(jornadaId));
    const fixtures = await (await matchdaysGateway()).get(jornadaId).then(detail => detail.fixtures, () => [] as Fixture[]);
    const label = (name: string | null | undefined, logoUrl: string | null | undefined): TeamLabel | null => (name ? { name, logoUrl: logoUrl ?? null } : null);
    const teams: Record<number, { home: TeamLabel | null; away: TeamLabel | null }> = {};
    for (const fixture of fixtures) {
      teams[fixture.position] = {
        home: label(fixture.homeFullName ?? fixture.homeShortName, fixture.homeLogoUrl),
        away: label(fixture.awayFullName ?? fixture.awayShortName, fixture.awayLogoUrl),
      };
    }
    return { ok: true, rows, teams };
  } catch (error) {
    if (!(error instanceof ServiceError)) throw error;
    return { ok: false, message: safeMessage(error), rateLimited: error.code === "rate-limit" };
  }
}

export async function updateComposicionAction(jornadaId: string, position: number, _previous: ComposicionState, formData: FormData): Promise<ComposicionState> {
  if (!isRouteId(jornadaId) || !Number.isInteger(position) || position < 1 || position > 15) return badId();
  const parsed = parseComposicionForm(values(formData, ["homeTeamId", "awayTeamId", "kickoffAt", "competition"]));
  if (!parsed.ok) return invalid(parsed.fields);
  try {
    const jornada = await run(async () => {
      const admin = await adminGateway();
      await admin.patchComposicion(jornadaId, position, parsed.value);
      // The backend recalculates the kickoff window, voting_closes_at and escrutinio_expected_at: read them back.
      return admin.getJornada(jornadaId);
    });
    revalidatePanel();
    return { status: "saved", message: `Partido ${position} actualizado. Fechas de la jornada recalculadas.`, jornada };
  } catch (error) { return failure(error); }
}

/** Everything the panel shows lives at /superadmin; the public pages that read jornadas are refreshed too. */
function revalidatePanel() {
  revalidatePath("/superadmin");
  revalidatePath("/jornadas");
  revalidatePath("/dashboard");
}
