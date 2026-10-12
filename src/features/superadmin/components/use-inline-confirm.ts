"use client";

import { useState } from "react";
import type { ActionState } from "../domain/admin";

/**
 * Open/closed state of an inline confirm tied to one `useActionState` result. It closes itself when the action reports
 * `saved` (a new state object after the one seen when it opened); an error leaves it open so the message stays next to the action.
 */
export function useInlineConfirm<P, S extends ActionState>(state: S) {
  const [opened, setOpened] = useState<{ payload: P; base: S } | null>(null);
  const visible = opened !== null && !(state !== opened.base && state.status === "saved");
  return {
    payload: visible ? opened.payload : null,
    open: (payload: P) => setOpened({ payload, base: state }),
    close: () => setOpened(null),
  };
}
