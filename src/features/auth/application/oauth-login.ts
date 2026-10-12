import { z } from "zod";
import type { AuthGateway } from "../domain/auth";
import type { OAuthProviderId } from "../domain/oauth";
import { ServiceError } from "../../../lib/http/errors";

const providerTokenSchema = z.string().min(1).max(8192);

export async function loginWithProvider(gateway: AuthGateway, provider: OAuthProviderId, providerToken: unknown) {
  const token = providerTokenSchema.safeParse(providerToken);
  if (!token.success) throw new ServiceError("validation");
  const session = await gateway.loginWithProvider(provider, token.data);
  if (!session.user.isActive) throw new ServiceError("provider");
  return session;
}
