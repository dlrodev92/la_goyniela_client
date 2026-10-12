/** Number of decimals `value` needs, clamped to [min, max] (e.g. 0.75 -> 2, 12 -> 0, 0.5 with min 2 -> 2). */
export function decimalsOf(value: number, min = 0, max = 2): number {
  if (!Number.isFinite(value)) return min;
  const rounded = Number(value.toFixed(max));
  const needed = rounded.toString().split(".")[1]?.length ?? 0;
  return Math.min(Math.max(needed, min), max);
}

/** es-ES formatting with a fixed number of decimals: 1234.5, 2 -> "1.234,50". */
export function formatNumber(value: number, decimals: number): string {
  return new Intl.NumberFormat("es-ES", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value);
}
