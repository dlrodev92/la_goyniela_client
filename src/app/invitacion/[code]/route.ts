import { NextResponse } from "next/server";
import { appOrigin } from "@/features/auth/server/oauth-config";
import { setPendingJoinCode } from "@/features/auth/server/post-auth";
import { SESSION_COOKIE } from "@/features/auth/server/session";
import { joinPathFor, parseInviteCode } from "@/features/groups/domain/groups";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

/**
 * Public invite link. Remembers the code in a short-lived cookie so it survives sign-up, login and OAuth,
 * then sends visitors to register, or straight to the prefilled join page when a session cookie exists
 * (a stale session bounces through requireUser to /login, and the cookie carries the code from there).
 */
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const code = parseInviteCode((await params).code);
  const hasSession = Boolean((await cookies()).get(SESSION_COOKIE)?.value);
  let to: string;
  if (!code) to = hasSession ? "/groups/join" : "/register";
  else {
    await setPendingJoinCode(code);
    to = hasSession ? joinPathFor(code) : "/register?invite=1";
  }
  return NextResponse.redirect(new URL(to, appOrigin() ?? request.url), 302);
}
