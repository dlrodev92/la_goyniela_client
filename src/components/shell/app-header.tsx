import Image from "next/image";

import logo from "../../../public/logo.png";
import { Avatar } from "@/components/ui/avatar";
import { AppLink } from "./app-link";
import { BackLink } from "./back-link";

type AppHeaderProps = {
  /** `public` is the minimal variant (login, register, system pages): no back link. */
  variant?: "app" | "public";
  /** Signed-in user (app variant only): shown as a small avatar linking to the profile. */
  user?: { displayName: string; avatarUrl: string | null };
};

export function AppHeader({ variant = "app", user }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-20 [view-transition-name:app-header] border-b-(length:--shell-edge) border-(--shell-edge-color) bg-(--shell-bg) pt-[env(safe-area-inset-top)] [backdrop-filter:var(--shell-blur)]">
      <div className="mx-auto grid h-16 w-full max-w-160 grid-cols-[2.75rem_1fr_2.75rem] items-center px-2 lg:px-0">
        <div>{variant === "app" && <BackLink />}</div>
        <AppLink
          href="/"
          indicator={false}
          className="tap inline-flex items-center justify-center gap-3 justify-self-center rounded-pill text-fg no-underline [--press-scale:0.97]"
        >
          <Image src={logo} alt="La Goyniela" width={48} height={48} priority className="size-12 [image-rendering:pixelated]" />
          <span className="font-display text-h2 uppercase leading-none tracking-wide">La Goyniela</span>
        </AppLink>
        {variant === "app" && user ? (
          <AppLink
            href="/profile"
            aria-label="Tu perfil"
            transitionTypes={["nav-tab"]}
            className="fx-icon inline-flex size-11 items-center justify-center justify-self-end rounded-pill"
          >
            <Avatar name={user.displayName} alt="" src={user.avatarUrl} size="sm" className="m-0" />
          </AppLink>
        ) : (
          <div aria-hidden="true" />
        )}
      </div>
    </header>
  );
}
