/** Backend avatar rules (POST /users/me/avatar): PNG/JPEG/WebP, at most 5 MB, magic bytes must match. */
export const AVATAR_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export type AvatarType = (typeof AVATAR_TYPES)[number];
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
export const AVATAR_ACCEPT = AVATAR_TYPES.join(",");

export type AvatarFile = { name: string; contentType: AvatarType; bytes: ArrayBuffer };

export interface ProfileGateway {
  /** Uploads or replaces the caller's avatar and returns its public URL. */
  uploadAvatar(file: AvatarFile): Promise<string>;
  removeAvatar(): Promise<void>;
}

export type AvatarState = { status: "idle" | "saved" | "error"; message: string };
export const initialAvatarState: AvatarState = { status: "idle", message: "" };

export const isAvatarType = (value: string): value is AvatarType => (AVATAR_TYPES as readonly string[]).includes(value);

export type AvatarProblem = "invalid-image" | "file-too-large";
export const avatarProblemMessages: Record<AvatarProblem, string> = {
  "invalid-image": "Usa una imagen PNG, JPEG o WebP.",
  "file-too-large": "Esa imagen es demasiado grande. El tamaño máximo es de 5 MB.",
};

/** Same quick checks in the browser form and on the server, so both agree on what is acceptable. */
export function checkAvatar(file: { type: string; size: number }): AvatarProblem | null {
  if (!isAvatarType(file.type) || file.size === 0) return "invalid-image";
  return file.size > AVATAR_MAX_BYTES ? "file-too-large" : null;
}

/** First bytes of the content must match the declared type (the backend rejects mismatches with 400). */
export function matchesMagicBytes(bytes: ArrayBuffer, type: AvatarType): boolean {
  const head = new Uint8Array(bytes.slice(0, 12));
  const starts = (...values: number[]) => values.every((value, index) => head[index] === value);
  if (type === "image/png") return starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
  if (type === "image/jpeg") return starts(0xff, 0xd8, 0xff);
  return starts(0x52, 0x49, 0x46, 0x46) && head[8] === 0x57 && head[9] === 0x45 && head[10] === 0x42 && head[11] === 0x50;
}
