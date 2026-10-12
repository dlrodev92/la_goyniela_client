import { loadBoletoPdf } from "@/features/porras/application/porras";
import { porrasGateway } from "@/features/porras/server/gateway";
import { withSession } from "@/features/shared/server/authenticated-api";
import { ServiceError } from "@/lib/http/errors";
import { isRouteId } from "@/lib/route-id";

/** Per-request and per-user: the PDF is never cached or shared. */
export const dynamic = "force-dynamic";

const text = (message: string, status: number) =>
  new Response(message, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "private, no-store" } });

/**
 * BFF download of the peña's final boleto as a PDF. The session token stays in the HttpOnly cookie: it is read here on the
 * server and sent to the API, and the PDF is streamed back with the API's Content-Type and Content-Disposition. Any member
 * can download it; no boleto is a 404 and a non-member a 403, as the API answers. An expired session goes to /login.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ groupId: string; porraId: string }> }) {
  const { groupId, porraId } = await params;
  if (!isRouteId(groupId) || !isRouteId(porraId)) return text("No hemos encontrado ese boleto.", 404);
  try {
    const pdf = await withSession(async () => loadBoletoPdf(await porrasGateway(), groupId, porraId), { clearCookie: true });
    return new Response(pdf.body, {
      status: 200,
      headers: {
        "Content-Type": pdf.contentType,
        "Content-Disposition": pdf.contentDisposition ?? `attachment; filename="boleto-${porraId}.pdf"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    // Redirects (expired session) and bugs must not become a PDF error response.
    if (!(error instanceof ServiceError)) throw error;
    if (error.code === "not-found") return text("Todavía no hay boleto de la peña para descargar.", 404);
    if (error.code === "forbidden") return text("No perteneces a esta peña, así que no puedes descargar su boleto.", 403);
    return text("No hemos podido generar el PDF ahora mismo. Inténtalo de nuevo.", error.code === "timeout" ? 504 : 502);
  }
}
