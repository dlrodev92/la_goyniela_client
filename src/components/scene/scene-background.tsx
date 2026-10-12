import type { CSSProperties } from "react";
import Image from "next/image";

import { SCENE_SIZES, scenes, type SceneKey } from "./scenes";

type SceneBackgroundProps = {
  scene: SceneKey;
  /** Preload the art. Only the auth scene is the LCP candidate; leave it off elsewhere. */
  priority?: boolean;
  /** Flat dark wash over the art, for a scene whose header or panel edge needs more separation. Off by default. */
  scrim?: boolean;
};

/**
 * Full-bleed pixel-art fondo behind the whole viewport (static, no client JS): fixed, `cover`, anchored right so the
 * illustrated side stays visible on phones, `image-rendering: pixelated`. Content sits on opaque cream panels above it.
 * The host must be a stacking context (`isolate`) so the negative z-index stays above the page background.
 */
export function SceneBackground({ scene, priority = false, scrim = false }: SceneBackgroundProps) {
  const { image, alt, mobileObjectPosition, desktopObjectPosition } = scenes[scene];
  return (
    <div
      aria-hidden="true"
      data-scene={scene}
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-canvas"
      style={{ "--scene-pos-m": mobileObjectPosition, "--scene-pos-d": desktopObjectPosition } as CSSProperties}
    >
      <Image src={image} alt={alt} fill sizes={SCENE_SIZES} preload={priority} className="scene-image object-cover" />
      {scrim && <div className="scene-scrim absolute inset-0" />}
    </div>
  );
}
