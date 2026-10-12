export type SuperadminTab = "jornadas" | "equipos" | "usuarios";

export const SUPERADMIN_TABS: readonly { key: SuperadminTab; label: string }[] = [
  { key: "jornadas", label: "Jornadas" }, { key: "equipos", label: "Equipos" }, { key: "usuarios", label: "Usuarios" },
];

/** The `?tab=` value, defaulting to Jornadas for anything unknown. */
export function parseTab(value: unknown): SuperadminTab {
  return value === "equipos" || value === "usuarios" ? value : "jornadas";
}
