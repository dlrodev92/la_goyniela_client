import { Suspense, ViewTransition, type ReactNode } from "react";

type SuspendedProps = {
  /** Layout-faithful placeholder: same heights and structure as the content that replaces it. */
  fallback: ReactNode;
  children: ReactNode;
};

/**
 * Suspense with a soft hand-off: the placeholder fades out and the real content fades in with a slight rise
 * (the `reveal` view-transition classes), so a slow section never pops in. Placeholders built from <Skeleton> stay
 * invisible for the first 250 ms, so fast sections never flash one at all.
 */
export function Suspended({ fallback, children }: SuspendedProps) {
  return (
    <Suspense fallback={<ViewTransition exit="reveal-out" default="none">{fallback}</ViewTransition>}>
      <ViewTransition enter="reveal" default="none">{children}</ViewTransition>
    </Suspense>
  );
}
