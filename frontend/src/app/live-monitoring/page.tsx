import { MAX_TELEMETRY_FETCH_DAYS, fitToRange, spanDays } from "@/lib/dateRange";
import Link from "next/link";
import { Activity, AlertTriangle, Plug, Thermometer } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { Panel } from "@/components/ui/Panel";
import { ApiErrorState } from "@/components/ui/ApiErrorState";
import { StatCard } from "@/components/ui/StatCard";
import { AssetsRiskTable } from "@/components/live/AssetsRiskTable";
import { TelemetryChart } from "@/components/battery/TelemetryChart";
import { getAssetTelemetryPoints, getAssetsPage, getPageDateRange } from "@/lib/api/resources";

export default async function LiveMonitoringPage({
  searchParams,
}: {
  // Set when a station's own page links here (its Docks / High Risk Docks
  // stat cards) — scopes the register instead of showing every dock.
  searchParams: Promise<{ station?: string }>;
}) {
  const { station: stationId } = await searchParams;
  const range = await getPageDateRange();
  const fetchDays = Math.min(MAX_TELEMETRY_FETCH_DAYS, spanDays(range.from, range.to));
  const { data: allAssets, error } = await getAssetsPage();

  if (error || !allAssets) {
    return (
      <PageShell title="Live Monitoring" subtitle="Rolling telemetry across the fleet">
        <ApiErrorState title="Could not load asset telemetry" error={error ?? "Unknown error"} />
      </PageShell>
    );
  }

  const assets = stationId
    ? allAssets.filter((a) => a.stationId.toLowerCase() === stationId.toLowerCase())
    : allAssets;
  const highRisk = assets.filter((a) => a.riskCategory === "HIGH" || a.riskCategory === "CRITICAL");
  const topAtRisk = [...assets].sort((a, b) => b.riskScore - a.riskScore).slice(0, 3);

  // Real recent telemetry for the highest-risk docks — the platform has no
  // per-second/minute live stream, only these daily aggregates (see the note
  // below the charts), so this is the closest honest thing to "live".
  const telemetryByAsset = await Promise.all(
    topAtRisk.map((asset) => getAssetTelemetryPoints(asset.assetId, fetchDays)),
  );

  const subtitle = stationId
    ? `${assets.length} dock${assets.length === 1 ? "" : "s"} at ${stationId}`
    : "Recent telemetry across the fleet";

  return (
    <PageShell title="Live Monitoring" subtitle={subtitle}>
      <div className="flex flex-col gap-3">
        {stationId && (
          <Link href="/live-monitoring" className="w-fit text-[12px] font-medium text-[var(--series-1)] hover:underline">
            Clear filter (show all docks)
          </Link>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <StatCard
            icon={Activity}
            iconBg="color-mix(in srgb, var(--status-good) 12%, transparent)"
            iconColor="var(--status-good)"
            label="Docks Reporting"
            value={assets.length}
          />
          <StatCard
            icon={AlertTriangle}
            iconBg="var(--status-warning-bg)"
            iconColor="var(--status-warning)"
            label="High Risk or Above"
            value={highRisk.length}
            breakdown={[{ label: "of total", value: `${Math.round((highRisk.length / (assets.length || 1)) * 100)}%`, tone: "warning" }]}
          />
          <StatCard
            icon={Plug}
            iconBg="color-mix(in srgb, var(--series-1) 12%, transparent)"
            iconColor="var(--series-1)"
            label="Highest Risk Dock"
            value={Math.round(topAtRisk[0]?.riskScore ?? 0)}
            breakdown={topAtRisk[0] ? [{ label: topAtRisk[0].assetId, value: topAtRisk[0].likelyIssue, tone: "critical" }] : []}
          />
        </div>

        {topAtRisk.length > 0 && (
          <Panel
            title="Recent Telemetry — Highest Risk Docks"
            titleNote={`(daily average, ${fetchDays} day${fetchDays === 1 ? "" : "s"})`}
            action={<Thermometer size={16} className="text-[var(--status-critical)]" />}
          >
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {topAtRisk.map((asset, idx) => (
                <div key={asset.assetId}>
                  <div className="mb-2 flex items-baseline justify-between">
                    <span className="text-[13px] font-semibold text-text-primary">{asset.assetId}</span>
                    <span className="text-[11.5px] text-text-muted">{asset.stationId}</span>
                  </div>
                  {telemetryByAsset[idx].data && telemetryByAsset[idx].data!.length > 0 ? (
                    <TelemetryChart
                      data={fitToRange(telemetryByAsset[idx].data!, range.from, range.to)}
                      dataKey="temperature"
                      color="var(--status-critical)"
                      unit="°C"
                      gradientId={`live-temp-${idx}`}
                    />
                  ) : (
                    <p className="py-8 text-center text-[12.5px] text-text-muted">No telemetry history available.</p>
                  )}
                </div>
              ))}
            </div>
          </Panel>
        )}

        <Panel title="Dock Register" titleNote={`(${assets.length} docks, live${stationId ? ` at ${stationId}` : ""})`}>
          <AssetsRiskTable rows={assets} />
        </Panel>

        <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-1)] px-5 py-3 text-[12px] leading-relaxed text-text-muted">
          This platform exposes daily telemetry aggregates per dock (temperature, charging duration, current,
          efficiency), not a per-second live stream — there is no per-battery or per-charger telemetry endpoint
          either. What is shown above is the most recent real data the service has, refreshed on page load.
        </div>
      </div>
    </PageShell>
  );
}
