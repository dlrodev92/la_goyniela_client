import type { ReactNode } from "react";

import { Sticker } from "@/components/ui/sticker";
import type { StickerTrim } from "@/components/ui/sticker";
import type { StaticImageData } from "next/image";

type AuthPageProps = {
  title: string;
  description: string;
  /** Pixel-art sticker pasted on the top-right corner of the panel. */
  sticker?: { src: StaticImageData; trim?: StickerTrim; tilt?: number };
  children: ReactNode;
};

/** Compact hero (giant headline + one line of copy) on one cream panel over the scene, shared by login and register. */
export function AuthPage({ title, description, sticker, children }: AuthPageProps) {
  return (
    <div className="mx-auto w-full max-w-105 px-4 pt-10 pb-8 md:pt-14">
      <div data-sheet="" className="brut-panel relative grid gap-5 p-5 *:min-w-0">
        {sticker && <Sticker src={sticker.src} trim={sticker.trim} tilt={sticker.tilt} width={84} className="absolute -right-3 -top-12" />}
        <header data-sheet-header="" className="grid gap-2 border-b-(length:--bw-thick) border-border-soft pb-4">
          <p className="label-meta flex items-center gap-2">
            <span aria-hidden="true" className="inline-block h-2.5 w-6 border-2 border-border-soft bg-signal" />
            La Goyniela
          </p>
          <h1 className="pr-16 font-display text-[clamp(2.5rem,12vw,3.5rem)] uppercase leading-[0.92] text-fg">{title}</h1>
          <p className="text-body text-fg-muted">{description}</p>
        </header>
        {children}
      </div>
    </div>
  );
}

/** "Other path" line under the providers, e.g. "¿Ya tienes cuenta? Iniciar sesión". */
export function AuthSwitch({ children }: { children: ReactNode }) {
  return <p className="border-t-(length:--bw) border-border-soft pt-4 text-center text-label text-fg-muted">{children}</p>;
}

export const authLinkClasses =
  "fx-link inline-flex min-h-touch items-center px-1 font-bold text-action hover-fine:text-highlight";
