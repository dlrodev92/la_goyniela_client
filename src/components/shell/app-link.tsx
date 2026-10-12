"use client";

import Link, { useLinkStatus } from "next/link";
import { useState, type ComponentProps } from "react";

/** Subtle wash over the pressed link while its navigation is pending (hidden for the first 400 ms, no layout shift). */
function PendingWash() {
  const { pending } = useLinkStatus();
  return <span aria-hidden="true" data-pending={pending} className="link-pending" />;
}

type AppLinkProps = ComponentProps<typeof Link> & {
  /** Show the pending wash. Turn off for inline text links. Default true. */
  indicator?: boolean;
};

/**
 * The app's navigation link. Two things on top of next/link:
 *  - Prefetch on intent. Detail and tab routes are dynamic and have no loading.tsx (the old page stays until the new
 *    one is ready), so Next would not prefetch them at all. Hover, touch and focus start a full prefetch instead,
 *    so most clicks resolve from the client cache.
 *  - Instant pending feedback on the pressed link while a click still waits for the server.
 */
export function AppLink({ children, prefetch, indicator = true, onPointerEnter, onTouchStart, onFocus, ...rest }: AppLinkProps) {
  const [intent, setIntent] = useState(false);
  return (
    <Link
      {...rest}
      prefetch={prefetch ?? (intent ? true : false)}
      onPointerEnter={(event) => { setIntent(true); onPointerEnter?.(event); }}
      onTouchStart={(event) => { setIntent(true); onTouchStart?.(event); }}
      onFocus={(event) => { setIntent(true); onFocus?.(event); }}
    >
      {children}
      {indicator && <PendingWash />}
    </Link>
  );
}
