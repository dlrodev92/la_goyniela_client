import "server-only";
import { z } from "zod";
import type { AuthGateway, User } from "../domain/auth";
import { createJsonClient } from "../../../lib/http/json-client";

const userSchema = z.object({
  id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  email: z.string().email(),
  display_name: z.string(),
  avatar_url: z.string().url().nullable(),
  // The real backend UserOut omits `is_active` and `created_at` (API.md documents them); inactive
  // accounts are rejected server-side (401/403), so a missing flag means active.
  is_active: z.boolean().default(true),
  // Not served by the live UserOut yet (contract §6.2 says it will be); absent means a regular user.
  is_superadmin: z.boolean().default(false),
  created_at: z.string().datetime({ offset: true }).nullable().optional(),
});
const sessionSchema = z.object({
  access_token: z.string().min(1).max(3500).regex(/^[A-Za-z0-9._~-]+$/),
  // Backend emits "Bearer"; the scheme is case-insensitive (RFC 6750).
  token_type: z.string().refine((value) => value.toLowerCase() === "bearer"),
  user: userSchema,
});

function toUser(wire: z.infer<typeof userSchema>): User {
  return { id: String(wire.id), email: wire.email, displayName: wire.display_name,
    avatarUrl: wire.avatar_url, isActive: wire.is_active, isSuperadmin: wire.is_superadmin, createdAt: wire.created_at ?? null };
}

export function createAuthGateway(baseUrl: string, fetcher: typeof fetch = fetch, timeoutMs?: number): AuthGateway {
  const request = createJsonClient(baseUrl, fetcher, timeoutMs);
  return {
    async login(credentials) {
      const result = await request("/auth/login", sessionSchema, { method: "POST", body: credentials, login: true });
      return { accessToken: result.access_token, user: toUser(result.user) };
    },
    async register(registration) {
      // 409 = email already registered (the backend `detail` echoes the email and is never surfaced).
      const body = { email: registration.email, password: registration.password, display_name: registration.displayName };
      const result = await request("/auth/register", sessionSchema, { method: "POST", body, statusMap: { 409: "email-taken" } });
      return { accessToken: result.access_token, user: toUser(result.user) };
    },
    async loginWithProvider(provider, providerToken) {
      // Never surface the backend `detail`.
      // 401 = the provider rejected the credentials; 502 = the provider itself (X) is down.
      const body = provider === "google" ? { id_token: providerToken } : { access_token: providerToken };
      const result = await request(`/auth/${provider}`, sessionSchema, { method: "POST", body, unauthorizedAs: "provider", statusMap: { 502: "provider-down" } });
      return { accessToken: result.access_token, user: toUser(result.user) };
    },
    async currentUser(token) {
      return toUser(await request("/auth/me", userSchema, { token }));
    },
  };
}
