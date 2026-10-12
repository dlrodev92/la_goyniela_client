import { cn } from "@/lib/cn";

type SkeletonProps = { variant?: "block" | "line" | "card"; className?: string };

const variants = {
  block: "h-24 w-full rounded-control",
  line: "h-4 w-3/4 rounded-pill",
  card: "h-40 w-full rounded-card border-(length:--bw) border-border-soft",
} as const;

/**
 * Decorative placeholder: invisible for the first 250 ms (fast loads never flash it), then fades in with a brand shimmer.
 * Size it like the content it stands for (same heights, same structure) so the swap causes no layout jump.
 * Wrap groups in a container with aria-busy and a visible/sr-only loading label.
 */
export function Skeleton({ variant = "block", className }: SkeletonProps) {
  return <span aria-hidden="true" className={cn("skeleton", variants[variant], className)} />;
}
