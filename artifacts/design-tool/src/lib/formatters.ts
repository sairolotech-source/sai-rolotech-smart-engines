/**
 * Pure engineering formatter utilities.
 * Extracted for testability — all functions are side-effect free.
 *
 * Rules (from Codex 5.3 audit):
 *   - Missing required engineering data must render "N/A", never a fake numeric default.
 *   - Object values must never propagate into display strings.
 *   - Export rows must write "N/A" for missing, not "0.000".
 */

/**
 * Format a numeric engineering value as a fixed-decimal string.
 * Returns "N/A" if the value is null, undefined, or non-finite (NaN / Infinity).
 */
export function formatEngineeringMM(
  value: number | undefined | null,
  decimals = 3,
): string {
  if (value == null || !isFinite(value)) return "N/A";
  return value.toFixed(decimals);
}

/**
 * Same as formatEngineeringMM but appends " mm" unit suffix when value is present.
 * Returns "N/A" (no unit) when missing.
 */
export function formatEngineeringMMWithUnit(
  value: number | undefined | null,
  decimals = 3,
): string {
  if (value == null || !isFinite(value)) return "N/A";
  return `${value.toFixed(decimals)} mm`;
}

/**
 * Safely extract a human-readable string from a warning/error payload.
 * Handles: string, ValidationError { issue }, Error { message }, raw objects, null.
 * Never returns "[object Object]".
 */
export function safeWarningText(w: unknown): string {
  if (typeof w === "string") return w;
  if (w == null) return "";
  if (w instanceof Error) return w.message;
  if (typeof w === "object") {
    const o = w as Record<string, unknown>;
    if (typeof o.issue === "string") return o.issue;
    if (typeof o.message === "string") return o.message;
    if (typeof o.detail === "string") return o.detail;
    return JSON.stringify(o);
  }
  return String(w);
}

/**
 * Format a value for CSV export.
 * Required engineering values write "N/A" when missing — never a fake numeric default.
 */
export function formatExportMM(
  value: number | undefined | null,
  decimals = 3,
): string {
  if (value == null || !isFinite(value)) return "N/A";
  return value.toFixed(decimals);
}
