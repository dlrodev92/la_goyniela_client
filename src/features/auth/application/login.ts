import { z } from "zod";
import type { AuthGateway } from "../domain/auth";
import { ServiceError } from "../../../lib/http/errors";

const credentialsSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(1024),
});

export async function login(gateway: AuthGateway, input: unknown) {
  const result = credentialsSchema.safeParse(input);
  if (!result.success) throw new ServiceError("validation");
  const session = await gateway.login(result.data);
  if (!session.user.isActive) throw new ServiceError("credentials");
  return session;
}
