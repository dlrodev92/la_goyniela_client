import "server-only";
import { createAdminGateway } from "../infrastructure/http-admin-gateway";
import { authenticatedApi } from "../../shared/server/authenticated-api";

export async function adminGateway() {
  const { baseUrl, token } = await authenticatedApi();
  return createAdminGateway(baseUrl, token);
}
