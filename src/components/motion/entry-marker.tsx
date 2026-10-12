"use client";

import { useLayoutEffect, useRef } from "react";

/**
 * Tags the page root with how the page arrived: `cold` (first load, refresh, no view-transition support), `tab`
 * (bottom-nav switch), `curtain` (forward/back navigation behind the brand curtain) or `vt` (any other view-transitioned navigation). CSS uses it so list staggers and block
 * entrances only play when no view transition already animates the whole page (see globals.css, "Page entry").
 * Render it as a direct child of the page root element.
 */
export function EntryMarker() {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const host = ref.current?.parentElement;
    if (!host) return;
    let entry = "cold";
    try {
      const root = document.documentElement;
      if (root.matches(":active-view-transition")) entry = root.matches(":active-view-transition-type(nav-tab)") ? "tab" : root.matches(":active-view-transition-type(nav-forward, nav-back)") ? "curtain" : "vt";
    } catch {
      /* :active-view-transition is not supported: the page arrives cold */
    }
    host.dataset.entry = entry;
  }, []);
  return <span ref={ref} hidden />;
}
