import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAuthGateway } from "../infrastructure/http-auth-gateway";
import { apiBaseUrl } from "./config";
import { ServiceError } from "../../../lib/http/errors";

export const SESSION_COOKIE = "goyniela_session";
export const cookieOptions = {
  httpOnly: true, secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 24,
};

/** Reads the session token for server-side API calls; redirects to /login when absent. */
export async function requireSessionToken(): Promise<string> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) redirect("/login");
  return token;
}

export const requireUser = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) redirect("/login");
  try {
    const user = await createAuthGateway(apiBaseUrl()).currentUser(token);
    if (!user.isActive) redirect("/login");
    return user;
  } catch (error) {
    if (error instanceof ServiceError && error.code === "unauthenticated") redirect("/login");
    throw error;
  }
});

export async function setSessionCookie(token: string) {
  (await cookies()).set(SESSION_COOKIE, token, cookieOptions);
}

/** The signed-in user, or null for anonymous visitors and stale sessions (never redirects). */
export async function getOptionalUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const user = await createAuthGateway(apiBaseUrl()).currentUser(token);
    return user.isActive ? user : null;
  } catch (error) {
    if (error instanceof ServiceError && error.code === "unauthenticated") return null;
    throw error;
  }
}
