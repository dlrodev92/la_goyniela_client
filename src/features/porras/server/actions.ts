"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createPorra, getPorra, getPropuesta, listFormats, listIntuicionOptions, listPorras, patchPorra, removeBoleto, saveFinalBoleto, submitVote, VoteValidationError } from "../application/porras";
import { flaggedFields, formatOptions, parseBudget, pricePerColumn, type FieldErrors, type FormatOption } from "../domain/logic";
import { isColumnsDraft, voteRulesOf, type ColumnsDraft } from "../domain/columns";
import { isValidSpec, specFromFields, intuicionOptionsFor } from "../domain/modes";
import { type IntuicionOption, type PorraSpec, type Propuesta } from "../domain/porras";
import { porrasGateway } from "./gateway";
import { withSession } from "../../shared/server/authenticated-api";
import { safeMessage, ServiceError, type FailureCode } from "../../../lib/http/errors";
import { isRouteId } from "../../../lib/route-id";

export type SaveBoletoState =
  | { status: "saved"; message: string }
  | { status: "error"; message: string; fields: FieldErrors; closed?: boolean };

/** Refusals that mean "no more voting here": the boleto switches to read-only with the specific reason. */
const CLOSED_CODES: ReadonlySet<FailureCode> = new Set([
  "voting-closed", "porra-closed", "jornada-in-preparation", "sale-not-opened", "voting-window-closed", "escrutinio-pending", "escrutinio-disponible",
]);

/**
 * Saves the caller's boleto (idempotent). The draft comes from the client, so its shape is checked again here, and
 * the porra's own rules (columns, one sign per row, fijos) are read from the API rather than trusted from the client.
 */
export async function saveBoletoAction(groupId: string, porraId: string, draft: ColumnsDraft): Promise<SaveBoletoState> {
  if (!isRouteId(groupId) || !isRouteId(porraId) || !isColumnsDraft(draft)) {
    return { status: "error", message: "No hemos podido leer tu boleto. Recarga la página e inténtalo de nuevo.", fields: {} };
  }
  try {
    await withSession(async () => {
      const gateway = await porrasGateway();
      return submitVote(gateway, groupId, porraId, draft, voteRulesOf(await getPorra(gateway, groupId, porraId)));
    }, { clearCookie: true });
  } catch (error) {
    if (error instanceof VoteValidationError) {
      return { status: "error", message: error.fields.columnas ?? "Completa los 14 partidos (en todas las columnas) y el pleno al 15 antes de guardar.", fields: error.fields };
    }
    // Framework control-flow errors (redirect) and bugs must not become form messages.
    if (!(error instanceof ServiceError)) throw error;
    if (CLOSED_CODES.has(error.code)) return { status: "error", message: safeMessage(error), fields: {}, closed: true };
    // A 403 "not a member of this group": the member left (or was removed) while the boleto was open.
    if (error.code === "forbidden") return { status: "error", message: "Ya no perteneces a esta peña, así que no puedes guardar el boleto.", fields: {}, closed: true };
    if (error.code === "invalid-picks") {
      return { status: "error", message: "Revisa las filas marcadas e inténtalo de nuevo.", fields: flaggedFields(error.invalidMatches) };
    }
    return { status: "error", message: safeMessage(error), fields: {} };
  }
  revalidatePath(`/groups/${groupId}/porras/${porraId}`);
  revalidatePath(`/groups/${groupId}`);
  revalidatePath("/dashboard");
  return { status: "saved", message: "Boleto guardado" };
}

const INVALID_BUDGET = "Escribe un presupuesto válido, por ejemplo 6 o 6,50.";
const INVALID_SPEC = "Elige un formato de la lista antes de continuar.";
const BOLETO_FIRST = "La peña ya ha confirmado su boleto. Bórralo antes de cambiar el formato.";
const ADMIN_ONLY = "Solo los admins de la peña pueden hacer esto.";

function adminMessage(error: ServiceError): string {
  return error.code === "forbidden" ? ADMIN_ONLY : safeMessage(error);
}

export type OptionsState =
  /**
   * What fits a budget in every mode. `pricePerColumn` is the price the API implies for the jornada (cost / columns of its
   * múltiple formats); null when no format fits. Sencilla and reducida are priced with it on the client.
   */
  | { status: "ok"; budgetEur: string; formats: FormatOption[]; intuicion: IntuicionOption[]; pricePerColumn: string | null }
  | { status: "error"; message: string };

