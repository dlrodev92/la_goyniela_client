import { notFound } from "next/navigation";
import { isOAuthProviderId } from "@/features/auth/domain/oauth";
import { completeOAuth } from "@/features/auth/server/oauth-flow";
import { redirectFor } from "../respond";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (!isOAuthProviderId(provider)) notFound();
  return redirectFor(await completeOAuth(provider, new URL(request.url).searchParams), request);
}
