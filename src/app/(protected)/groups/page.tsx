import type { Metadata } from "next";
import cornerflag from "../../../../public/asset_cornerflag.png";
import { Sticker } from "@/components/ui/sticker";
import { Plus } from "@phosphor-icons/react/dist/ssr/Plus";
import { PageContainer } from "@/components/shell/page-container";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireUser } from "@/features/auth/server/session";
import { GroupList } from "@/features/groups/components/group-list";
import { loadMyGroups } from "@/features/groups/server/queries";

import scarf from "../../../../public/asset_scarf.png";

export const metadata: Metadata = { title: "Tus peñas" };

export default async function GroupsPage() {
  const user = await requireUser();
  const groups = await loadMyGroups();
  return (
    <PageContainer eyebrow="Peñas" title="Tus peñas" sticker={<Sticker src={cornerflag} width={88} tilt={6} className="absolute -right-3 -top-12" />}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Button href="/groups/new" fullWidth leadingIcon={<Plus size={20} weight="bold" aria-hidden="true" />}>Crear peña</Button>
        <Button href="/groups/join" variant="secondary" fullWidth>Unirme con código</Button>
      </div>
      {groups.length === 0 ? (
        <Card surface={1} padding="lg">
          <EmptyState
            illustration={scarf}
            title="Aún no tienes peña"
            description="Crea una peña para tus amigos o únete con el código que te hayan pasado."
          />
        </Card>
      ) : (
        <GroupList groups={groups} userId={user.id} />
      )}
    </PageContainer>
  );
}
