/** HIGH/CRITICAL renders in red — a plain visual warning wherever an asset's
 * risk-driven text appears (AI Insight, condition labels), the same cut the
 * risk pills themselves use to colour. */
export function riskWarningColor(riskCategoryRaw: string): string {
  const category = riskCategoryRaw.toUpperCase();
  return category === "HIGH" || category === "CRITICAL" ? "var(--status-critical)" : "var(--text-primary)";
}

/** Keyed by the health classification label actually shown (AT_RISK/
 * CRITICAL -> red, WATCH -> amber, HEALTHY -> green) rather than a raw
 * health-score threshold — a station scoring, say, 70/100 but classified
 * AT_RISK should never read as green just because the number alone looks
 * fine. */
export function healthConditionColor(classification: string): string {
  const value = classification.toUpperCase();
  if (value === "AT_RISK" || value === "CRITICAL") return "var(--status-critical)";
  if (value === "WATCH") return "var(--status-warning)";
  return "var(--status-good)";
}
