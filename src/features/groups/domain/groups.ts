export type GroupRole = "admin" | "member";

export type GroupMember = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  role: GroupRole;
  joinedAt: string;
};

export type GroupSummary = {
  id: string;
  name: string;
  description: string | null;
  joinCode: string;
  maxMembers: number;
  showPicks: boolean;
  createdByUserId: string;
  createdAt: string;
  memberCount: number;
  /** The caller's role in this group. */
  role: GroupRole;
};

export type GroupDetail = GroupSummary & { members: GroupMember[] };

export type NewGroup = { name: string; description?: string };

export interface GroupsGateway {
  list(): Promise<GroupSummary[]>;
  create(input: NewGroup): Promise<GroupDetail>;
  join(joinCode: string): Promise<GroupDetail>;
  get(groupId: string): Promise<GroupDetail>;
  /** Resolves on 204. A creator leaving is rejected with `creator-cannot-leave`. */
  leave(groupId: string): Promise<void>;
  /** Admin only. Toggles whether members can see each other's picks. */
  setShowPicks(groupId: string, showPicks: boolean): Promise<GroupSummary>;
  /** Admin only; each resolves on 204. */
  promoteMember(groupId: string, userId: string): Promise<void>;
  demoteMember(groupId: string, userId: string): Promise<void>;
  removeMember(groupId: string, userId: string): Promise<void>;
  /** Creator only; resolves on 204. */
  delete(groupId: string): Promise<void>;
}

export const JOIN_CODE_MIN = 6;
export const JOIN_CODE_MAX = 8;
export const GROUP_NAME_MIN = 2;
export const GROUP_NAME_MAX = 80;
export const GROUP_DESCRIPTION_MAX = 2000;

export const isCreator = (group: Pick<GroupSummary, "createdByUserId">, userId: string): boolean =>
  group.createdByUserId === userId;

export type MemberAction = "promote" | "demote" | "remove";
export const MEMBER_ACTIONS: readonly MemberAction[] = ["promote", "demote", "remove"];
export const isMemberAction = (value: unknown): value is MemberAction =>
  typeof value === "string" && (MEMBER_ACTIONS as readonly string[]).includes(value);

/** Admins (creator included) manage settings and members. UI hiding only; the backend decides. */
export const canManageGroup = (group: Pick<GroupSummary, "role">): boolean => group.role === "admin";

/** Only the creator may delete a group. */
export const canDeleteGroup = (group: Pick<GroupSummary, "createdByUserId">, actorId: string): boolean =>
  isCreator(group, actorId);

/**
 * Which admin actions to offer on one member row. Nothing for non-admins, on yourself
 * (leave the group instead) or on the creator (immutable admin who cannot be removed).
 */
export function memberActions(
  group: Pick<GroupSummary, "createdByUserId" | "role">,
  actorId: string,
  target: Pick<GroupMember, "userId" | "role">,
): MemberAction[] {
  if (!canManageGroup(group)) return [];
  if (target.userId === actorId || isCreator(group, target.userId)) return [];
  return [target.role === "admin" ? "demote" : "promote", "remove"];
}

/** Typed-name confirmation for deleting a group: exact match after trimming. */
export const matchesGroupName = (typed: unknown, groupName: string): boolean =>
  typeof typed === "string" && typed.trim() === groupName.trim();

/** Cookie that carries an invite code from the public invite link through sign-up/login. */
export const PENDING_JOIN_COOKIE = "pending_join_code";

/** A well-formed join code (trimmed, uppercased), or null. Gate for anything read from a URL or cookie. */
export function parseInviteCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  return code.length >= JOIN_CODE_MIN && code.length <= JOIN_CODE_MAX && /^[A-Z0-9]+$/.test(code) ? code : null;
}

/** Page where a signed-in user confirms joining with the code prefilled. */
export const joinPathFor = (code: string): string => `/groups/join?code=${encodeURIComponent(code)}`;

/** Where to land after authenticating: the join page for a pending invite, the dashboard otherwise. */
export const postAuthPath = (pendingCode: unknown): string => {
  const code = parseInviteCode(pendingCode);
  return code ? joinPathFor(code) : "/dashboard";
};

/** Public invite link: signs people up (or straight to the join page when logged in). */
export const inviteUrl = (origin: string, code: string): string =>
  `${origin}/invitacion/${encodeURIComponent(code)}`;

/** Spanish invitation shared from the join-code ticket (native share, clipboard and WhatsApp). */
export const invitationText = (groupName: string, code: string, url: string): string =>
  `Únete a mi peña «${groupName}» en La Goyniela: ${url} (código ${code}).`;

/** WhatsApp deep link (opens the chat picker with the text prefilled). */
export const whatsappShareUrl = (groupName: string, code: string, url: string): string =>
  `https://wa.me/?text=${encodeURIComponent(invitationText(groupName, code, url))}`;
