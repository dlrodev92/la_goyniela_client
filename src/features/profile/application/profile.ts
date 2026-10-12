import { checkAvatar, isAvatarType, matchesMagicBytes, type ProfileGateway } from "../domain/profile";
import { ServiceError } from "../../../lib/http/errors";

type UploadedFile = { name: string; type: string; size: number; arrayBuffer(): Promise<ArrayBuffer> };

/** Validates the file (type, size, magic bytes) before it leaves the server; returns the new avatar URL. */
export async function uploadAvatar(gateway: ProfileGateway, file: UploadedFile): Promise<string> {
  const problem = checkAvatar(file);
  if (problem || !isAvatarType(file.type)) throw new ServiceError(problem ?? "invalid-image");
  const bytes = await file.arrayBuffer();
  // `size` is client-declared metadata: re-check the real length and the leading bytes.
  const actual = checkAvatar({ type: file.type, size: bytes.byteLength });
  if (actual) throw new ServiceError(actual);
  if (!matchesMagicBytes(bytes, file.type)) throw new ServiceError("invalid-image");
  return gateway.uploadAvatar({ name: `avatar.${file.type === "image/jpeg" ? "jpg" : file.type.slice(6)}`, contentType: file.type, bytes });
}

export async function removeAvatar(gateway: ProfileGateway): Promise<void> {
  return gateway.removeAvatar();
}
