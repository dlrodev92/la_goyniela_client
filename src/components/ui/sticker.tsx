import Image, { type StaticImageData } from "next/image";
import type { CSSProperties } from "react";

import { cn } from "@/lib/cn";

/** Visible region of the source image as fractions (0-1) of its width and height. */
export type StickerTrim = { x: number; y: number; w: number; h: number };

/**
 * Opaque-pixel bounding boxes of the 850px square characters (they carry wide transparent margins), so they can be
 * cropped to the figure without editing the PNGs.
 */
export const trims = {
  administrator: { x: 0.28, y: 0, w: 0.44, h: 0.97 },
  celebrating: { x: 0.1, y: 0.05, w: 0.78, h: 0.86 },
  vote: { x: 0.13, y: 0.11, w: 0.73, h: 0.76 },
  waiting: { x: 0.01, y: 0.29, w: 0.94, h: 0.48 },
  logo: { x: 0.09, y: 0.07, w: 0.79, h: 0.82 },
} as const satisfies Record<string, StickerTrim>;

type StickerProps = {
  /** Static import of a transparent pixel-art asset (public/asset_*.png, administrator.png, ...). */
  src: StaticImageData;
  /** Rendered width in px of the visible (trimmed) area; height follows. Trimmed stickers resize per breakpoint with `sm:[--sticker-w:160px]`; plain ones with `w-*` classes. */
  width: number;
  /** Crop to this region of the source (see `trims`). */
  trim?: StickerTrim;
  /** Rotation in degrees, for the slightly pasted-on feel. */
  tilt?: number;
  /** Position and stacking, e.g. "absolute -right-3 -top-6". Cards are `relative`, so offsets are relative to the card. */
  className?: string;
  /** Preload the art (above-the-fold hero stickers only). */
  preload?: boolean;
};

/**
 * Decorative pixel-art sticker: crisp edges, a hard ink offset shadow that follows the alpha silhouette, never interactive.
 * Always aria-hidden with an empty alt; the information it illustrates must also exist as text.
 */
export function Sticker({ src, width, trim, tilt = 0, className, preload = false }: StickerProps) {
  const t = trim ?? { x: 0, y: 0, w: 1, h: 1 };
  const aspect = (t.w * src.width) / (t.h * src.height);
  const tiltStyle = tilt ? { rotate: `${tilt}deg` } : null;
  const shadow = "[filter:drop-shadow(3px_3px_0_var(--color-ink))]";
  if (!trim) {
    return (
      <Image
        src={src}
        alt=""
        aria-hidden="true"
        width={width}
        height={Math.round(width / aspect)}
        sizes={`${width}px`}
        preload={preload}
        draggable={false}
        style={{ ...tiltStyle }}
        className={cn("pointer-events-none z-10 h-auto select-none [image-rendering:pixelated]", shadow, className)}
      />
    );
  }
  // The wrapper owns size, tilt and shadow; the image is scaled and offset inside it so only the trimmed region shows.
  return (
    <span
      aria-hidden="true"
      style={{ ...tiltStyle, "--sticker-w": `${width}px`, aspectRatio: aspect } as CSSProperties}
      className={cn("pointer-events-none z-10 block w-(--sticker-w) select-none overflow-hidden", !/\b(absolute|fixed|sticky)\b/.test(className ?? "") && "relative", shadow, className)}
    >
      <Image
        src={src}
        alt=""
        width={Math.round(width / t.w)}
        height={Math.round((width / t.w) * (src.height / src.width))}
        sizes={`${Math.round(width / t.w)}px`}
        preload={preload}
        draggable={false}
        style={{ position: "absolute", maxWidth: "none", width: `${100 / t.w}%`, height: "auto", left: `${(-t.x / t.w) * 100}%`, top: `${(-t.y / t.h) * 100}%` }}
        className="[image-rendering:pixelated]"
      />
    </span>
  );
}
