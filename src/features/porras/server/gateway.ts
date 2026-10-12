import "server-only";
import { createPorrasGateway } from "../infrastructure/http-porras-gateway";
import { authenticatedApi } from "../../shared/server/authenticated-api";

export async function porrasGateway() {
  const { baseUrl, token } = await authenticatedApi();
  return createPorrasGateway(baseUrl, token);
}
