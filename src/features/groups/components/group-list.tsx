import { CaretRight } from "@phosphor-icons/react/dist/ssr/CaretRight";
import { UsersThree } from "@phosphor-icons/react/dist/ssr/UsersThree";
import { AppLink } from "@/components/shell/app-link";
import type { CSSProperties } from "react";
import { Card } from "@/components/ui/card";
import type { GroupSummary } from "../domain/groups";
import { RoleBadge } from "./role-badge";

export function GroupList({ groups, userId }: { groups: GroupSummary[]; userId: string }) {
  return (
    <ul className="grid gap-3">
      {groups.map((group, index) => (
        <li key={group.id} className="stagger-in" style={{ "--i": index } as CSSProperties}>
          <AppLink
            href={`/groups/${group.id}`}
            transitionTypes={["nav-forward"]}
            className="tap block rounded-card text-fg no-underline [--press-scale:0.985]"
          >
            <Card surface={1} padding="md" interactive className="grid-cols-[auto_1fr_auto] items-center gap-3">
              <span aria-hidden="true" className="self-stretch border-r-(length:--bw) border-border-soft pr-3 font-display text-h1 leading-none tabular-nums text-fg-muted">{String(index + 1).padStart(2, "0")}</span>
              <div className="grid min-w-0 gap-2">
                <p className="break-words font-display text-h2 uppercase">{group.name}</p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="inline-flex items-center gap-1 text-label tabular-nums text-fg-muted">
                    <UsersThree size={18} weight="bold" aria-hidden="true" />
                    {group.memberCount} {group.memberCount === 1 ? "miembro" : "miembros"}
                  </span>
                  <RoleBadge role={group.role} creator={group.createdByUserId === userId} />
                </div>
              </div>
              <CaretRight size={24} weight="bold" aria-hidden="true" className="text-action" />
            </Card>
          </AppLink>
        </li>
      ))}
    </ul>
  );
}
