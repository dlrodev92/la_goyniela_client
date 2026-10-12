/** Inline banner for a list that could not be loaded (rate limit, upstream down). Nothing is retried automatically. */
export function LoadError({ message, rateLimited }: { message: string; rateLimited: boolean }) {
  return (
    <div role={rateLimited ? "status" : "alert"} className={`rounded-md border px-3 py-2 text-label ${rateLimited ? "border-warning/40 text-warning" : "border-danger/40 text-danger"}`}>
      <p className="font-medium">{rateLimited ? "Has llegado al límite de solicitudes" : "No hemos podido cargar los datos"}</p>
      <p className="text-fg-muted">{message}</p>
    </div>
  );
}
