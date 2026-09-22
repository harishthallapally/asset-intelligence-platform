import { Suspense } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { Panel } from "@/components/ui/Panel";
import { ApiErrorState } from "@/components/ui/ApiErrorState";
import { HealthTrendChart } from "@/components/dashboard/HealthTrendChart";
import { BatteriesTable } from "@/components/batteries/BatteriesTable";
import { getBatteriesPage } from "@/lib/api/resources";

export default async function BatteriesPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  // Same header date control the dashboard's own Battery Health Trend reads.
  const { days } = await searchParams;
  const trendDays = Math.min(365, Math.max(1, Number(days) || 7));
  const { data, error } = await getBatteriesPage(trendDays);

  const subtitle = data
    ? `${data.rows.length.toLocaleString()} packs${
        data.summary ? ` · overall health ${data.summary.overall_health_score}/100` : ""
      }`
    : "Live battery data";

  return (
    <PageShell title="Batteries" subtitle={subtitle}>
      {error || !data ? (
        <ApiErrorState title="Could not load the battery data" error={error ?? "Unknown error"} />
      ) : (
        <div className="flex flex-col gap-3">
          {data.healthTrend && (
            <Panel
              title="Battery Health Trend"
              action={
                <span className="rounded-lg border border-[var(--border-hairline)] px-2.5 py-1 text-[12px] text-text-secondary">
                  Last {data.healthTrend.length} Days
                </span>
              }
            >
              <HealthTrendChart data={data.healthTrend} />
            </Panel>
          )}
          <Panel>
            {/* BatteriesTable reads ?condition= from the dashboard donut, and
                useSearchParams needs a boundary during prerender. */}
            <Suspense fallback={<p className="py-6 text-[13px] text-text-muted">Loading batteries…</p>}>
              <BatteriesTable rows={data.rows} />
            </Suspense>
          </Panel>
        </div>
      )}
    </PageShell>
  );
}
