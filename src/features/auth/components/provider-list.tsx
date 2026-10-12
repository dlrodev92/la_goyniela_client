"use client";

import { useEffect, useState, type MouseEvent } from "react";
import { ProviderButton } from "@/components/ui/provider-button";
import type { OAuthProviderId } from "../domain/oauth";

/**
 * Plain links that redirect off-site. The client layer only adds a pending spinner on click
 * (event delegation), so navigation still works without JS.
 */
export function ProviderList({ providers }: { providers: { id: OAuthProviderId; enabled: boolean }[] }) {
  const [pending, setPending] = useState<OAuthProviderId | null>(null);

  // Coming back through the browser history restores the page from bfcache with the spinner still on.
  useEffect(() => {
    const reset = () => setPending(null);
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);

  const onClick = (event: MouseEvent<HTMLUListElement>) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
    const anchor = (event.target as HTMLElement).closest("a");
    const match = anchor?.getAttribute("href")?.match(/^\/auth\/(google|x)$/);
    if (match) setPending(match[1] as OAuthProviderId);
  };

  return (
    <ul className="m-0 grid list-none gap-3 p-0" onClick={onClick}>
      {providers.map(({ id, enabled }) => (
        <li key={id}>
          <ProviderButton provider={id} href={`/auth/${id}`} disabled={!enabled} loading={pending === id}
            helperText={enabled ? undefined : "No disponible por ahora"} />
        </li>
      ))}
    </ul>
  );
}
