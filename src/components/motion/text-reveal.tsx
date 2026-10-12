"use client";

import { useInView } from "./use-in-view";

/**
 * Words fill from muted to the surrounding text color, staggered, once the text is in view.
 * Render it inside a heading (`<h1><TextReveal text="..." /></h1>`): the heading keeps the real text for assistive tech.
 */
export function TextReveal({ text, className }: { text: string; className?: string }) {
  const [ref, revealed] = useInView<HTMLSpanElement>({ threshold: 0.1 });
  const words = text.split(" ").filter(Boolean);
  return (
    <span ref={ref} data-revealed={revealed} className={className}>
      {words.map((word, index) => (
        <span key={index}>
          <span className="text-reveal-word" style={{ "--i": index } as React.CSSProperties}>{word}</span>
          {index < words.length - 1 && " "}
        </span>
      ))}
    </span>
  );
}
