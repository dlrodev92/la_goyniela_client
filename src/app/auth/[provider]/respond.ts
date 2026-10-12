import { NextResponse } from "next/server";
import type { FlowResult } from "@/features/auth/server/oauth-flow";
import { appOrigin } from "@/features/auth/server/oauth-config";

/** Redirect using the configured public origin so proxies cannot skew the host. */
export function redirectFor(result: FlowResult, request: Request) {
  const base = result.external ? undefined : (appOrigin() ?? request.url);
  return NextResponse.redirect(base ? new URL(result.to, base) : result.to, 302);
}
