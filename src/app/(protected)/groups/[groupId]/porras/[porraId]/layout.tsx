import type { ReactNode } from "react";

/** `modal` is the parallel slot where the boleto sheet opens (intercepting route) over the porra page. */
export default function PorraLayout({ children, modal }: { children: ReactNode; modal: ReactNode }) {
  return (
    <>
      {children}
      {modal}
    </>
  );
}
