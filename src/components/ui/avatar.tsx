import Image from "next/image";
import { cn } from "@/lib/cn";
import { initialsOf } from "@/lib/ui-text";

export type AvatarSize = "sm" | "md" | "lg" | "xl";

const sizes: Record<AvatarSize, { box: string; px: number; text: string }> = {
  sm: { box: "size-8", px: 32, text: "text-meta" },
  md: { box: "size-12", px: 48, text: "text-label" },
  lg: { box: "size-20", px: 80, text: "text-h2" },
  xl: { box: "size-28", px: 112, text: "text-display" },
};

type AvatarProps = {
  name: string;
  /** Spanish alt text, e.g. "Avatar de Marta". */
  alt: string;
  src?: string | null;
  size?: AvatarSize;
  className?: string;
};

/** Remote avatar hosts are not known at build time, so the image is served unoptimized. */
export function Avatar({ name, alt, src, size = "md", className }: AvatarProps) {
  const { box, px, text } = sizes[size];
  const ring = cn("badge-ring m-1.5 shrink-0 overflow-hidden text-action", box, className);
  if (src) {
    return (
      <span className={cn(ring, "inline-block bg-surface-2")}>
        <Image src={src} alt={alt} width={px} height={px} unoptimized referrerPolicy="no-referrer" className="size-full object-cover" />
      </span>
    );
  }
  return (
    <span role="img" aria-label={alt} className={cn(ring, "inline-flex items-center justify-center bg-surface-3 font-display uppercase", text)}>
      <span aria-hidden="true" className="text-fg">{initialsOf(name)}</span>
    </span>
  );
}
