import type { Metadata } from "next";
import jersey from "../../../../../public/asset_jersey.png";
import { Sticker } from "@/components/ui/sticker";
import { PageContainer } from "@/components/shell/page-container";
import { requireUser } from "@/features/auth/server/session";
import { CreateGroupForm } from "@/features/groups/components/create-group-form";

export const metadata: Metadata = { title: "Crear peña" };

export default async function Page() {
  await requireUser();
  return (
    <PageContainer eyebrow="Peñas" title="Crear peña" description="Ponle nombre a tu peña e invita a tus amigos con un código." sticker={<Sticker src={jersey} width={84} tilt={-6} className="absolute -right-3 -top-12" />}>
      <CreateGroupForm />
    </PageContainer>
  );
}
