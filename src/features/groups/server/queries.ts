import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { getGroup, listGroups } from "../application/groups";
import { groupsGateway } from "./gateway";
import { withSession } from "../../shared/server/authenticated-api";
import { ServiceError } from "../../../lib/http/errors";
import { isRouteId } from "../../../lib/route-id";

/** My groups. Failures other than an invalid session bubble to the route error boundary. */
export const loadMyGroups = cache(async () => withSession(async () => listGroups(await groupsGateway())));

/**
 * One group for the caller. The backend answers 403 "not a member of this group" for non-members, which sends them to
 * the forbidden page ("No perteneces a esta peña"); an unknown group is a 404 and renders the standard not-found page.
 */
export const loadGroup = cache(async (groupId: string) => {
  if (!isRouteId(groupId)) notFound();
  try {
    return await withSession(async () => getGroup(await groupsGateway(), groupId));
  } catch (error) {
    if (error instanceof ServiceError && error.code === "not-found") notFound();
    if (error instanceof ServiceError && error.code === "forbidden") redirect("/forbidden");
    throw error;
  }
});
