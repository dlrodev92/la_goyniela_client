import { notFound, redirect } from "next/navigation";
import { isRouteId } from "@/lib/route-id";

/** Legacy route: the jornada opens expanded inside the single superadmin page. */
export default async function Page({ params }: { params: Promise<{ jornadaId: string }> }) {
  const { jornadaId } = await params;
  if (!isRouteId(jornadaId)) notFound();
  redirect(`/superadmin?tab=jornadas&abrir=${jornadaId}`);
}
