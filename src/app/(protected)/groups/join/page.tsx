import type { Metadata } from "next";
import ticket from "../../../../../public/asset_ticket.png";
import { Sticker } from "@/components/ui/sticker";
import { PageContainer } from "@/components/shell/page-container";
import { requireUser } from "@/features/auth/server/session";
import { JoinGroupForm } from "@/features/groups/components/join-group-form";

export const metadata: Metadata = { title: "Unirme a una peña" };

export default async function Page() {
  await requireUser();
  return (
    <PageContainer eyebrow="Peñas" title="Unirme a una peña" description="Escribe el código que te ha pasado un admin de la peña." sticker={<Sticker src={ticket} width={96} tilt={8} className="absolute -right-3 -top-12" />}>
      <JoinGroupForm />
    </PageContainer>
  );
}
