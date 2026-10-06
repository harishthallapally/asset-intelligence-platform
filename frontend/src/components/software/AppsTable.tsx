"use client";

import Link from "next/link";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { HealthBar } from "@/components/ui/HealthBar";
import { RiskPill } from "@/components/ui/RiskPill";
import type { AppRow } from "@/lib/api/normalise";
import { CLASSIFICATION_TONE, label, platformLabel } from "@/lib/appFormat";

const BAND_MEMBERS: Record<string, string[]> = {
  HEALTHY: ["HEALTHY"],
  WARNING: ["WATCH", "AT_RISK"],
  CRITICAL: ["CRITICAL"],
  NOT_SCORED: ["NOT_SCORED"],
};

function bandOf(classification: string | null): string | null {
  if (!classification) return null;
  const value = classification.toUpperCase();
  return Object.entries(BAND_MEMBERS).find(([, members]) => members.includes(value))?.[0] ?? null;
}

/** The software-asset register — one row per app install cohort (platform ×
 * OS version × device class × brand), ranked by predictive crash/ANR risk. */
export function AppsTable({ rows }: { rows: AppRow[] }) {
  const columns: Column<AppRow>[] = [
    {
      key: "assetId",
      header: "App Cohort",
      sortValue: (r) => r.assetId,
      render: (r) => (
        <Link
          href={`/software-prediction/${r.assetId}`}
          className="font-medium text-[var(--series-1)] hover:underline"
        >
          {r.assetId}
        </Link>
      ),
    },
    {
      key: "platform",
      header: "Platform",
      sortValue: (r) => `${r.platform}-${String(r.osMajor ?? 0).padStart(3, "0")}`,
      render: (r) => platformLabel(r),
    },
    {
      key: "device",
      header: "Device",
      sortValue: (r) => r.model ?? "",
      render: (r) => (
        <span className="text-text-secondary">
          {[r.manufacturer, r.model].filter(Boolean).join(" · ") || "—"}
        </span>
      ),
    },
    {
      key: "version",
      header: "Version",
      sortValue: (r) => r.version ?? "",
      render: (r) => <span className="font-mono text-[12.5px]">{r.version ?? "—"}</span>,
    },
    {
      key: "installs",
      header: "Installs",
      sortValue: (r) => r.installCount ?? 0,
      render: (r) => (
        <span className="tabular-nums">{r.installCount?.toLocaleString("en-IN") ?? "—"}</span>
      ),
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
              ? (CLASSIFICATION_TONE[r.healthClassification.toUpperCase()] ?? "var(--text-muted)")
              : "var(--text-muted)",
          }}
        >
          {label(r.healthClassification)}
        </span>
      ),
    },
    {
      key: "health",
      header: "Health Score",
      sortValue: (r) => r.healthScore ?? 0,
      render: (r) =>
        r.healthScore != null ? <HealthBar score={r.healthScore} /> : <span className="text-text-muted">—</span>,
    },
    {
      key: "risk",
      header: "Risk",
      sortValue: (r) => r.riskScore ?? -1,
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
      sortValue: (r) => r.priority ?? "P9",
      render: (r) => <span className="tabular-nums text-text-secondary">{r.priority ?? "—"}</span>,
    },
    {
      key: "issue",
      header: "Predicted Issue",
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
      rowHref={(r) => `/software-prediction/${r.assetId}`}
      searchFields={(r) => [
        r.assetId,
        r.platform,
        r.manufacturer ?? "",
        r.model ?? "",
        r.version ?? "",
        r.likelyIssue ?? "",
        r.priority ?? "",
      ]}
      searchPlaceholder="Search cohort, platform, device, version or issue…"
      filters={{
        options: [
          { value: "HEALTHY", label: "Healthy", count: countOf("HEALTHY") },
          { value: "WARNING", label: "Warning", count: countOf("WARNING") },
          { value: "CRITICAL", label: "Critical", count: countOf("CRITICAL") },
          { value: "NOT_SCORED", label: "Not scored", count: countOf("NOT_SCORED") },
        ],
        predicate: (r, value) => bandOf(r.healthClassification) === value,
      }}
      initialSort={{ key: "risk", direction: "desc" }}
      pageSize={15}
    />
  );
}
