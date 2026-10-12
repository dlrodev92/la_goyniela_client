const formatter = new Intl.DateTimeFormat("es-ES", {
  weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  timeZone: "Europe/Madrid", timeZoneName: "short",
});

/** Fixed Madrid time keeps server renders deterministic; the quiniela is a Spanish product. */
export function formatDateTime(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : formatter.format(date);
}

const dayFormatter = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Madrid" });

export function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : dayFormatter.format(date);
}
