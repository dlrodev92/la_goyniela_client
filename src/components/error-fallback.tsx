"use client";

import { Button } from "@/components/ui/button";

import redCard from "../../public/asset_red_card.png";
import { SystemState } from "./shell/system-state";

type ErrorFallbackProps = {
  title?: string;
  description: string;
  reset: () => void;
};

export function ErrorFallback({ title = "Algo salió mal", description, reset }: ErrorFallbackProps) {
  return (
    <SystemState
      illustration={redCard}
      eyebrow="Error"
      title={title}
      description={description}
      action={<Button onClick={reset}>Reintentar</Button>}
    />
  );
}
