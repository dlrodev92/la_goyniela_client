"use server";

import { revalidatePath } from "next/cache";
import { removeAvatar, uploadAvatar } from "../application/profile";
import type { AvatarState } from "../domain/profile";
import { profileGateway } from "./gateway";
import { withSession } from "../../shared/server/authenticated-api";
import { safeMessage, ServiceError } from "../../../lib/http/errors";

export async function uploadAvatarAction(_previous: AvatarState, formData: FormData): Promise<AvatarState> {
  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) return { status: "error", message: "Elige primero una imagen." };
  try {
    await withSession(async () => uploadAvatar(await profileGateway(), file), { clearCookie: true });
  } catch (error) {
    // Framework control-flow errors (redirect) and bugs must not become form messages.
    if (!(error instanceof ServiceError)) throw error;
    return { status: "error", message: safeMessage(error) };
  }
  revalidatePath("/profile");
  revalidatePath("/", "layout"); // the header avatar lives in the shell
  return { status: "saved", message: "Tu foto se ha actualizado." };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- signature required by useActionState
export async function removeAvatarAction(_previous: AvatarState): Promise<AvatarState> {
  try {
    await withSession(async () => removeAvatar(await profileGateway()), { clearCookie: true });
  } catch (error) {
    if (!(error instanceof ServiceError)) throw error;
    return { status: "error", message: safeMessage(error) };
  }
  revalidatePath("/profile");
  revalidatePath("/", "layout"); // the header avatar lives in the shell
  return { status: "saved", message: "Tu foto se ha quitado." };
}
