import type { ReactNode } from "react";

import { EntryMarker } from "@/components/motion/entry-marker";
import { PageTransition } from "@/components/motion/page-transition";
import { TextReveal } from "@/components/motion/text-reveal";
import { cn } from "@/lib/cn";

type PageContainerProps = {
  eyebrow?: string;
  title?: string;
  description?: string;
  /** Vertically centre the content (system states). */
  centered?: boolean;
  /** Applied to the outer column (width, bottom padding for sticky bars, descendant selectors). */
  className?: string;
  /** Fill the title word by word when it scrolls into view. */
  revealTitle?: boolean;
  /**
   * `sheet` (default): the header and children sit on one opaque cream panel over the scene, so every page stays legible
   * on the pixel-art fondo. `bare`: no panel; the page lays out its own cards (the dashboard).
   */
  surface?: "sheet" | "bare";
  /** A <Sticker> pasted on the top-right corner of the sheet (position it with `absolute -right-3 -top-10`). Leaves room above the panel. */
  sticker?: ReactNode;
  children?: ReactNode;
};

/*
 * NESTED-CARD RULE (one rule, applied everywhere): a `sheet` page is ONE cream panel, so a <Card> inside it never draws a
 * second box. Static cards flatten into ruled sections (top rule, no shadow, no fill; see `[data-sheet] [data-card]` in
 * globals.css). Interactive cards (links) keep their frame as tappable tiles. Pages that want standalone boxed cards over
 * the scene art (the dashboard) use `surface="bare"` and put their own headings on SectionBar plates.
 */

/**
 * Page column (max 640px; centered at every breakpoint), 16px
 * mobile gutters, one vertical rhythm for everything inside.
 * It is also the page transition boundary (see PageTransition), so every page and loading file takes part.
 */
export function PageContainer({ eyebrow, title, description, centered = false, className, revealTitle = false, surface = "sheet", sticker, children }: PageContainerProps) {
  const header = (eyebrow || title || description) && (
    <div data-sheet-header="" className={cn("grid gap-2 border-b-(length:--bw-thick) border-border-soft pb-4", !!sticker && "pr-16 sm:pr-24")}>
      {eyebrow && (
        <p className="label-meta flex items-center gap-2 text-fg">
          <span aria-hidden="true" className="inline-block h-2.5 w-6 border-2 border-border-soft bg-signal" />
          {eyebrow}
        </p>
      )}
      {title && <h1 className="font-display text-display uppercase leading-[0.95] text-fg sm:text-[3.5rem]">{revealTitle ? <TextReveal text={title} /> : title}</h1>}
      {description && <p className="max-w-[44ch] text-body text-fg-muted">{description}</p>}
    </div>
  );
  return (
    <PageTransition>
      <div
        className={cn(
          "mx-auto grid w-full max-w-160 px-4 py-6 md:py-10",
          !!sticker && "pt-14 md:pt-16",
          centered && "min-h-[calc(100dvh-10rem)] content-center",
          className,
        )}
      >
        <EntryMarker />
        <div data-sheet={surface === "sheet" ? "" : undefined} className={cn("relative grid gap-4 *:min-w-0", surface === "sheet" && "brut-panel p-4 md:p-6")}>
          {sticker}
          {header}
          {children}
        </div>
      </div>
    </PageTransition>
  );
}
