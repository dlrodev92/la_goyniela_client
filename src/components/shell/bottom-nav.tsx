"use client";

import { CalendarDots } from "@phosphor-icons/react/dist/ssr/CalendarDots";
import { ClipboardText } from "@phosphor-icons/react/dist/ssr/ClipboardText";
import { House } from "@phosphor-icons/react/dist/ssr/House";
import { UserCircle } from "@phosphor-icons/react/dist/ssr/UserCircle";
import { UsersThree } from "@phosphor-icons/react/dist/ssr/UsersThree";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/cn";

import { AppLink } from "./app-link";

const items = [
  { href: "/dashboard", label: "Inicio", Icon: House },
  { href: "/groups", label: "Grupos", Icon: UsersThree },
  { href: "/quiniela", label: "Quiniela", Icon: ClipboardText },
  { href: "/jornadas", label: "Jornadas", Icon: CalendarDots },
  { href: "/profile", label: "Perfil", Icon: UserCircle },
] as const;

/** Porra pages live under /groups but belong to the "Quiniela" tab, so "Grupos" must not light up there. */
const PORRA_PATH = /^\/groups\/[^/]+\/porras(\/|$)/;

function isActive(href: string, pathname: string): boolean {
  const onPorra = PORRA_PATH.test(pathname);
  if (href === "/quiniela") return onPorra || pathname === href || pathname.startsWith(`${href}/`);
  if (href === "/groups" && onPorra) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function BottomNav() {
  const pathname = usePathname();
  const activeIndex = items.findIndex(({ href }) => isActive(href, pathname));
  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-30 [view-transition-name:app-nav] border-t-(length:--shell-edge) border-(--shell-edge-color) bg-(--shell-bg) pb-[env(safe-area-inset-bottom)] [backdrop-filter:var(--shell-blur)]"
    >
      <ul className="relative mx-auto grid max-w-160 grid-cols-5 gap-1 px-2 py-2 lg:px-0">
        {/* Sliding indicator: one pill behind the labels; 5 equal columns with a 0.25rem gap, so a step is 100% + gap. */}
        <li
          aria-hidden="true"
          data-visible={activeIndex >= 0}
          className="nav-pill pointer-events-none absolute inset-y-2 left-2 w-[calc((100%-2rem)/5)] rounded-pill border-(length:--bw) border-edge bg-action lg:left-0 lg:w-[calc((100%-1rem)/5)]"
          style={{ transform: `translateX(calc(${Math.max(activeIndex, 0)} * (100% + 0.25rem)))` }}
        />
        {items.map(({ href, label, Icon }) => {
          const active = isActive(href, pathname);
          return (
            <li key={href}>
              <AppLink
                href={href}
                aria-current={active ? "page" : undefined}
                transitionTypes={["nav-tab"]}
                className={cn(
                  "tap relative flex min-h-14 min-w-touch flex-col items-center justify-center gap-0.5 rounded-pill px-0.5 text-meta font-bold uppercase tracking-tight no-underline",
                  active ? "text-on-action" : "text-fg hover-fine:bg-action/10",
                )}
              >
                <Icon size={24} weight={active ? "fill" : "regular"} aria-hidden="true" />
                <span>{label}</span>
              </AppLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
