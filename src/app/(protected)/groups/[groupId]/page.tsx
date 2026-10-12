import type { Metadata } from "next";
import football from "../../../../../public/asset_football.png";
import { Sticker } from "@/components/ui/sticker";
import { notFound } from "next/navigation";
import { UsersThree } from "@phosphor-icons/react/dist/ssr/UsersThree";
import { AutoRefresh } from "@/components/shell/auto-refresh";
import { PageContainer } from "@/components/shell/page-container";
import { SectionBar } from "@/components/ui/section-bar";
import { requireUser } from "@/features/auth/server/session";
import { canDeleteGroup, canManageGroup, isCreator } from "@/features/groups/domain/groups";
import { DeleteGroupControl } from "@/features/groups/components/delete-group-control";
import { GroupSettingsControl } from "@/features/groups/components/group-settings-control";
import { JoinCodeTicket } from "@/features/groups/components/join-code-ticket";
import { LeaveGroupControl } from "@/features/groups/components/leave-group-control";
import { MemberList } from "@/features/groups/components/member-list";
import { RoleBadge } from "@/features/groups/components/role-badge";
import { loadGroup } from "@/features/groups/server/queries";
import { GroupPorraEntry } from "@/features/porras/components/group-porra-entry";
import { isRouteId } from "@/lib/route-id";

export const metadata: Metadata = { title: "Peña" };

export default async function Page({ params }: { params: Promise<{ groupId: string }> }) {
  const user = await requireUser();
  const { groupId } = await params;
  if (!isRouteId(groupId)) notFound();
  const group = await loadGroup(groupId);
  return (
    <PageContainer eyebrow="Peña" title={group.name} description={group.description ?? undefined} className="[&_h1]:break-words" sticker={<Sticker src={football} width={88} tilt={-8} className="absolute -right-3 -top-12" />}>
      <AutoRefresh />
      <div className="flex flex-wrap items-center gap-3">
        <RoleBadge role={group.role} creator={isCreator(group, user.id)} />
        <span className="inline-flex items-center gap-1 text-label tabular-nums text-fg-muted">
          <UsersThree size={18} weight="bold" aria-hidden="true" />
          {group.memberCount} {group.memberCount === 1 ? "miembro" : "miembros"}
        </span>
      </div>
      <JoinCodeTicket code={group.joinCode} groupName={group.name} memberCount={group.memberCount} maxMembers={group.maxMembers} />
      <section aria-labelledby="porra-heading" className="grid gap-3">
        <SectionBar index="01" title="Porra de la jornada" headingId="porra-heading" />
        <GroupPorraEntry group={group} />
      </section>
      <section aria-labelledby="members-heading" className="grid gap-3">
        <SectionBar index="02" title={`Miembros (${group.memberCount})`} headingId="members-heading" />
        <MemberList members={group.members} currentUserId={user.id} group={group} />
      </section>
      {canManageGroup(group) && <GroupSettingsControl groupId={group.id} showPicks={group.showPicks} />}
      {!isCreator(group, user.id) && <LeaveGroupControl groupId={group.id} groupName={group.name} />}
      {canDeleteGroup(group, user.id) && <DeleteGroupControl groupId={group.id} groupName={group.name} />}
    </PageContainer>
  );
}
