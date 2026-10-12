import "server-only";
import { createResultsGateway } from "../infrastructure/http-results-gateway";
import { authenticatedApi } from "../../shared/server/authenticated-api";

export async function resultsGateway() {
  const { baseUrl, token } = await authenticatedApi();
  return createResultsGateway(baseUrl, token);
}
