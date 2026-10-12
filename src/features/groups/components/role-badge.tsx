import { Crown } from "@phosphor-icons/react/dist/ssr/Crown";
import { Badge } from "@/components/ui/badge";
import type { GroupRole } from "../domain/groups";

/** Role label for a group member. `creator` takes precedence over the plain admin role. */
export function RoleBadge({ role, creator = false }: { role: GroupRole; creator?: boolean }) {
  if (creator) return <Badge tone="warning" icon={<Crown size={14} weight="fill" aria-hidden="true" />}>Creador</Badge>;
  return role === "admin" ? <Badge tone="action">Admin</Badge> : <Badge tone="neutral">Miembro</Badge>;
}
