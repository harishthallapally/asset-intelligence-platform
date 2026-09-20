"use client";

import Link from "next/link";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { HealthBar } from "@/components/ui/HealthBar";
import { RiskPill } from "@/components/ui/RiskPill";
import type { VehicleRow } from "@/lib/api/normalise";

const CLASSIFICATION_TONE: Record<string, string> = {
  HEALTHY: "var(--status-good)",
  WATCH: "var(--status-warning)",
  AT_RISK: "var(--status-serious)",
  CRITICAL: "var(--status-critical)",
};

function classificationLabel(value: string | null): string {
  if (!value) return "—";
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

/**
 * The vehicle register — each row's own registration number ("KA01AA1000",
 * the vehicle's actual number-plate code) is shown alongside the internal
 * asset id, since that's what a field team recognises the vehicle by.
 */
export function VehiclesTable({ rows }: { rows: VehicleRow[] }) {
  const columns: Column<VehicleRow>[] = [
    {
      key: "assetId",
      header: "Vehicle",
      sortValue: (r) => r.assetId,
      render: (r) => (
        <Link href={`/vehicles/${r.assetId}`} className="font-medium text-[var(--series-1)] hover:underline">
          {r.assetId}
        </Link>
      ),
    },
    {
      key: "registrationNumber",
      header: "Vehicle Code",
      sortValue: (r) => r.registrationNumber ?? "",
      render: (r) => (
        <span className="font-mono text-[12.5px] font-medium tracking-wide text-text-primary">
          {r.registrationNumber ?? "—"}
        </span>
      ),
    },
    {
      key: "homeStation",
      header: "Home Station",
      sortValue: (r) => r.homeStationId ?? "",
      render: (r) => r.homeStationId ?? "—",
    },
    {
      key: "classification",
      header: "Condition",
      sortValue: (r) => r.healthClassification ?? "",
      render: (r) => (
        <span
          className="font-medium"
          style={{
            color: r.healthClassification
              ? (CLASSIFICATION_TONE[r.healthClassification.toUpperCase()] ?? "var(--text-secondary)")
              : "var(--text-muted)",
          }}
        >
          {classificationLabel(r.healthClassification)}
        </span>
      ),
    },
    {
      key: "health",
      header: "Health Score",
      sortValue: (r) => r.healthScore ?? 0,
      render: (r) => (r.healthScore != null ? <HealthBar score={r.healthScore} /> : <span className="text-text-muted">—</span>),
    },
    {
      key: "risk",
      header: "Risk",
      sortValue: (r) => r.riskScore ?? 0,
      render: (r) =>
        r.riskScore != null ? (
          <RiskPill percent={r.riskScore} category={r.riskCategoryRaw ?? "LOW"} />
        ) : (
          <span className="text-text-muted">—</span>
        ),
    },
    {
      key: "priority",
      header: "Priority",
      sortValue: (r) => r.priority ?? "",
      render: (r) => <span className="tabular-nums text-text-secondary">{r.priority ?? "—"}</span>,
    },
    {
      key: "issue",
      header: "Likely Issue",
      sortValue: (r) => r.likelyIssue ?? "",
      render: (r) => (
        <span className="block max-w-[280px] truncate" title={r.likelyIssue ?? undefined}>
          {r.likelyIssue ?? "—"}
        </span>
      ),
    },
  ];

  const countOf = (band: string) => rows.filter((r) => bandOf(r.healthClassification) === band).length;

  return (
    <DataTable
      rows={rows}
      columns={columns}
      rowKey={(r) => r.assetId}
      rowHref={(r) => `/vehicles/${r.assetId}`}
      searchFields={(r) => [
        r.assetId,
        r.registrationNumber ?? "",
        r.homeStationId ?? "",
        r.likelyIssue ?? "",
        r.riskCategoryRaw ?? "",
        r.priority ?? "",
      ]}
      searchPlaceholder="Search vehicle, code, station or issue…"
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
