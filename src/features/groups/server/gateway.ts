import "server-only";
import { createGroupsGateway } from "../infrastructure/http-groups-gateway";
import { authenticatedApi } from "../../shared/server/authenticated-api";

export async function groupsGateway() {
  const { baseUrl, token } = await authenticatedApi();
  return createGroupsGateway(baseUrl, token);
}
