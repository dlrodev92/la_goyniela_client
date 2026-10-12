import { z } from "zod";
import type { GroupsGateway, MemberAction } from "../domain/groups";
import {
  GROUP_DESCRIPTION_MAX, GROUP_NAME_MAX, GROUP_NAME_MIN, JOIN_CODE_MAX, JOIN_CODE_MIN, matchesGroupName,
} from "../domain/groups";
import { ServiceError } from "../../../lib/http/errors";
import { isRouteId } from "../../../lib/route-id";

export type FieldErrors = Record<string, string>;
export type FormState = { error: string; fields: FieldErrors; values: Record<string, string> };
export const initialFormState: FormState = { error: "", fields: {}, values: {} };

export type SettingsState = { status: "idle" | "saved" | "error"; message: string };
export const initialSettingsState: SettingsState = { status: "idle", message: "" };

/** Thrown for invalid form input; carries per-field messages safe to show. */
export class FieldValidationError extends Error {
  readonly fields: FieldErrors;
  constructor(fields: FieldErrors) {
    super("Invalid input");
    this.name = "FieldValidationError";
    this.fields = fields;
  }
}

const createSchema = z.object({
  name: z.string().trim()
    .min(GROUP_NAME_MIN, `Usa al menos ${GROUP_NAME_MIN} caracteres.`)
    .max(GROUP_NAME_MAX, `Usa como máximo ${GROUP_NAME_MAX} caracteres.`),
  description: z.string().trim()
    .max(GROUP_DESCRIPTION_MAX, `Usa como máximo ${GROUP_DESCRIPTION_MAX} caracteres.`).optional(),
});

/** Join codes are case-insensitive on the backend; send them trimmed and uppercase. */
export function normalizeJoinCode(value: unknown): string {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

function fieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

export async function listGroups(gateway: GroupsGateway) {
  return gateway.list();
}

export async function createGroup(gateway: GroupsGateway, input: { name: unknown; description: unknown }) {
  const parsed = createSchema.safeParse({
    name: typeof input.name === "string" ? input.name : "",
    description: typeof input.description === "string" ? input.description : undefined,
  });
  if (!parsed.success) throw new FieldValidationError(fieldErrors(parsed.error));
  const { name, description } = parsed.data;
  return gateway.create(description ? { name, description } : { name });
}

export async function joinGroup(gateway: GroupsGateway, input: { joinCode: unknown }) {
  const joinCode = normalizeJoinCode(input.joinCode);
  if (joinCode.length < JOIN_CODE_MIN || joinCode.length > JOIN_CODE_MAX) {
    throw new FieldValidationError({ joinCode: `Escribe el código de ${JOIN_CODE_MIN} a ${JOIN_CODE_MAX} caracteres de tu invitación.` });
  }
  return gateway.join(joinCode);
}

export async function getGroup(gateway: GroupsGateway, groupId: string) {
  if (!isRouteId(groupId)) throw new ServiceError("not-found");
  return gateway.get(groupId);
}

export async function leaveGroup(gateway: GroupsGateway, groupId: string) {
  if (!isRouteId(groupId)) throw new ServiceError("not-found");
  return gateway.leave(groupId);
}

export async function setShowPicks(gateway: GroupsGateway, groupId: string, showPicks: boolean) {
  if (!isRouteId(groupId)) throw new ServiceError("not-found");
  return gateway.setShowPicks(groupId, showPicks);
}

export async function changeMember(gateway: GroupsGateway, input: { groupId: string; userId: string; action: MemberAction }) {
  if (!isRouteId(input.groupId) || !isRouteId(input.userId)) throw new ServiceError("not-found");
  if (input.action === "promote") return gateway.promoteMember(input.groupId, input.userId);
  if (input.action === "demote") return gateway.demoteMember(input.groupId, input.userId);
  return gateway.removeMember(input.groupId, input.userId);
}

/** The typed name is checked here (against the stored name) before the irreversible call. */
export async function deleteGroup(gateway: GroupsGateway, input: { groupId: string; confirmName: unknown }) {
  if (!isRouteId(input.groupId)) throw new ServiceError("not-found");
  const group = await gateway.get(input.groupId);
  if (!matchesGroupName(input.confirmName, group.name)) {
    throw new FieldValidationError({ confirmName: "Escribe el nombre de la peña exactamente como aparece para confirmar." });
  }
  return gateway.delete(input.groupId);
}
