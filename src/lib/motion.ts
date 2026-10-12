/**
 * Motion tokens for JS (GSAP, requestAnimationFrame). The CSS source of truth is the `@theme` motion block in
 * src/app/globals.css: keep both in sync. Durations are in milliseconds; GSAP wants seconds, use `seconds()`.
 */
export const duration = { fast: 150, base: 240, slow: 400, hero: 700, curtain: 580 } as const;

/** Delay between consecutive items of a staggered entrance. */
export const staggerStep = 45;

/** CSS easing strings (same values as the `--ease-*` tokens). */
export const ease = {
  enter: "cubic-bezier(0.16, 1, 0.3, 1)",
  standard: "cubic-bezier(0.2, 0, 0, 1)",
  exit: "cubic-bezier(0.4, 0, 1, 1)",
  spring: "linear(0, 0.083, 0.267, 0.48, 0.677, 0.836, 0.949, 1.02, 1.056, 1.068, 1.064, 1.053, 1.038, 1.024, 1.013, 1.005, 0.999, 0.997, 0.995, 0.996, 1)",
} as const;

/** Closest built-in GSAP eases, for tweens that cannot use CSS (GSAP has no cubic-bezier without CustomEase). */
export const gsapEase = { enter: "expo.out", standard: "power3.out", exit: "power2.in", spring: "back.out(1.2)" } as const;

export const seconds = (ms: number): number => ms / 1000;

/** Decelerating curve used by JS tweens: t in 0..1 -> 0..1 (cubic out; the JS counterpart of `ease.enter`). */
export function easeOut(t: number): number {
  const clamped = Math.min(Math.max(t, 0), 1);
  return 1 - (1 - clamped) ** 3;
}

/** True when the user asked for reduced motion. Safe on the server (returns false). */
export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
