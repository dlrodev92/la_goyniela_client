import type { AdminJornadaStatus } from "./jornadas";
import type { IngestReport, IngestRequest } from "./ingest";

export const ADMIN_PAGE_SIZE = 25;

export type AdminUser = { id: string; email: string; displayName: string; isActive: boolean; isSuperadmin: boolean; createdAt: string };

export type AdminTeam = {
  id: string; entityId: string; name: string; shortName: string | null; gender: string | null; genderKnown: boolean;
  country: string | null; logoUrl: string | null; competitionId: string; deletedAt: string | null;
};

export type TeamInput = {
  entityId: string; name: string; shortName: string | null; gender: string | null; genderKnown: boolean;
  country: string | null; logoUrl: string | null; competitionId: string;
};
/** Only the fields present are sent (backend: PATCH applies what it receives and 400s on an empty body). */
export type TeamPatch = Partial<Omit<TeamInput, "entityId">>;

/** Slim team for pickers (public `/api/v1/teams`, not rate limited). */
export type TeamOption = { id: string; name: string; shortName: string | null; logoUrl: string | null; country: string | null };

export type AdminJornada = {
  id: string; season: number; seasonLabel: string; number: number; status: AdminJornadaStatus;
  saleOpensAt: string | null; votingClosesAt: string | null; kickoffFirstAt: string | null; kickoffLastAt: string | null;
  escrutinioExpectedAt: string | null; fetchedAt: string; deletedAt: string | null;
};
export type JornadaPatch = { status?: AdminJornadaStatus; saleOpensAt?: string | null; votingClosesAt?: string | null };
export type JornadaTransition = "open" | "close" | "reopen" | "restore";

export type AdminComposicionRow = {
  position: number; homeTeamId: string; awayTeamId: string; homeRaw: string; awayRaw: string;
  kickoffAt: string | null; competition: string | null;
};
export type ComposicionPatch = { homeTeamId?: string; awayTeamId?: string; kickoffAt?: string | null; competition?: string | null };

export type UserPatch = { isSuperadmin?: boolean; isActive?: boolean };

export type LogoFile = { name: string; contentType: string; bytes: ArrayBuffer };

export type Page = { limit: number; offset: number };

export interface AdminGateway {
  /** `probe`: one cheap request used for the access gate. */
  listUsers(filter: Page & { onlySuperadmins: boolean }): Promise<AdminUser[]>;
  patchUser(userId: string, patch: UserPatch): Promise<AdminUser>;
  listTeams(filter: Page & { includeDeleted: boolean }): Promise<AdminTeam[]>;
  createTeam(input: TeamInput): Promise<AdminTeam>;
  patchTeam(teamId: string, patch: TeamPatch): Promise<AdminTeam>;
  deleteTeam(teamId: string): Promise<AdminTeam>;
  restoreTeam(teamId: string): Promise<AdminTeam>;
  uploadTeamLogo(teamId: string, file: LogoFile): Promise<string>;
  searchTeams(query: string, limit?: number): Promise<TeamOption[]>;
  listJornadas(filter: Page & { includeDeleted: boolean; status: AdminJornadaStatus | null }): Promise<AdminJornada[]>;
  getJornada(jornadaId: string): Promise<AdminJornada>;
  patchJornada(jornadaId: string, patch: JornadaPatch): Promise<AdminJornada>;
  transitionJornada(jornadaId: string, transition: JornadaTransition, body?: { saleOpensAt: string }): Promise<AdminJornada>;
  deleteJornada(jornadaId: string): Promise<AdminJornada>;
  listComposicion(jornadaId: string): Promise<AdminComposicionRow[]>;
  patchComposicion(jornadaId: string, position: number, patch: ComposicionPatch): Promise<AdminComposicionRow>;
  ingestQuiniwin(request: IngestRequest): Promise<IngestReport>;
}

export type ActionState = { status: "idle" | "saved" | "error"; message: string; fields?: Record<string, string> };
export const initialActionState: ActionState = { status: "idle", message: "" };

/** Client-side filter over an already loaded team page: name, short name, entity id, country and competition. */
export function filterTeams<T extends Pick<AdminTeam, "name" | "shortName" | "entityId" | "country" | "competitionId">>(teams: readonly T[], query: string): T[] {
  const needle = normalizeSearch(query);
  if (!needle) return [...teams];
  return teams.filter(team => [team.name, team.shortName ?? "", team.entityId, team.country ?? "", team.competitionId].some(value => normalizeSearch(value).includes(needle)));
}

export function normalizeSearch(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
}

/** Pagination from a page that was fetched with `limit + 1` rows to learn whether a next page exists. */
export function paginate<T>(rows: readonly T[], pageSize: number): { items: T[]; hasNext: boolean } {
  return { items: rows.slice(0, pageSize), hasNext: rows.length > pageSize };
}

export function pageOf(value: unknown): number {
  const parsed = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : 1;
  return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= 10000 ? parsed : 1;
}
