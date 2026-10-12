import type { StaticImageData } from "next/image";

import accessScene from "../../../public/fondo_de_acceso.png";
import celebrationScene from "../../../public/fondo_celebracion.png";
import dashboardScene from "../../../public/fondo_dashboard.png";
import groupScene from "../../../public/fondo_interior_grupo.png";
import matchdayScene from "../../../public/fondo_imagen_jornada.png";

export type SceneKey = "access" | "dashboard" | "group" | "matchday" | "celebration";

export type SceneDefinition = {
  readonly image: StaticImageData;
  /** Decorative background art: always an empty alt. */
  readonly alt: "";
  /** `object-position` for portrait viewports, where the art (right / bottom-right) must stay visible. */
  readonly mobileObjectPosition: string;
  /** `object-position` for landscape viewports. */
  readonly desktopObjectPosition: string;
};

/**
 * Which fondo each route family declares. Pure on purpose (unit-testable); the signed-in shell applies it through
 * <RouteScene />, public and system pages pass their scene to PublicShell (access art).
 *  - dashboard, profile (and any route not listed)  -> dashboard
 *  - groups list / detail / join / new, porras       -> group
 *  - jornadas, quiniela                              -> matchday
 *  - porra final (the shared boleto, results)        -> celebration
 *  - superadmin                                      -> none (it keeps its own legacy look)
 */
export function sceneForPathname(pathname: string): SceneKey | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/superadmin" || path.startsWith("/superadmin/")) return null;
  if (/^\/groups\/[^/]+\/porras\/[^/]+\/final$/.test(path)) return "celebration";
  if (path === "/groups" || path.startsWith("/groups/")) return "group";
  if (path === "/jornadas" || path.startsWith("/jornadas/") || path === "/quiniela" || path.startsWith("/quiniela/")) return "matchday";
  return "dashboard";
}

/** Recommended `sizes` for a full-bleed scene: full viewport width, capped at the 1672px source. */
export const SCENE_SIZES = "(min-width: 1672px) 1672px, 100vw";

export const scenes: Readonly<Record<SceneKey, SceneDefinition>> = {
  access: { image: accessScene, alt: "", mobileObjectPosition: "78% 60%", desktopObjectPosition: "right center" },
  dashboard: { image: dashboardScene, alt: "", mobileObjectPosition: "80% 55%", desktopObjectPosition: "right center" },
  group: { image: groupScene, alt: "", mobileObjectPosition: "82% 60%", desktopObjectPosition: "right center" },
  matchday: { image: matchdayScene, alt: "", mobileObjectPosition: "85% 55%", desktopObjectPosition: "right center" },
  celebration: { image: celebrationScene, alt: "", mobileObjectPosition: "80% 70%", desktopObjectPosition: "right center" },
};
