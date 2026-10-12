"use client";

import { CaretDown } from "@phosphor-icons/react/dist/ssr/CaretDown";
import { X } from "@phosphor-icons/react/dist/ssr/X";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { duration, prefersReducedMotion } from "@/lib/motion";

const DESKTOP_QUERY = "(min-width: 64rem)";
const subscribe = (notify: () => void) => {
  const media = window.matchMedia(DESKTOP_QUERY);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
};
const useIsDesktop = () => useSyncExternalStore(subscribe, () => window.matchMedia(DESKTOP_QUERY).matches, () => false);

/** `data-boleto-sheet` on <html> lets the porra page react (CSS only): shift on desktop, hide its bar while peeking. */
function useSheetMarker(mode: "sheet" | "peek" | "panel" | "closing") {
  useEffect(() => {
    document.documentElement.dataset.boletoSheet = mode;
    return () => { delete document.documentElement.dataset.boletoSheet; };
  }, [mode]);
}

type Props = {
  title: string;
  /** "n/14 · pleno ✓" shown in the minimized bar. */
  progress: string;
  children: ReactNode;
};

/**
 * Chrome of the boleto when it opens over the porra page (intercepted route).
 * - Mobile (< 1024px): native modal <dialog> bottom sheet; "Minimizar" closes the dialog (without leaving the route)
 *   and shows a peek bar, so the page beneath scrolls while the draft (state of the children) is kept.
 * - Desktop: non-modal <dialog> docked on the right; the page content shifts left.
 * Closing (X, Escape) is `router.back()`, which pops the intercepted route.
 */
export function BoletoFrame({ title, progress, children }: Props) {
  const router = useRouter();
  const desktop = useIsDesktop();
  const [minimized, setMinimized] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const peek = minimized && !desktop;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const programmaticClose = useRef(false);
  const leavingRef = useRef(false);
  const openerRef = useRef<HTMLElement | null>(null);

  // Closing plays the exit first (the dialog closes through its CSS transition), then the intercepted route is popped.
  const close = useCallback(() => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    setLeaving(true);
    const dialog = dialogRef.current;
    if (dialog?.open) { programmaticClose.current = true; dialog.close(); }
    window.setTimeout(() => router.back(), prefersReducedMotion() ? duration.fast : duration.base);
  }, [router]);

  // Remember what opened the sheet; focus returns there when it unmounts.
  useEffect(() => {
    openerRef.current = document.activeElement instanceof HTMLElement && document.activeElement !== document.body
      ? document.activeElement
      : document.querySelector<HTMLElement>("[data-boleto-opener]");
    return () => {
      const target = openerRef.current?.isConnected ? openerRef.current : document.querySelector<HTMLElement>("[data-boleto-opener]");
      target?.focus();
    };
  }, []);

  // Keep the <dialog> in sync: modal on mobile, non-modal panel on desktop, closed while peeking.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (peek) return;
    if (desktop) { dialog.show(); dialog.focus(); } else dialog.showModal();
    return () => {
      if (dialog.open) { programmaticClose.current = true; dialog.close(); }
    };
  }, [peek, desktop]);

  useSheetMarker(leaving ? "closing" : peek ? "peek" : desktop ? "panel" : "sheet");

  // The page beneath must not scroll while the modal sheet is up; it does while peeking or beside the desktop panel.
  useEffect(() => {
    if (peek || desktop) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [peek, desktop]);

  // Escape closes (an open info drawer consumes it first by preventing default).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) { event.preventDefault(); close(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [close]);

  return (
    <>
      <dialog
        ref={dialogRef}
        aria-label={title}
        tabIndex={-1}
        onCancel={(event) => event.preventDefault()}
        onClose={() => {
          if (programmaticClose.current) { programmaticClose.current = false; return; }
          close();
        }}
        onClick={(event) => { if (event.target === dialogRef.current && !desktop) setMinimized(true); }}
        className={[
          "overlay-dialog overlay-dialog--panel",
          "fixed inset-x-0 bottom-0 top-auto z-40 m-0 h-[92dvh] max-h-[92dvh] w-full max-w-none flex-col overflow-hidden rounded-t-card open:flex",
          "border-(length:--bw-thick) border-border-soft bg-surface-1 p-0 text-fg shadow-(--elev-sheet)",
          "lg:inset-x-auto lg:bottom-[calc(4.75rem+env(safe-area-inset-bottom))] lg:right-0 lg:top-16 lg:h-auto lg:max-h-none lg:w-[30rem] lg:rounded-none lg:border-y-0 lg:border-r-0 lg:shadow-[-6px_0_0_var(--color-ink)]",
        ].join(" ")}
      >
        <div className="shrink-0 border-b-(length:--bw) border-border-soft bg-surface-2 lg:hidden">
          <button
            type="button"
            onClick={() => setMinimized(true)}
            aria-label="Minimizar el boleto para consultar la jornada"
            className="tap mx-auto flex min-h-touch w-full flex-col items-center justify-center gap-1 pt-2 text-fg-muted [--press-scale:0.99] hover-fine:text-fg focus-visible:-outline-offset-4"
          >
            <span aria-hidden="true" className="h-1.5 w-14 bg-border-soft" />
            <span className="flex items-center gap-1 text-meta font-bold uppercase tracking-wider">
              <CaretDown size={14} weight="bold" aria-hidden="true" />Minimizar
            </span>
          </button>
        </div>
        <div className="flex shrink-0 items-center justify-between gap-2 border-b-(length:--bw) border-border-soft px-4 py-1">
          <h2 className="min-w-0 break-words font-display text-h2 uppercase">{title}</h2>
          <button
            type="button"
            onClick={close}
            aria-label="Cerrar el boleto"
            className="fx-icon inline-flex size-touch shrink-0 items-center justify-center rounded-pill text-fg"
          >
            <X size={24} weight="bold" aria-hidden="true" />
          </button>
        </div>
        {/* Always mounted so the draft survives minimize/expand. */}
        {children}
      </dialog>

      {/* Always mounted so it can slide in and out; hidden (visibility) while the sheet is expanded. */}
      <div
        role="region"
        aria-label="Boleto minimizado"
        data-open={peek}
        className="drawer fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-40 border-t-(length:--bw-thick) border-border-soft bg-surface-2 shadow-(--elev-sheet)"
      >
        <div className="mx-auto flex max-w-160 items-center justify-between gap-3 px-4 py-2">
          <p className="min-w-0 text-label font-bold tabular-nums"><span className="sr-only">Progreso del boleto: </span>{progress}</p>
          <div className="flex shrink-0 items-center gap-1">
            <Button size="md" onClick={() => setMinimized(false)} className="px-4">Abrir boleto</Button>
            <button
              type="button"
              onClick={close}
              aria-label="Cerrar el boleto"
              className="fx-icon inline-flex size-touch items-center justify-center rounded-pill text-fg"
            >
              <X size={22} weight="bold" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
