// The same red/amber/green severity scale every other risk/health indicator
// in the app uses (RiskPill, healthColor, riskWarningColor) — not the
// chart-series palette, which is for distinguishing lines/bars, not for
// communicating severity. The reasons are already sorted worst-first (GET
// /dashboard/command-center's own top_failure_reasons order), so this bands
// by rank: the top third are the most significant drivers right now.
function severityColor(index: number, total: number): string {
  const ratio = total <= 1 ? 0 : index / (total - 1);
  if (ratio <= 0.33) return "var(--status-critical)";
  if (ratio <= 0.66) return "var(--status-warning)";
  return "var(--status-good)";
}

/**
 * Shows GET /dashboard/command-center's `top_failure_reasons` exactly as the
 * platform reports it — the raw signal name, count and percent, unmodified.
 */
export function FailureReasonsPanel({
  reasons,
}: {
  reasons: { reason: string; count: number; pct: number }[];
}) {
  if (reasons.length === 0) {
    return <p className="text-[13px] text-text-muted">No failure signals reported.</p>;
  }

  return (
    <ul className="-my-0.5 divide-y divide-[var(--border-hairline)]">
      {reasons.map((r, i) => (
        <li key={r.reason} className="flex items-center justify-between gap-3 py-2.5">
          <span className="flex min-w-0 flex-1 items-center gap-2" title={r.reason}>
            <span
              className="h-2 w-2 flex-none rounded-full"
              style={{ backgroundColor: severityColor(i, reasons.length) }}
            />
            <span className="truncate text-[13px] font-medium text-text-primary">{r.reason}</span>
          </span>
          <span className="flex-none tabular-nums text-[12px] text-text-muted">{r.count.toLocaleString()}</span>
          <span className="flex-none w-11 text-right text-[13px] font-semibold tabular-nums text-text-primary">
            {r.pct.toFixed(1)}%
          </span>
        </li>
      ))}
    </ul>
  );
}
