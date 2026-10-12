import type { ReactNode } from "react";

import { Curtain } from "@/components/motion/curtain";
import { RouteScene } from "@/components/scene/route-scene";
import { cn } from "@/lib/cn";

import { AppHeader } from "./app-header";
import { BottomNav } from "./bottom-nav";

type AppShellProps = {
  /** `app` adds the back link and the bottom navigation; `public` is the minimal header only. */
  variant?: "app" | "public";
  /** Forwarded to the header avatar (app variant). */
  user?: { displayName: string; avatarUrl: string | null };
  /** Sticky strip rendered right under the header (app variant). Must be a direct, DOM-wrapper-free child to stay sticky. */
  ticker?: ReactNode;
  children: ReactNode;
};

/** Header + main landmark + bottom nav. `isolate` keeps the scene layer (z -10) above the page background. The app variant picks its fondo from the route (RouteScene); public shells pass a scene explicitly. */
export function AppShell({ variant = "app", user, ticker, children }: AppShellProps) {
  return (
    <div className="relative isolate flex min-h-dvh flex-col">
      {variant === "app" && <RouteScene />}
      <AppHeader variant={variant} user={user} />
      {variant === "app" && ticker}
      <main id="main-content" className={cn("flex-1", variant === "app" && "pb-[calc(6rem+env(safe-area-inset-bottom))]")}>
        {children}
      </main>
      {variant === "app" && <BottomNav />}
      {variant === "app" && <Curtain />}
    </div>
  );
}
