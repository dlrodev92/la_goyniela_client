/**
 * Parses the provider's money strings: Spanish "1.234,50", plain "1500000" or "0.75".
 * A comma marks the Spanish form (dots are thousands separators); otherwise the dot is the decimal separator.
 * Returns null for anything that is not a finite non-negative number.
 */
export function parseAmount(raw: string | null | undefined): number | null {
  const value = raw?.trim();
  if (!value) return null;
  const normalized = value.includes(",") ? value.replace(/\./g, "").replace(",", ".") : value;
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

const whole = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 });
const cents = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "1.500.000 €" / "0,75 €"; null when the amount cannot be parsed. `fixed` forces two decimals (unit prices). */
export function formatEuro(raw: string | null | undefined, options: { fixed?: boolean } = {}): string | null {
  const amount = parseAmount(raw);
  if (amount === null) return null;
  return `${(options.fixed ? cents : whole).format(amount)} €`;
}