/**
 * Admin: the options that fit a budget. Múltiple formats come from porra-formats; Intuición options from the budget advisor
 * (a failure there only empties that list). Called by the budget step of the create and settings flows.
 */
export async function loadOptionsAction(groupId: string, jornadaId: string, budgetRaw: string): Promise<OptionsState> {
  const budgetEur = typeof budgetRaw === "string" ? parseBudget(budgetRaw) : null;
  if (!isRouteId(groupId) || !isRouteId(jornadaId)) return { status: "error", message: "No hemos podido leer la jornada. Recarga la página e inténtalo de nuevo." };
  if (!budgetEur) return { status: "error", message: INVALID_BUDGET };
  try {
    const [formats, intuicion] = await withSession(async () => {
      const gateway = await porrasGateway();
      return Promise.all([
        listFormats(gateway, groupId, jornadaId, budgetEur),
        listIntuicionOptions(gateway, groupId, budgetEur).catch((error: unknown) => {
          if (error instanceof ServiceError && error.code !== "unauthenticated") return [] as IntuicionOption[];
          throw error;
        }),
      ]);
    }, { clearCookie: true });
    const options = formatOptions(formats, budgetEur);
    return { status: "ok", budgetEur, formats: options, intuicion: intuicionOptionsFor(intuicion, budgetEur), pricePerColumn: pricePerColumn(options) };
  } catch (error) {
    if (!(error instanceof ServiceError)) throw error;
    return { status: "error", message: adminMessage(error) };
  }
}

export type CreatePorraState =
  | { status: "error"; message: string }
  | { status: "exists"; message: string; porraId: string | null };

/** Admin: creates the porra and goes to it. A 409 answers with a link to the existing one. */
export async function createPorraAction(groupId: string, input: { jornadaId: string; budgetRaw: string; spec: PorraSpec }): Promise<CreatePorraState> {
  const budgetEur = typeof input?.budgetRaw === "string" ? parseBudget(input.budgetRaw) : null;
  if (!isRouteId(groupId) || !isRouteId(input?.jornadaId)) {
    return { status: "error", message: "No hemos podido leer los datos de la porra. Recarga la página e inténtalo de nuevo." };
  }
  if (!isValidSpec(input.spec)) return { status: "error", message: INVALID_SPEC };
  if (!budgetEur) return { status: "error", message: INVALID_BUDGET };
  let porraId: string;
  try {
    const created = await withSession(async () => createPorra(await porrasGateway(), groupId, { jornadaId: input.jornadaId, budgetEur, spec: input.spec }), { clearCookie: true });
    porraId = created.id;
  } catch (error) {
    if (!(error instanceof ServiceError)) throw error;
    if (error.code === "porra-exists") {
      let existing: string | null = null;
      try {
        existing = (await withSession(async () => listPorras(await porrasGateway(), groupId, input.jornadaId))).find(porra => porra.jornadaId === input.jornadaId)?.id ?? null;
      } catch (lookup) {
        if (!(lookup instanceof ServiceError)) throw lookup;
      }
      return { status: "exists", message: safeMessage(error), porraId: existing };
    }
    return { status: "error", message: adminMessage(error) };
  }
  revalidatePath(`/groups/${groupId}`);
  redirect(`/groups/${groupId}/porras/${porraId}`);
}

export type AdminFormState = { status: "idle" | "saved" | "error"; message: string };

/**
 * Admin: changes the budget and/or the format of an open porra. FormData: `budget` (optional) and, to change the format,
 * `modo` plus its fields (`dobles`+`triples`, `columnas`, `reduccion`, `fijos`+`columnas`). A budget-only edit stays
 * allowed while a boleto exists; a format change needs the boleto deleted first.
 */
