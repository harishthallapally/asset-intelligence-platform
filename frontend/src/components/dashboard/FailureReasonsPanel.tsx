// Same 8-color series palette the charts use, so each reason gets a distinct,
// theme-aware color without inventing a second palette.
const ROW_COLORS = [
  "var(--series-2)",
  "var(--series-1)",
  "var(--series-7)",
  "var(--series-2)",
  "var(--series-1)",
  "var(--series-3)",
  "var(--series-4)",
  "var(--series-5)",
];

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
          <span
            className="min-w-0 flex-1 truncate text-[13px] font-medium"
            style={{ color: ROW_COLORS[i % ROW_COLORS.length] }}
            title={r.reason}
          >
            {r.reason}
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
