"use client";

import { useEffect, useRef, useState } from "react";

import { formatNumber, decimalsOf } from "@/lib/format-number";
import { duration, easeOut, prefersReducedMotion } from "@/lib/motion";

import { useInView } from "./use-in-view";

type AnimatedNumberProps = {
  value: number;
  /** Decimals shown at least (2 for unit prices: "0,50"). */
  minimumFractionDigits?: number;
  /** Decimals shown at most; the target uses only as many as it needs. */
  maximumFractionDigits?: number;
  prefix?: string;
  /** e.g. " €" or " %". Included in the final text exactly as given. */
  suffix?: string;
  /** Tween length in ms. */
  durationMs?: number;
  className?: string;
};

/**
 * Counts up to `value` (es-ES formatting) when it scrolls into view and again whenever `value` changes.
 * The final text is what server HTML and screen readers get; the count itself is decorative (aria-hidden).
 * Reduced motion: no tween, the value is shown as is.
 */
export function AnimatedNumber({
  value, minimumFractionDigits = 0, maximumFractionDigits = 0, prefix = "", suffix = "", durationMs = duration.hero, className,
}: AnimatedNumberProps) {
  const [ref, inView] = useInView<HTMLSpanElement>();
  const [display, setDisplay] = useState(value);
  const last = useRef<number | null>(null);
  const decimals = decimalsOf(value, minimumFractionDigits, maximumFractionDigits);

  useEffect(() => {
    if (!inView) return;
    if (prefersReducedMotion()) {
      last.current = value;
      const frame = requestAnimationFrame(() => setDisplay(value));
      return () => cancelAnimationFrame(frame);
    }
    const from = last.current ?? 0;
    const startedAt = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min((now - startedAt) / durationMs, 1);
      const next = t >= 1 ? value : from + (value - from) * easeOut(t);
      last.current = next;
      setDisplay(next);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, value, durationMs]);

  const text = (n: number) => `${prefix}${formatNumber(n, decimals)}${suffix}`;
  return (
    <span ref={ref} className={className}>
      <span aria-hidden="true" className="tabular-nums">{text(display)}</span>
      <span className="sr-only">{text(value)}</span>
    </span>
  );
}