export async function updatePorraAction(groupId: string, porraId: string, _previous: AdminFormState, formData: FormData): Promise<AdminFormState> {
  if (!isRouteId(groupId) || !isRouteId(porraId)) return { status: "error", message: "No hemos podido leer la porra. Recarga la página e inténtalo de nuevo." };
  const rawBudget = formData.get("budget");
  const budgetEur = rawBudget === null ? undefined : parseBudget(String(rawBudget));
  if (rawBudget !== null && !budgetEur) return { status: "error", message: INVALID_BUDGET };
  const changesFormat = formData.get("modo") !== null;
  const spec = changesFormat ? specFromFields(name => { const value = formData.get(name); return value === null ? null : String(value); }) : undefined;
  if (changesFormat && !spec) return { status: "error", message: INVALID_SPEC };
  if (!budgetEur && !spec) return { status: "error", message: "No hay nada que guardar." };
  try {
    await withSession(async () => {
      const gateway = await porrasGateway();
      // The API only guards the múltiple format against an existing boleto, so every format change is checked here.
      if (spec && (await getPorra(gateway, groupId, porraId)).hasBoleto) throw new ServiceError("boleto-locked", { message: BOLETO_FIRST });
      return patchPorra(gateway, groupId, porraId, { ...(budgetEur ? { budgetEur } : {}), ...(spec ? { spec } : {}) });
    }, { clearCookie: true });
  } catch (error) {
    if (!(error instanceof ServiceError)) throw error;
    return { status: "error", message: adminMessage(error) };
  }
  revalidatePath(`/groups/${groupId}/porras/${porraId}`);
  revalidatePath(`/groups/${groupId}`);
  return { status: "saved", message: spec ? "Formato actualizado" : "Presupuesto actualizado" };
}

/** Admin: deletes the final boleto (the porra and the picks stay) so the format can change. */
export async function deleteBoletoAction(groupId: string, porraId: string): Promise<AdminFormState> {
  if (!isRouteId(groupId) || !isRouteId(porraId)) return { status: "error", message: "No hemos podido leer la porra. Recarga la página e inténtalo de nuevo." };
  try {
    await withSession(async () => removeBoleto(await porrasGateway(), groupId, porraId), { clearCookie: true });
  } catch (error) {
    if (!(error instanceof ServiceError)) throw error;
    // Nothing to delete: the goal (no boleto) is already met.
    if (error.code !== "not-found") return { status: "error", message: adminMessage(error) };
  }
  revalidatePath(`/groups/${groupId}/porras/${porraId}`);
  revalidatePath(`/groups/${groupId}/porras/${porraId}/final`);
  revalidatePath(`/groups/${groupId}`);
  revalidatePath("/dashboard");
  return { status: "saved", message: "Boleto borrado" };
}

export type PropuestaState = { status: "ok"; propuesta: Propuesta } | { status: "error"; message: string };

/** Admin: computes the proposal on demand. Nothing is saved. */
export async function calcularPropuestaAction(groupId: string, porraId: string): Promise<PropuestaState> {
  if (!isRouteId(groupId) || !isRouteId(porraId)) return { status: "error", message: "No hemos podido leer la porra. Recarga la página e inténtalo de nuevo." };
  try {
    const propuesta = await withSession(async () => getPropuesta(await porrasGateway(), groupId, porraId), { clearCookie: true });
    return { status: "ok", propuesta };
  } catch (error) {
    if (!(error instanceof ServiceError)) throw error;
    return { status: "error", message: adminMessage(error) };
  }
}

export type ConfirmBoletoState =
  | { status: "saved"; message: string }
  | { status: "error"; message: string; fields: FieldErrors };

/** Admin: saves the final boleto of the peña (one or several columns). The draft comes from the client, so its shape is checked again here. */
export async function confirmBoletoAction(groupId: string, porraId: string, draft: ColumnsDraft): Promise<ConfirmBoletoState> {
  if (!isRouteId(groupId) || !isRouteId(porraId) || !isColumnsDraft(draft)) {
    return { status: "error", message: "No hemos podido leer el boleto. Recarga la página e inténtalo de nuevo.", fields: {} };
  }
  try {
    await withSession(async () => saveFinalBoleto(await porrasGateway(), groupId, porraId, draft), { clearCookie: true });
  } catch (error) {
    if (error instanceof VoteValidationError) {
      return { status: "error", message: "Completa los 14 partidos y el pleno al 15 antes de confirmar.", fields: error.fields };
    }
    if (!(error instanceof ServiceError)) throw error;
    if (error.code === "invalid-porra") return { status: "error", message: "El boleto no se ha aceptado. Revisa las filas, las columnas y el pleno e inténtalo de nuevo.", fields: {} };
    return { status: "error", message: adminMessage(error), fields: {} };
  }
  revalidatePath(`/groups/${groupId}/porras/${porraId}`);
  revalidatePath(`/groups/${groupId}/porras/${porraId}/final`);
  revalidatePath(`/groups/${groupId}`);
  revalidatePath("/dashboard");
  return { status: "saved", message: "Boleto de la peña confirmado" };
}
