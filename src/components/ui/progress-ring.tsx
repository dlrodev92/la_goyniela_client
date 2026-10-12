"use client";

import type { CSSProperties, ReactNode } from "react";

import { useInView } from "@/components/motion/use-in-view";
import { cn } from "@/lib/cn";

type ProgressRingProps = {
  value: number;
  max: number;
  /** Accessible name, e.g. "Partidos jugados". */
  label: string;
  /** Square size in px. */
  size?: number;
  /** Centre content (e.g. the count). Decorative text should be aria-hidden by the caller. */
  children?: ReactNode;
  className?: string;
};

/** Dotted ring: one dot per unit (up to 30); filled dots pop in around the ring, staggered, when it scrolls into view. */
export function ProgressRing({ value, max, label, size = 64, children, className }: ProgressRingProps) {
  const [ref, inView] = useInView<HTMLDivElement>();
  const safeMax = Math.min(Math.max(Math.floor(max), 0), 30);
  const filled = Math.min(Math.max(Math.floor(value), 0), safeMax);
  const center = size / 2;
  const dot = Math.max(size * 0.045, 1.5);
  const radius = center - dot * 1.5;
  return (
    <div
      ref={ref}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-valuenow={filled}
      aria-valuetext={`${filled} de ${safeMax}`}
      className={cn("relative inline-grid shrink-0 place-items-center", className)}
      style={{ width: size, height: size }}
    >
      <svg aria-hidden="true" viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="absolute inset-0">
        {Array.from({ length: safeMax }, (_, i) => {
          const angle = (i / safeMax) * Math.PI * 2 - Math.PI / 2;
          return (
            <circle
              key={i}
              cx={center + Math.cos(angle) * radius}
              cy={center + Math.sin(angle) * radius}
              r={dot}
              data-filled={inView && i < filled ? "true" : "false"}
              className="ring-dot"
              style={{ "--i": i } as CSSProperties}
            />
          );
        })}
      </svg>
      {children && <span className="relative font-display text-meta leading-none text-fg tabular-nums">{children}</span>}
    </div>
  );
}
