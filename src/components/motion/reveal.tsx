"use client";

import { useEffect, useState, type ReactNode } from "react";

import { cn } from "@/lib/cn";

type RevealProps = {
  /** The content to show; a falsy value (null, undefined, false, "") closes the slot. */
  children?: ReactNode;
  /** Announces content that appears (polite live region). Turn off when the child already carries its own role. */
  live?: boolean;
  className?: string;
  id?: string;
};

const isPresent = (node: ReactNode) => node !== null && node !== undefined && node !== false && node !== "";

/**
 * Animated slot for content that comes and goes (inline messages, validation errors, conditional panels).
 * It opens by animating its row height with a short fade and rise, and on close keeps the last content mounted until
 * the exit has played, so nothing vanishes abruptly. The slot itself stays in the layout (zero height when empty),
 * so it works as the live region too: `<Reveal>{error && <StatusMessage tone="error">{error}</StatusMessage>}</Reveal>`.
 */
export function Reveal({ children, live = true, className, id }: RevealProps) {
  const open = isPresent(children);
  // Last non-empty content, kept so the exit animation still has something to show.
  const [kept, setKept] = useState<ReactNode>(null);
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => setKept(children));
    return () => cancelAnimationFrame(frame);
  }, [open, children]);

  const content = open ? children : kept;
  return (
    <div
      id={id}
      aria-live={live ? "polite" : undefined}
      data-open={open}
      className={cn("reveal", className)}
      onTransitionEnd={(event) => {
        // Release the retained content once the closing transition of the slot itself has finished.
        if (!open && event.target === event.currentTarget && event.propertyName === "grid-template-rows") setKept(null);
      }}
    >
      <div className="reveal-inner" inert={!open}>{content}</div>
    </div>
  );
}
