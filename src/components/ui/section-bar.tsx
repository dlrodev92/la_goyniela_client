import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

type SectionBarProps = {
  /** Section index shown as a big numeral, e.g. "02". Decorative: the heading carries the meaning. */
  index?: string;
  title: string;
  /** Id of the heading, for `aria-labelledby` on the section it introduces. */
  headingId?: string;
  /** Right-aligned link or control. */
  action?: ReactNode;
  className?: string;
};

/**
 * Numbered section heading as a small cream plate with a hard shadow, readable straight on the scene art:
 * `02 | TUS PEÑAS ............ Ver todas`.
 */
export function SectionBar({ index, title, headingId, action, className }: SectionBarProps) {
  return (
    <div data-section-bar="" className={cn("brut-panel flex items-center gap-3 px-3 py-2", className)}>
      {index && (
        <>
          <span aria-hidden="true" className="font-display text-h1 leading-none tabular-nums">{index}</span>
          <span aria-hidden="true" className="h-7 w-0.5 bg-ink" />
        </>
      )}
      <h2 id={headingId} className="min-w-0 flex-1 font-display text-h2 uppercase leading-none">{title}</h2>
      {action}
    </div>
  );
}
