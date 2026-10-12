import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type CardProps = {
  as?: "section" | "article" | "div";
  surface?: 1 | 2 | 3;
  /** `danger` swaps the soft border for the danger color (destructive zones). */
  tone?: "default" | "danger";
  padding?: "none" | "sm" | "md" | "lg";
  /** The card is the visible face of a link: it lifts, deepens its shadow and tints its border on hover (fine pointers). */
  interactive?: boolean;
  /** Decorative stepped corner; aria-hidden by construction (CSS pseudo-element). */
  pixelCorner?: boolean;
  /** Pixel-art sticker (see Sticker). Positioned by the sticker's own classes, relative to the card; may overlap the border. */
  sticker?: ReactNode;
  header?: ReactNode;
  className?: string;
  children?: ReactNode;
  id?: string;
  "aria-labelledby"?: string;
};

const surfaces = { 1: "bg-surface-1", 2: "bg-surface-2", 3: "bg-surface-3" } as const;
const paddings = { none: "p-0", sm: "p-3", md: "p-4", lg: "p-6" } as const;

export function Card({ as: Tag = "div", surface = 1, tone = "default", padding = "md", interactive, pixelCorner, sticker, header, className, children, ...rest }: CardProps) {
  return (
    <Tag
      {...rest}
      data-card=""
      data-interactive={interactive ? "" : undefined}
      className={cn(
        "relative rounded-card border-(length:--bw) text-fg shadow-hard",
        tone === "danger" ? "border-danger" : "border-border-soft",
        surfaces[surface],
        interactive && "fx-card",
        paddings[padding],
        pixelCorner && "pixel-corner rounded-tr-none text-action",
      )}
    >
      {sticker}
      {/* The corner accent colors itself through currentColor; reset text color for the content. */}
      <div className={cn(pixelCorner && "text-fg", "grid gap-4", className)}>
        {header && <div className="font-display text-h2 uppercase">{header}</div>}
        {children}
      </div>
    </Tag>
  );
}
