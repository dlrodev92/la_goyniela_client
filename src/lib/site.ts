/** Public identity of the app, shared by metadata, the manifest, robots and the sitemap. */
export const SITE_NAME = "La Goyniela";
export const SITE_DESCRIPTION = "La quiniela de tu peña: cada uno vota su 1X2 y el pleno al 15, y el grupo forma una quiniela común.";

const FALLBACK_URL = "https://lagoyniela.pro";

/** Absolute origin used for canonical URLs and social cards: APP_URL when it is a valid http(s) origin, else the production domain. */
export function siteUrl(env: Record<string, string | undefined> = process.env): string {
  try {
    const url = new URL(env.APP_URL ?? "");
    return ["http:", "https:"].includes(url.protocol) ? url.origin : FALLBACK_URL;
  } catch {
    return FALLBACK_URL;
  }
}
