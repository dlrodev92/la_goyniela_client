const TIME_ZONE = "Europe/Madrid";
const LOCAL_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

const parts = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
});

function wallClock(instant: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const part of parts.formatToParts(new Date(instant))) if (part.type !== "literal") out[part.type] = Number(part.value);
  return out;
}

/** Offset of Europe/Madrid from UTC at an instant, in minutes (+60 winter, +120 summer). */
export function madridOffsetMinutes(instant: number): number {
  const w = wallClock(instant);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return Math.round((asUtc - Math.floor(instant / 1000) * 1000) / 60000);
}

const pad = (value: number, size = 2) => String(value).padStart(size, "0");
function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? "-" : "+";
  const abs = Math.abs(minutes);
  return `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

/**
 * `datetime-local` value ("2026-10-25T21:00", Madrid wall clock) -> ISO 8601 with the right Madrid offset
 * ("2026-10-25T21:00:00+01:00"). Null when the text is malformed or the time does not exist (spring-forward gap).
 * An ambiguous time (autumn overlap) resolves to its first occurrence, the summer-time one.
 */
export function madridLocalToIso(local: string): string | null {
  const match = LOCAL_PATTERN.exec(local.trim());
  if (!match) return null;
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  const check = new Date(wall);
  // Rejects overflowed dates such as 2026-02-31 or 25:00.
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day
    || check.getUTCHours() !== hour || check.getUTCMinutes() !== minute) return null;
  const candidates = new Set([madridOffsetMinutes(wall - 120 * 60000), madridOffsetMinutes(wall - 60 * 60000)]);
  const valid = [...candidates].filter(offset => madridOffsetMinutes(wall - offset * 60000) === offset).sort((a, b) => b - a);
  if (valid.length === 0) return null;
  return `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:00${formatOffset(valid[0])}`;
}

/** ISO instant -> `datetime-local` value in Madrid wall-clock time. Empty string for null or an unreadable date. */
export function isoToMadridLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const instant = Date.parse(iso);
  if (Number.isNaN(instant)) return "";
  const w = wallClock(instant);
  return `${pad(w.year, 4)}-${pad(w.month)}-${pad(w.day)}T${pad(w.hour)}:${pad(w.minute)}`;
}

const shortFormatter = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: TIME_ZONE });

/** Compact Madrid wall-clock text for dense tables ("10 oct, 16:00"); an em dash for null or an unreadable date. */
export function formatShortMadrid(iso: string | null | undefined): string {
  if (!iso) return "—";
  const instant = Date.parse(iso);
  return Number.isNaN(instant) ? "—" : shortFormatter.format(new Date(instant));
}

const dayFormatter = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", year: "numeric", timeZone: TIME_ZONE });

/** Compact Madrid calendar day ("8 oct 2026"); an em dash for null or an unreadable date. */
export function formatDayMadrid(iso: string | null | undefined): string {
  if (!iso) return "—";
  const instant = Date.parse(iso);
  return Number.isNaN(instant) ? "—" : dayFormatter.format(new Date(instant));
}
