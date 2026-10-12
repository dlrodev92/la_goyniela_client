export const LOGO_MAX_BYTES = 5 * 1024 * 1024;
const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"];

/** Pre-flight for the team logo upload (the backend allows up to 5 MB). Returns a Spanish problem text, or null when fine. */
export function checkLogoFile(file: { type: string; size: number }): string | null {
  if (!LOGO_TYPES.includes(file.type)) return "Usa una imagen PNG, JPEG o WebP.";
  if (file.size > LOGO_MAX_BYTES) return "La imagen supera los 5 MB.";
  return null;
}
