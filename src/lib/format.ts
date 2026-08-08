/** Small formatting helpers used across the Testing hub UI. */

/** Coerce a `string | number | null | undefined` (Prisma Decimals arrive as
 *  strings) into a finite number, defaulting to 0. */
export function toNum(value: string | number | null | undefined): number {
  if (value == null) return 0;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Format a percentage with a sign, e.g. `+12.3%`. */
export function pct(value: string | number | null | undefined, dp = 1): string {
  const n = toNum(value);
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(dp)}%`;
}

/** Format a plain number to a fixed number of decimals. */
export function num(value: string | number | null | undefined, dp = 2): string {
  return toNum(value).toFixed(dp);
}

/** Format a money amount with thousands separators (no currency symbol). */
export function money(value: string | number | null | undefined, dp = 0): string {
  return toNum(value).toLocaleString(undefined, {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  });
}

/** A compact date-time label from an ISO string. */
export function dateLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: "2-digit",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Tailwind text colour class for a positive / negative / neutral value. */
export function signColor(value: string | number | null | undefined): string {
  const n = toNum(value);
  if (n > 0) return "text-success";
  if (n < 0) return "text-error";
  return "text-slate-300";
}
