"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  changeMember, createGroup, deleteGroup, FieldValidationError, joinGroup, leaveGroup, setShowPicks, type FormState, type SettingsState,
} from "../application/groups";
import { isMemberAction } from "../domain/groups";
import { groupsGateway } from "./gateway";
import { withSession } from "../../shared/server/authenticated-api";
import { safeMessage, ServiceError } from "../../../lib/http/errors";

function failure(error: unknown, values: Record<string, string>): FormState {
  if (error instanceof FieldValidationError) return { error: "", fields: error.fields, values };
  // Framework control-flow errors (redirect, notFound) and bugs must not become form messages.
  if (!(error instanceof ServiceError)) throw error;
  return { error: safeMessage(error), fields: {}, values };
}
const text = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};

export async function createGroupAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const values = { name: text(formData, "name"), description: text(formData, "description") };
  let groupId: string;
  try {
    const group = await withSession(async () => createGroup(await groupsGateway(), values), { clearCookie: true });
    groupId = group.id;
  } catch (error) { return failure(error, values); }
  revalidatePath("/groups");
  revalidatePath("/dashboard");
  redirect(`/groups/${groupId}`);
}

export async function joinGroupAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const values = { joinCode: text(formData, "joinCode") };
  let groupId: string;
  try {
    const group = await withSession(async () => joinGroup(await groupsGateway(), values), { clearCookie: true });
    groupId = group.id;
  } catch (error) { return failure(error, values); }
  revalidatePath("/groups");
  revalidatePath("/dashboard");
  redirect(`/groups/${groupId}`);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- signature required by useActionState
export async function leaveGroupAction(groupId: string, _previous: FormState): Promise<FormState> {
  try {
    await withSession(async () => leaveGroup(await groupsGateway(), groupId), { clearCookie: true });
  } catch (error) {
    // The group is already gone for this user (e.g. left in another tab): show the list.
    if (!(error instanceof ServiceError && error.code === "not-found")) return failure(error, {});
  }
  revalidatePath("/groups");
  revalidatePath("/dashboard");
  revalidatePath(`/groups/${groupId}`);
  redirect("/groups");
}

const revalidateGroup = (groupId: string) => {
  revalidatePath(`/groups/${groupId}`);
  revalidatePath("/groups");
  revalidatePath("/dashboard");
  // Visibility of picks changes what every matchday page of this group renders.
  revalidatePath("/groups/[groupId]/porras/[porraId]", "page");
};

export async function setShowPicksAction(groupId: string, _previous: SettingsState, formData: FormData): Promise<SettingsState> {
  const showPicks = text(formData, "showPicks") === "true";
  try {
    await withSession(async () => setShowPicks(await groupsGateway(), groupId, showPicks), { clearCookie: true });
  } catch (error) {
    if (!(error instanceof ServiceError)) throw error;
    return { status: "error", message: safeMessage(error) };
  }
  revalidateGroup(groupId);
  return { status: "saved", message: showPicks ? "Los miembros ya pueden ver los pronósticos de los demás." : "Los pronósticos quedan ocultos para el resto de miembros." };
}

export async function memberAdminAction(groupId: string, userId: string, _previous: FormState, formData: FormData): Promise<FormState> {
  const action = text(formData, "intent");
  if (!isMemberAction(action)) return { error: "Esa acción no está disponible.", fields: {}, values: {} };
  try {
    await withSession(async () => changeMember(await groupsGateway(), { groupId, userId, action }), { clearCookie: true });
  } catch (error) {
    // Stale page (member already changed or removed elsewhere): refresh what the admin sees.
    if (error instanceof ServiceError) revalidateGroup(groupId);
    return failure(error, {});
  }
  revalidateGroup(groupId);
  return { error: "", fields: {}, values: {} };
}

export async function deleteGroupAction(groupId: string, _previous: FormState, formData: FormData): Promise<FormState> {
  const values = { confirmName: text(formData, "confirmName") };
  try {
    await withSession(async () => deleteGroup(await groupsGateway(), { groupId, confirmName: values.confirmName }), { clearCookie: true });
  } catch (error) {
    // Already deleted elsewhere: the goal is reached, show the list.
    if (!(error instanceof ServiceError && error.code === "not-found")) return failure(error, values);
  }
  revalidatePath("/groups");
  revalidatePath("/dashboard");
  redirect("/groups");
}
