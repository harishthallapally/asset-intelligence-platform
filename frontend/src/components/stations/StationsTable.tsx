"use client";

import Link from "next/link";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { HealthBar } from "@/components/ui/HealthBar";
import { RiskPill } from "@/components/ui/RiskPill";
import type { StationRow } from "@/lib/api/normalise";

// Same structure as BatteriesTable — Condition/Health Score/Anomaly/Risk/
// Priority/Likely Issue, sourced from GET /stations/scores.
const CLASSIFICATION_TONE: Record<string, string> = {
  HEALTHY: "var(--status-good)",
  WATCH: "var(--status-warning)",
  AT_RISK: "var(--status-serious)",
  CRITICAL: "var(--status-critical)",
};

function classificationLabel(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const BAND_MEMBERS: Record<string, string[]> = {
  HEALTHY: ["HEALTHY"],
  WARNING: ["WATCH", "AT_RISK"],
  CRITICAL: ["CRITICAL"],
};

function bandOf(classification: string | null): string | null {
  if (!classification) return null;
  const value = classification.toUpperCase();
  const entry = Object.entries(BAND_MEMBERS).find(([, members]) => members.includes(value));
  return entry ? entry[0] : null;
}

export function StationsTable({ rows }: { rows: StationRow[] }) {
  const columns: Column<StationRow>[] = [
    {
      key: "stationId",
      header: "Station ID",
      headerClassName: "w-[11%]",
      sortValue: (r) => r.stationId,
      render: (r) => (
        <Link
          href={`/stations/${r.stationId}`}
          className="font-medium text-[var(--series-1)] hover:underline"
        >
          {r.stationId}
        </Link>
      ),
    },
    {
      // From GET /stations/scores, merged in separately — "—" if that call
      // fails while /stations itself still succeeds.
      key: "classification",
      header: "Condition",
      headerClassName: "w-[11%]",
      sortValue: (r) => r.healthClassification ?? "",
      render: (r) =>
        r.healthClassification ? (
          <span
            className="font-medium"
            style={{ color: CLASSIFICATION_TONE[r.healthClassification.toUpperCase()] ?? "var(--text-secondary)" }}
          >
            {classificationLabel(r.healthClassification)}
          </span>
        ) : (
          <span className="text-text-muted">—</span>
        ),
    },
    {
      // The station's own AI-scored health (GET /stations' health_score) —
      // not avgHealthScore, the plain average of its docks, which is a
      // different, usually higher, number.
      key: "health",
      header: "Health Score",
      headerClassName: "w-[15%]",
      sortValue: (r) => r.healthScore ?? -1,
      render: (r) => (r.healthScore !== null ? <HealthBar score={r.healthScore} /> : <span className="text-text-muted">—</span>),
    },
    {
      key: "anomaly",
      header: "Anomaly",
      align: "right",
      headerClassName: "w-[9%]",
      sortValue: (r) => r.anomalyScore ?? -1,
      render: (r) =>
        r.anomalyScore !== null ? (
          <span className="tabular-nums" title={r.anomalySeverity ?? undefined}>
            {Math.round(r.anomalyScore)}
          </span>
        ) : (
          <span className="text-text-muted">—</span>
        ),
    },
    {
      key: "risk",
      header: "Risk",
      headerClassName: "w-[11%]",
      sortValue: (r) => r.riskScore ?? -1,
      render: (r) =>
        r.riskScore !== null && r.riskCategoryRaw ? (
          <RiskPill percent={r.riskScore} category={r.riskCategoryRaw} />
        ) : (
          <span className="text-text-muted">—</span>
        ),
    },
    {
      key: "priority",
      header: "Priority",
      headerClassName: "w-[9%]",
      sortValue: (r) => r.priority ?? "",
      render: (r) => <span className="tabular-nums text-text-secondary">{r.priority ?? "—"}</span>,
    },
    {
      key: "issue",
      header: "Likely Issue",
      headerClassName: "w-[34%]",
      sortValue: (r) => r.likelyIssue ?? "",
      render: (r) =>
        r.likelyIssue ? (
          <span className="block max-w-[280px] truncate" title={r.likelyIssue}>
            {r.likelyIssue}
          </span>
        ) : (
          <span className="text-text-muted">—</span>
        ),
    },
  ];

  const countOf = (band: string) => rows.filter((r) => bandOf(r.healthClassification) === band).length;

  return (
    <DataTable
      rows={rows}
      columns={columns}
      rowKey={(r) => r.stationId}
      rowHref={(r) => `/stations/${r.stationId}`}
      searchFields={(r) => [r.stationId, r.name, r.likelyIssue ?? "", r.riskCategoryRaw ?? "", r.priority ?? ""]}
      searchPlaceholder="Search station, issue or priority…"
      filters={{
        options: [
          { value: "HEALTHY", label: "Healthy", count: countOf("HEALTHY") },
          { value: "WARNING", label: "Warning", count: countOf("WARNING") },
          { value: "CRITICAL", label: "Critical", count: countOf("CRITICAL") },
        ],
        predicate: (r, value) => bandOf(r.healthClassification) === value,
      }}
      initialSort={{ key: "risk", direction: "desc" }}
      pageSize={15}
    />
  );
}
