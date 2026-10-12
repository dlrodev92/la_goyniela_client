import { ViewTransition, type ReactNode } from "react";

/**
 * Transition types (set by `<Link transitionTypes>`) -> view-transition classes defined in globals.css.
 *  nav-forward / nav-back: the brand curtain (see Curtain). The old page holds until the band covers the screen, then
 *                          the new page shows and the band clears. Direction (up / down) is read from the type in CSS.
 *  nav-tab:                bottom-nav switch, quick crossfade, no curtain
 * Untyped navigations (browser back, plain links) and Suspense reveals get the soft fade + rise.
 */
const enter = { "nav-forward": "curtain-in", "nav-back": "curtain-in", "nav-tab": "tab-in", default: "reveal" } as const;
const exit = { "nav-forward": "curtain-out", "nav-back": "curtain-out", "nav-tab": "tab-out", default: "reveal-out" } as const;

/**
 * Wraps one page root (single host element child). Use it in pages and loading files, never in layouts:
 * layouts persist across navigations, so enter and exit would never fire there.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition enter={enter} exit={exit} default="none">
      {children}
    </ViewTransition>
  );
}
