import "server-only";
import { z } from "zod";
import type { GroupDetail, GroupMember, GroupsGateway, GroupSummary } from "../domain/groups";
import { createAuthenticatedClient } from "../../../lib/http/json-client";

const id = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const timestamp = z.string().datetime({ offset: true });
const role = z.enum(["admin", "member"]);

const memberSchema = z.object({
  user_id: id,
  display_name: z.string(),
  avatar_url: z.string().nullable().optional(),
  role,
  joined_at: timestamp,
});
const groupSchema = z.object({
  id,
  name: z.string(),
  description: z.string().nullable().optional(),
  join_code: z.string().min(1),
  max_members: z.number().int().positive(),
  show_picks: z.boolean().default(false),
  created_by_user_id: id,
  created_at: timestamp,
  member_count: z.number().int().nonnegative(),
  role,
});
const detailSchema = groupSchema.extend({ members: z.array(memberSchema) });

export const groupListSchema = z.array(groupSchema);
export const groupDetailSchema = detailSchema;

function toMember(wire: z.infer<typeof memberSchema>): GroupMember {
  return { userId: String(wire.user_id), displayName: wire.display_name, avatarUrl: wire.avatar_url ?? null,
    role: wire.role, joinedAt: wire.joined_at };
}
function toSummary(wire: z.infer<typeof groupSchema>): GroupSummary {
  return { id: String(wire.id), name: wire.name, description: wire.description ?? null, joinCode: wire.join_code,
    maxMembers: wire.max_members, showPicks: wire.show_picks, createdByUserId: String(wire.created_by_user_id),
    createdAt: wire.created_at, memberCount: wire.member_count, role: wire.role };
}
function toDetail(wire: z.infer<typeof detailSchema>): GroupDetail {
  return { ...toSummary(wire), members: wire.members.map(toMember) };
}

export function createGroupsGateway(baseUrl: string, token: string, fetcher: typeof fetch = fetch, timeoutMs?: number): GroupsGateway {
  const request = createAuthenticatedClient(baseUrl, token, fetcher, timeoutMs);
  const memberPath = (groupId: string, userId: string) =>
    `/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(userId)}`;
  return {
    async list() {
      return (await request("/groups", groupListSchema)).map(toSummary);
    },
    async create(input) {
      const body = input.description ? { name: input.name, description: input.description } : { name: input.name };
      return toDetail(await request("/groups", detailSchema, { method: "POST", body }));
    },
    async join(joinCode) {
      return toDetail(await request("/groups/join", detailSchema, {
        method: "POST", body: { join_code: joinCode },
        // Backend: 400 = group full (detail.code "group_full"), 409 = already a member ("already_member").
        statusMap: { 400: "group-full", 404: "invalid-join-code", 409: "already-member" },
      }));
    },
    async get(groupId) {
      return toDetail(await request(`/groups/${encodeURIComponent(groupId)}`, detailSchema));
    },
    async leave(groupId) {
      // 204 No Content on success; 400 means the caller is the creator.
      await request(`/groups/${encodeURIComponent(groupId)}/leave`, z.undefined(), {
        method: "POST", statusMap: { 400: "creator-cannot-leave" },
      });
    },
    async setShowPicks(groupId, showPicks) {
      return toSummary(await request(`/groups/${encodeURIComponent(groupId)}`, groupSchema, {
        method: "PATCH", body: { show_picks: showPicks },
      }));
    },
    // Admin endpoints answer 204. Backend: 400 = target is the caller, 403 = target is the creator or the
    // caller is not admin (indistinguishable by status), 404 = group/member gone, 409 = already admin / not admin.
    async promoteMember(groupId, userId) {
      await request(`${memberPath(groupId, userId)}/promote`, z.undefined(), {
        method: "POST", statusMap: { 400: "self-action", 403: "creator-protected", 409: "already-admin" },
      });
    },
    async demoteMember(groupId, userId) {
      await request(`${memberPath(groupId, userId)}/demote`, z.undefined(), {
        method: "POST", statusMap: { 400: "self-action", 403: "creator-protected", 409: "not-admin" },
      });
    },
    async removeMember(groupId, userId) {
      await request(memberPath(groupId, userId), z.undefined(), {
        method: "DELETE", statusMap: { 400: "self-action", 403: "creator-protected" },
      });
    },
    async delete(groupId) {
      await request(`/groups/${encodeURIComponent(groupId)}`, z.undefined(), { method: "DELETE" });
    },
  };
}
