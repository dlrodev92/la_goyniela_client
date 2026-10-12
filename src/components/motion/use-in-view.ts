"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

/** True once the element has entered the viewport (one-shot). Falls back to true when IntersectionObserver is missing. */
export function useInView<T extends Element>(options: IntersectionObserverInit = { threshold: 0.2 }): [RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  const { root, rootMargin, threshold } = options;
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (typeof IntersectionObserver === "undefined") {
      const frame = requestAnimationFrame(() => setInView(true));
      return () => cancelAnimationFrame(frame);
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setInView(true);
        observer.disconnect();
      }
    }, { root, rootMargin, threshold });
    observer.observe(element);
    return () => observer.disconnect();
  }, [root, rootMargin, threshold]);
  return [ref, inView];
}
