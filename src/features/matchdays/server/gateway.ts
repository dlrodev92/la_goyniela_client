import "server-only";
import { createMatchdaysGateway } from "../infrastructure/http-matchdays-gateway";
import { authenticatedApi } from "../../shared/server/authenticated-api";

export async function matchdaysGateway() {
  const { baseUrl, token } = await authenticatedApi();
  return createMatchdaysGateway(baseUrl, token);
}
