"use client";

import { CaretLeft } from "@phosphor-icons/react/dist/ssr/CaretLeft";
import { AppLink } from "./app-link";
import { usePathname } from "next/navigation";

/** Parent route for nested screens, or null on top-level routes. */
export function backHrefFor(pathname: string): string | null {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] === "groups" && parts.length === 2) return "/groups";
  if (parts[0] === "groups" && parts[2] === "porras" && parts.length === 4) return `/groups/${parts[1]}`;
  if (parts[0] === "groups" && parts[2] === "porras" && parts.length === 5) return `/groups/${parts[1]}/porras/${parts[3]}`;
  if (parts[0] === "jornadas" && parts.length === 2) return "/jornadas";
  return null;
}

export function BackLink() {
  const href = backHrefFor(usePathname());
  if (!href) return null;
  return (
    <AppLink
      href={href}
      aria-label="Volver"
      transitionTypes={["nav-back"]}
      className="fx-icon inline-flex size-touch items-center justify-center rounded-pill text-fg"
    >
      <CaretLeft size={24} weight="bold" aria-hidden="true" />
    </AppLink>
  );
}
