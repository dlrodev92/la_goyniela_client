export type AdminJornadaStatus = "draft" | "active" | "past";

export const STATUS_LABELS: Record<AdminJornadaStatus, string> = { draft: "Borrador", active: "Activa", past: "Pasada" };
export const ADMIN_STATUS_FILTERS: readonly { status: AdminJornadaStatus; label: string }[] = [
  { status: "draft", label: "Borrador" }, { status: "active", label: "Activa" }, { status: "past", label: "Pasada" },
];

export function parseAdminStatus(value: unknown): AdminJornadaStatus | null {
  return value === "draft" || value === "active" || value === "past" ? value : null;
}
