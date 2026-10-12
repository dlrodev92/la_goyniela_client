import Image, { type StaticImageData } from "next/image";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type EmptyStateProps = {
  /** Static asset (import) or a public path; purely decorative, so it carries empty alt. */
  illustration?: StaticImageData | string;
  title: string;
  /** Small tracked label above the title, e.g. "404". */
  eyebrow?: string;
  description?: string;
  action?: ReactNode;
  headingLevel?: 1 | 2 | 3;
  className?: string;
};

export function EmptyState({ illustration, title, eyebrow, description, action, headingLevel = 2, className }: EmptyStateProps) {
  const Heading = headingLevel === 1 ? "h1" : headingLevel === 2 ? "h2" : "h3";
  return (
    <div className={cn("grid justify-items-center gap-4 text-center", className)}>
      {illustration && (
        <Image
          src={illustration}
          alt=""
          width={200}
          height={200}
          sizes="200px"
          className="pixel-reveal h-auto max-h-48 w-auto object-contain [image-rendering:pixelated] [filter:drop-shadow(4px_4px_0_var(--color-ink))]"
        />
      )}
      <div className="grid max-w-prose gap-2">
        {eyebrow && <p className="label-meta justify-self-center border-2 border-border-soft bg-signal px-2 py-0.5 text-ink">{eyebrow}</p>}
        <Heading className="font-display text-h1 uppercase leading-none text-fg">{title}</Heading>
        {description && <p className="text-body text-fg-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
