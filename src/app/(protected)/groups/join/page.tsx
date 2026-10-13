import type { Metadata } from "next";
import ticket from "../../../../../public/asset_ticket.png";
import { Sticker } from "@/components/ui/sticker";
import { PageContainer } from "@/components/shell/page-container";
import { requireUser } from "@/features/auth/server/session";
import { parseInviteCode } from "@/features/groups/domain/groups";
import { JoinGroupForm } from "@/features/groups/components/join-group-form";

export const metadata: Metadata = { title: "Unirme a una peña" };

export default async function Page({ searchParams }: { searchParams: Promise<{ code?: string | string[] }> }) {
  await requireUser();
  const { code } = await searchParams;
  const initialCode = parseInviteCode(Array.isArray(code) ? code[0] : code) ?? undefined;
  return (
    <PageContainer eyebrow="Peñas" title="Unirme a una peña" description="Escribe el código que te ha pasado un admin de la peña." sticker={<Sticker src={ticket} width={96} tilt={8} className="absolute -right-3 -top-12" />}>
      <JoinGroupForm initialCode={initialCode} />
    </PageContainer>
  );
}
