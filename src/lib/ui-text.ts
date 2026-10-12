/** Up to two uppercase initials from a display name; "?" when empty. */
export function initialsOf(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => Array.from(part)[0]?.toUpperCase() ?? "");
  return letters.join("") || "?";
}

/** Typed-confirmation check: trimmed, case-sensitive match; an empty expectation never matches. */
export function matchesConfirmText(typed: string, expected: string): boolean {
  const target = expected.trim();
  return target.length > 0 && typed.trim() === target;
}

/** Clamps value/max into a whole 0..100 percentage; invalid max yields 0. */
export function progressPercent(value: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return 0;
  return Math.round(Math.min(Math.max(value, 0), max) / max * 100);
}

/** A share (0-100) rounded for display and clamped; invalid values yield 0. */
export function percentValue(value: number): number {
  return Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : 0;
}

const MINOR_WORDS = new Set(["de", "del", "la", "las", "el", "los", "y", "of", "the"]);

/**
 * 2 to 3 uppercase letters that stand for a team in the crest fallback.
 * Drops "(f)" style suffixes, abbreviation prefixes ("R.", "At.") and single-letter suffixes ("B"), and strips accents:
 * "R. Oviedo" -> "OVI", "Real Sociedad B" -> "RS", "Barcelona(f)" -> "BAR", "Celta Fortuna" -> "CF". "?" when empty.
 */
export function teamInitials(name: string): string {
  const cleaned = name.replace(/\([^)]*\)/g, " ").normalize("NFD").replace(/\p{M}/gu, "");
  let words = cleaned.split(/[\s\-/]+/).map(word => word.replace(/[^\p{L}\p{N}.]/gu, "")).filter(Boolean);
  const meaningful = (list: string[]) => list.filter(word => !word.endsWith(".") && !(word.length === 1 && /\p{L}/u.test(word)));
  const trimmed = meaningful(words);
  if (trimmed.length > 0) words = trimmed;
  words = words.map(word => word.replace(/\./g, "")).filter(Boolean);
  const significant = words.filter(word => !MINOR_WORDS.has(word.toLowerCase()));
  if (significant.length > 0) words = significant;
  if (words.length === 0) return "?";
  if (words.length === 1) return Array.from(words[0]).slice(0, 3).join("").toUpperCase();
  return words.slice(0, 3).map(word => Array.from(word)[0]).join("").toUpperCase();
}
