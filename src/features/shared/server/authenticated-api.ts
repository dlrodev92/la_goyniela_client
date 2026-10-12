import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { apiBaseUrl } from "../../auth/server/config";
import { SESSION_COOKIE, cookieOptions, requireSessionToken } from "../../auth/server/session";
import { ServiceError } from "../../../lib/http/errors";

/** Resolves the API base URL and the caller's session token (redirects to /login without one). */
export async function authenticatedApi(): Promise<{ baseUrl: string; token: string }> {
  return { baseUrl: apiBaseUrl(), token: await requireSessionToken() };
}

/**
 * Runs an authenticated API call. An invalid session (401) redirects to /login; in server
 * actions (`clearCookie: true`) the stale cookie is cleared first, which Server Component
 * renders are not allowed to do. Every other failure propagates as a ServiceError.
 */
export async function withSession<T>(call: () => Promise<T>, options: { clearCookie?: boolean } = {}): Promise<T> {
  try {
    return await call();
  } catch (error) {
    if (!(error instanceof ServiceError) || error.code !== "unauthenticated") throw error;
  }
  if (options.clearCookie) (await cookies()).set(SESSION_COOKIE, "", { ...cookieOptions, maxAge: 0 });
  redirect("/login");
}
