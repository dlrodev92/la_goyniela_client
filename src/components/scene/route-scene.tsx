"use client";

import { usePathname } from "next/navigation";

import { SceneBackground } from "./scene-background";
import { sceneForPathname } from "./scenes";

/**
 * The signed-in shell's fondo: picks the scene from the current route (see `sceneForPathname`), so every page declares
 * its art in one place and the layer persists across navigations instead of remounting per page.
 * Renders nothing for routes without a scene (superadmin).
 */
export function RouteScene() {
  const scene = sceneForPathname(usePathname());
  return scene ? <SceneBackground scene={scene} /> : null;
}
