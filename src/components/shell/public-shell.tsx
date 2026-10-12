import type { ReactNode } from "react";

import { SceneBackground } from "@/components/scene/scene-background";
import type { SceneKey } from "@/components/scene/scenes";

import { AppShell } from "./app-shell";

type PublicShellProps = {
  scene?: SceneKey;
  priority?: boolean;
  children: ReactNode;
};

/** Minimal shell for logged-out and system pages: slim header, optional scene, no bottom nav. */
export function PublicShell({ scene, priority, children }: PublicShellProps) {
  return (
    <AppShell variant="public">
      {scene && <SceneBackground scene={scene} priority={priority} />}
      {children}
    </AppShell>
  );
}
