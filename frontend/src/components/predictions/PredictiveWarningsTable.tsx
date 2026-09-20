"use client";

import Link from "next/link";
import { DataTable, type Column, type FilterOption } from "@/components/ui/DataTable";
import { RiskPill } from "@/components/ui/RiskPill";
import type { PredictiveWarningRow } from "@/lib/api/normalise";

const TYPE_LABEL: Record<string, string> = {
  BATTERY: "Battery",
  STATION: "Station",
  DOCK: "Dock",
  CHARGER: "Charger",
};

export function PredictiveWarningsTable({ rows }: { rows: PredictiveWarningRow[] }) {
  const typeOptions: FilterOption[] = Object.entries(TYPE_LABEL)
    .map(([value, label]) => ({ value, label, count: rows.filter((r) => r.assetType === value).length }))
    .filter((opt) => opt.count > 0);

  const columns: Column<PredictiveWarningRow>[] = [
    {
      key: "assetId",
      header: "Asset ID",
      sortValue: (r) => r.assetId,
      render: (r) =>
        r.href ? (
          <Link href={r.href} className="font-medium text-[var(--series-1)] hover:underline">
            {r.assetId}
          </Link>
        ) : (
          <span className="font-medium text-text-primary">{r.assetId}</span>
        ),
    },
    {
      key: "type",
      header: "Type",
      sortValue: (r) => r.assetType,
      render: (r) => (
        <span className="rounded px-1.5 py-px text-[10.5px] font-semibold uppercase tracking-wide text-text-muted ring-1 ring-[var(--border-hairline)]">
          {TYPE_LABEL[r.assetType] ?? r.assetType}
        </span>
      ),
    },
    {
      key: "location",
      header: "Location",
      sortValue: (r) => r.location ?? "",
      render: (r) => r.location ?? <span className="text-text-muted">—</span>,
    },
    {
      key: "risk",
      header: "Risk Score",
      sortValue: (r) => r.riskScore,
      render: (r) => <RiskPill percent={r.riskScore} category={r.riskCategoryRaw} showCategory />,
    },
    {
      key: "issue",
      header: "Likely Issue",
      sortValue: (r) => r.likelyIssue,
      render: (r) => r.likelyIssue,
    },
    {
      key: "priority",
      header: "Priority",
      sortValue: (r) => r.priority,
      render: (r) => <span className="font-semibold text-text-primary">{r.priority}</span>,
    },
    {
      key: "window",
      header: "Window",
      align: "right",
      sortValue: (r) => r.predictionWindow,
      render: (r) => <span className="tabular-nums">{r.predictionWindow}</span>,
    },
  ];

  return (
    <DataTable
      rows={rows}
      columns={columns}
      rowKey={(r) => `${r.assetType}-${r.assetId}`}
      searchFields={(r) => [r.assetId, r.location ?? "", r.likelyIssue, r.priority]}
      searchPlaceholder="Search asset, location or predicted issue…"
      filters={{
        options: typeOptions,
        predicate: (r, value) => r.assetType === value,
      }}
      initialSort={{ key: "risk", direction: "desc" }}
      pageSize={20}
      emptyMessage="No predictive warnings match this filter."
    />
  );
}
