"use client";

import Link from "next/link";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { HealthBar } from "@/components/ui/HealthBar";
import { PredictionCell } from "@/components/ui/PredictionCell";
import { RiskPill } from "@/components/ui/RiskPill";
import type { ChargerRow } from "@/lib/api/normalise";

// Same structure as BatteriesTable — Condition/Health Score/Anomaly/Risk/
// Priority/Likely Issue. There is no per-charger scoring endpoint, so these
// are the AI scores of the dock each charger sits on (see resources.ts's
// `deriveDockAssetId`), not the charger itself.
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

export function ChargersTable({ rows }: { rows: ChargerRow[] }) {
  const columns: Column<ChargerRow>[] = [
    {
      key: "chargerId",
      header: "Charger ID",
      headerClassName: "w-[9%]",
      sortValue: (r) => r.chargerId,
      render: (r) => (
        <Link
          href={`/chargers/${r.chargerId}?station=${r.stationId}`}
          className="font-medium text-[var(--series-1)] hover:underline"
        >
          {r.chargerId}
        </Link>
      ),
    },
    {
      key: "classification",
      header: "Condition",
      headerClassName: "w-[10%]",
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
      key: "health",
      header: "Health Score",
      headerClassName: "w-[14%]",
      sortValue: (r) => r.healthScore ?? -1,
      render: (r) => (r.healthScore !== null ? <HealthBar score={r.healthScore} /> : <span className="text-text-muted">—</span>),
    },
    {
      key: "anomaly",
      header: "Anomaly",
      align: "right",
      headerClassName: "w-[8%]",
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
      headerClassName: "w-[10%]",
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
      headerClassName: "w-[8%]",
      sortValue: (r) => r.priority ?? "",
      render: (r) => <span className="tabular-nums text-text-secondary">{r.priority ?? "—"}</span>,
    },
    {
      key: "issue",
      header: "Likely Issue",
      headerClassName: "w-[32%]",
      sortValue: (r) => r.likelyIssue ?? "",
      render: (r) =>
        r.likelyIssue ? (
          <span className="block max-w-[220px] truncate" title={r.likelyIssue}>
            {r.likelyIssue}
          </span>
        ) : (
          <span className="text-text-muted">—</span>
        ),
    },
    {
      key: "prediction",
      header: "Asset Background",
      headerClassName: "w-[9%] whitespace-nowrap",
      // Lazily fetched per visible row (see useAssetInsight) — no bulk field
      // for this exists, so it can't be sorted without loading every row.
      render: (r) => <PredictionCell asset={{ type: "charger", id: r.chargerId, stationId: r.stationId }} />,
    },
  ];

  const countOf = (band: string) => rows.filter((r) => bandOf(r.healthClassification) === band).length;

  return (
    <DataTable
      rows={rows}
      columns={columns}
      // charger_id repeats across stations, so the station id (not shown as
      // its own column here, mirroring the battery table) still disambiguates
      // the row identity and its link.
      rowKey={(r) => `${r.stationId}-${r.chargerId}`}
      rowHref={(r) => `/chargers/${r.chargerId}?station=${r.stationId}`}
      searchFields={(r) => [r.chargerId, r.stationId, r.dockId, r.likelyIssue ?? "", r.riskCategoryRaw ?? "", r.priority ?? ""]}
      searchPlaceholder="Search charger, issue or priority…"
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
