import type { CSSProperties } from "react";
import { Avatar } from "@/components/ui/avatar";
import { isCreator, memberActions, type GroupMember, type GroupSummary } from "../domain/groups";
import { MemberAdminControls } from "./member-admin-controls";
import { RoleBadge } from "./role-badge";

type Props = {
  members: GroupMember[];
  currentUserId: string;
  /** When given, admins get management controls on the rows they may act on. */
  group?: Pick<GroupSummary, "id" | "createdByUserId" | "role">;
};

export function MemberList({ members, currentUserId, group }: Props) {
  return (
    <ul className="grid gap-3">
      {members.map((member, index) => {
        const actions = group ? memberActions(group, currentUserId, member) : [];
        const name = member.displayName || "Jugador";
        return (
          <li key={member.userId} className="stagger-in grid gap-3 border-b border-border-soft/60 pb-3 last:border-b-0 last:pb-0" style={{ "--i": index } as CSSProperties}>
            <div className="flex items-center gap-3">
              <Avatar name={name} alt={`Avatar de ${name}`} src={member.avatarUrl} size="md" />
              <div className="grid min-w-0 flex-1 gap-1">
                <p className="break-words text-body font-bold">
                  {name}
                  {member.userId === currentUserId && <span className="font-normal text-fg-muted"> (tú)</span>}
                </p>
                <div><RoleBadge role={member.role} creator={group ? isCreator(group, member.userId) : false} /></div>
              </div>
            </div>
            {group && actions.length > 0 && (
              <MemberAdminControls groupId={group.id} userId={member.userId} displayName={member.displayName} actions={actions} />
            )}
          </li>
        );
      })}
    </ul>
  );
}
