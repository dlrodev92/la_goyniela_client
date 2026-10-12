"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

/** Gives up after this long so a navigation that never lands (offline, same-page click) cannot leave the bar running. */
const GIVE_UP_MS = 15_000;

function Bar() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const here = `${pathname}?${search}`;
  // The location the pending navigation started from; the bar runs while the app is still there.
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const pending = startedAt === here;

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      // Next's Link prevents the default of a client navigation, so a prevented click on an internal anchor is one.
      if (!event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target === "_blank" || anchor.origin !== window.location.origin) return;
      if (`${anchor.pathname}?${anchor.search.slice(1)}` === `${window.location.pathname}?${window.location.search.slice(1)}`) return;
      setStartedAt(`${window.location.pathname}?${window.location.search.slice(1)}`);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  // Arrived somewhere else: forget the old origin, or coming back to it later would start the bar again.
  useEffect(() => {
    if (startedAt === null || startedAt === here) return;
    const frame = requestAnimationFrame(() => setStartedAt(null));
    return () => cancelAnimationFrame(frame);
  }, [startedAt, here]);

  useEffect(() => {
    if (!pending) return;
    const timer = window.setTimeout(() => setStartedAt(null), GIVE_UP_MS);
    return () => window.clearTimeout(timer);
  }, [pending]);

  return <div aria-hidden="true" data-active={pending} className="nav-progress" />;
}

/**
 * Thin bar along the top edge for navigations that take longer than ~400 ms. It is purely visual (aria-hidden):
 * pending state for assistive tech lives on the pressed link and the page itself.
 */
export function NavProgress() {
  return (
    <Suspense fallback={null}>
      <Bar />
    </Suspense>
  );
}
