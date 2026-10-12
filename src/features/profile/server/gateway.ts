import "server-only";
import { createProfileGateway } from "../infrastructure/http-profile-gateway";
import { authenticatedApi } from "../../shared/server/authenticated-api";

export async function profileGateway() {
  const { baseUrl, token } = await authenticatedApi();
  return createProfileGateway(baseUrl, token);
}
