import "server-only";
import { cookies } from "next/headers";
import { PENDING_JOIN_COOKIE, postAuthPath } from "../../groups/domain/groups";

export const pendingJoinCookieOptions = {
  httpOnly: true, secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 24,
};

export async function setPendingJoinCode(code: string) {
  (await cookies()).set(PENDING_JOIN_COOKIE, code, pendingJoinCookieOptions);
}

/** Read-only (safe in page renders, which cannot write cookies): the post-auth target for the pending invite. */
export async function peekPostAuthPath(): Promise<string> {
  return postAuthPath((await cookies()).get(PENDING_JOIN_COOKIE)?.value);
}

/** Server Actions and Route Handlers only: returns the post-auth target and drops the invite cookie (single use). */
export async function consumePostAuthPath(): Promise<string> {
  const jar = await cookies();
  const value = jar.get(PENDING_JOIN_COOKIE)?.value;
  if (value !== undefined) jar.set(PENDING_JOIN_COOKIE, "", { ...pendingJoinCookieOptions, maxAge: 0 });
  return postAuthPath(value);
}
