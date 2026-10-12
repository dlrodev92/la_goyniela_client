"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { teamInitials } from "@/lib/ui-text";

export type TeamCrestSize = "xs" | "sm" | "md" | "lg";

const sizes: Record<TeamCrestSize, { box: string; px: number; text: string }> = {
  xs: { box: "size-5", px: 20, text: "text-[6px]" },
  sm: { box: "size-7", px: 28, text: "text-[9px]" },
  md: { box: "size-10", px: 40, text: "text-meta" },
  lg: { box: "size-14", px: 56, text: "text-label" },
};

// Pixel shield: flat top, stepped shoulders and a stepped point at the bottom (percentages keep it scalable).
const SHIELD = "polygon(0 0, 100% 0, 100% 55%, 88% 68%, 76% 80%, 62% 90%, 50% 100%, 38% 90%, 24% 80%, 12% 68%, 0 55%)";

type Props = { name: string; logoUrl?: string | null; size?: TeamCrestSize; className?: string };

/**
 * Team crest. With `logoUrl` it shows the image (unoptimized: R2 hosts are not known at build time, same as Avatar)
 * and falls back to a pixel shield with initials when the URL is missing or fails to load.
 * Client component only because of the `onError` fallback.
 */
export function TeamCrest({ name, logoUrl, size = "md", className }: Props) {
  const { box, px, text } = sizes[size];
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const alt = `Escudo de ${name}`;
  if (logoUrl && failedUrl !== logoUrl) {
    return (
      <Image
        src={logoUrl} alt={alt} width={px} height={px} unoptimized referrerPolicy="no-referrer"
        onError={() => setFailedUrl(logoUrl)}
        className={cn("shrink-0 object-contain", box, className)}
      />
    );
  }
  return (
    <span role="img" aria-label={alt} className={cn("relative inline-block shrink-0 bg-action", box, className)} style={{ clipPath: SHIELD }}>
      <span
        aria-hidden="true"
        className={cn("absolute inset-[2px] flex items-center justify-center bg-surface-3 font-display uppercase leading-none text-fg", text)}
        style={{ clipPath: SHIELD }}
      >
        {teamInitials(name)}
      </span>
    </span>
  );
}
