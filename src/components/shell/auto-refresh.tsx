"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createLiveRefresh } from "@/lib/live-refresh";

/** A form with `aria-busy="true"` (submission pending) pauses the refresh. */
const hasBusyForm = () => document.querySelector("form[aria-busy='true']") !== null;

/**
 * Re-renders the server data of the current page every 30 s while the tab is visible, and once when it
 * becomes visible again. Client state (e.g. unsaved picks) survives `router.refresh()`.
 */
export function AutoRefresh() {
  const router = useRouter();
  useEffect(() => {
    const live = createLiveRefresh({
      refresh: () => router.refresh(),
      isVisible: () => document.visibilityState === "visible",
      isBusy: hasBusyForm,
    });
    const onVisibility = () => live.onVisibilityChange();
    live.start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => { live.stop(); document.removeEventListener("visibilitychange", onVisibility); };
  }, [router]);
  return null;
}
