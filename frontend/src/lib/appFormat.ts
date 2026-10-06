export function label(value: string | null): string {
  if (!value) return "—";
  return value
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function platformLabel(row: { platform: string; osMajor: number | null }): string {
  const name = row.platform.toUpperCase() === "IOS" ? "iOS" : label(row.platform);
  return row.osMajor != null ? `${name} ${row.osMajor}` : name;
}

export const CLASSIFICATION_TONE: Record<string, string> = {
  HEALTHY: "var(--status-good)",
  WATCH: "var(--status-warning)",
  AT_RISK: "var(--status-serious)",
  CRITICAL: "var(--status-critical)",
};
