import type { StaticImageData } from "next/image";
import type { ReactNode } from "react";

import { EmptyState } from "@/components/ui/empty-state";

import { PageContainer } from "./page-container";

type SystemStateProps = {
  illustration: StaticImageData;
  title: string;
  /** Small label above the title, e.g. "404". */
  eyebrow?: string;
  description: string;
  action?: ReactNode;
};

/** Page-level state (error, not found, forbidden...): one illustration, one h1, one action. */
export function SystemState({ illustration, title, eyebrow, description, action }: SystemStateProps) {
  return (
    <PageContainer centered>
      <EmptyState headingLevel={1} illustration={illustration} title={title} eyebrow={eyebrow} description={description} action={action} />
    </PageContainer>
  );
}
