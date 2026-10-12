import { z } from "zod";

/**
 * Optional embedded team (`local_team` / `visitante_team`) the backend will send once B1 ships.
 * Unknown fields are ignored; every field but `logo_url` is optional so a partial payload still parses.
 */
export const teamRefSchema = z.object({
  id: z.number().int().optional(),
  name: z.string().nullable().optional(),
  canonical_name: z.string().nullable().optional(),
  short_name: z.string().nullable().optional(),
  logo_url: z.string().nullable().optional(),
  /** Soft-delete instant; the team is still rendered (past fixtures keep their crest). */
  deleted_at: z.string().nullable().optional(),
});

export type TeamRefWire = z.infer<typeof teamRefSchema>;

/** Only absolute http(s) URLs are usable by next/image; relative provider paths (404 today) become null. */
export function logoUrlOf(team: TeamRefWire | null | undefined): string | null {
  const url = team?.logo_url?.trim();
  return url && /^https?:\/\//i.test(url) ? url : null;
}

const clean = (value: string | null | undefined) => value?.trim() || null;

/** Full club name: `canonical_name` (backend) with `name` as the legacy alias. */
export function fullNameOf(team: TeamRefWire | null | undefined): string | null {
  return clean(team?.canonical_name) ?? clean(team?.name);
}

export function shortNameOf(team: TeamRefWire | null | undefined): string | null {
  return clean(team?.short_name);
}
