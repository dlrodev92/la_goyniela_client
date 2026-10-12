import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/features/auth/server/session";
import { BoletoScreen } from "@/features/porras/components/sheet/boleto-screen";
import { isRouteId } from "@/lib/route-id";

export const metadata: Metadata = { title: "Mi boleto" };

/** The boleto opened over the porra page: same data as the full page, rendered as a sheet. */
export default async function Page({ params }: { params: Promise<{ groupId: string; porraId: string }> }) {
  await requireUser();
  const { groupId, porraId } = await params;
  if (!isRouteId(groupId) || !isRouteId(porraId)) notFound();
  return <BoletoScreen groupId={groupId} porraId={porraId} variant="modal" />;
}
