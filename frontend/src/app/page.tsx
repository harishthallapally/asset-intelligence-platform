import { BatteryCharging, Bike, Plug, Warehouse } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { Panel } from "@/components/ui/Panel";
import { StatCard, type RiskItem } from "@/components/ui/StatCard";
import { ViewAllLink } from "@/components/ui/ViewAllLink";
import { AlertsPanel } from "@/components/dashboard/AlertsPanel";
import { CriticalAlertBanner } from "@/components/dashboard/CriticalAlertBanner";
import { DataSourceBadge } from "@/components/dashboard/DataSourceBadge";
import { FailureReasonsPanel } from "@/components/dashboard/FailureReasonsPanel";
import { HealthDonut } from "@/components/dashboard/HealthDonut";
import { HealthTrendChart } from "@/components/dashboard/HealthTrendChart";
import { RiskSummaryPanel } from "@/components/dashboard/RiskSummaryPanel";
import { TopAtRiskTable } from "@/components/dashboard/TopAtRiskTable";
import {
  TopRiskAssets,
  type RankedAsset,
} from "@/components/dashboard/TopRiskAssets";
import { getDashboardData } from "@/lib/api/dashboard";
import { getTopRiskAssets } from "@/lib/api/resources";
import { operationsRiskHref } from "@/lib/api/normalise";

/** HIGH or CRITICAL — checked directly against the API's own risk_category
 * string (GET /operations/risk) rather than a score threshold, so "what
 * counts as top risk" is exactly what the platform itself calls high risk.
 * A station/charger without a merged score (that fetch failed) is never
 * flagged, rather than guessed at. */
function isHighRisk(row: { riskCategoryRaw: string | null }): boolean {
  const category = row.riskCategoryRaw?.toUpperCase();
  return category === "HIGH" || category === "CRITICAL";
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  // The header's date control writes the trend window here.
  const { days } = await searchParams;
  const trendDays = Math.min(365, Math.max(1, Number(days) || 7));
  const [{ data, stations, chargers }, topRiskRows] = await Promise.all([
    getDashboardData(trendDays),
    // GET /operations/risk's own cross-asset-type ranking, mix=balanced so
    // batteries (3,124 of them) don't crowd out stations/chargers/docks (26,
    // 390, 390) — the platform's own answer to "what needs attention right
    // now", not a client-side recombination of separate per-type lists.
    getTopRiskAssets(10),
  ]);
  const { stations: stationCounts, chargers: chargerCounts, batteries } = data;

  // Each card ranks its own assets and shows only the top few, so the layout
  // holds whether the fleet has three assets or three thousand — what changes
  // is which ones surface. Risk is always the real score from GET
  // /operations/risk (the station/charger's own riskiest dock, merged in by
  // getDashboardData) — offline never overrides it with a fabricated number,
  // it's just an extra tag alongside the real figure.
  const stationItems: RiskItem[] = stations.map((station) => ({
    id: station.stationId,
    href: `/stations/${station.stationId}`,
    detail:
      station.likelyIssue ??
      (station.online ? "No issue reported" : "Station offline"),
    risk: station.riskScore ?? 0,
    tag: !station.online ? "Offline" : (station.priority ?? undefined),
  }));

  // charger_id repeats across stations (CHG01..CHG15 reused at every
  // station), so the row key and link both need the station id too.
  const chargerItems: RiskItem[] = chargers
    .filter(
      (charger) => charger.faulty || !charger.online || isHighRisk(charger),
    )
    .map((charger) => ({
      id: charger.chargerId,
      key: `${charger.stationId}-${charger.chargerId}`,
      href: `/chargers/${charger.chargerId}?station=${charger.stationId}`,
      detail: charger.likelyIssue ?? `${charger.dockId} · ${charger.stationId}`,
      risk: charger.riskScore ?? 0,
      tag: charger.faulty
        ? "Faulty"
        : !charger.online
          ? "Offline"
          : (charger.priority ?? undefined),
    }));

  // GET /operations/risk's own cross-asset-type row -> this panel's shape.
  // `kind` and `href` both fall through to null for a row this UI has no
  // page for, so any future asset_type the API adds is dropped rather than
  // rendered broken.
  const KIND_BY_ASSET_TYPE: Record<string, RankedAsset["kind"]> = {
    BATTERY: "battery",
    CHARGER: "charger",
    STATION: "station",
    DOCK: "dock",
    VEHICLE: "vehicle",
  };
  const topRiskAssets: RankedAsset[] = topRiskRows.flatMap((row) => {
    const kind = KIND_BY_ASSET_TYPE[row.assetType.toUpperCase()];
    const href = operationsRiskHref(row);
    if (!kind || !href) return [];
    return [
      {
        id: row.assetId,
        key: `${kind}-${row.assetId}`,
        kind,
        href,
        issue: row.likelyIssue ?? "No issue reported",
        location: row.location ?? "",
        risk: row.riskScore,
        tag: row.priority,
      },
    ];
  });

  const batteryItems: RiskItem[] = data.atRisk.map((row) => ({
    id: row.batteryId,
    href: `/batteries/${row.batteryId}`,
    detail: row.likelyIssue,
    risk: row.riskScore,
    tag: row.priority,
  }));

  // Keep the vehicle card on the vehicle-specific rows from the command
  // center response. The balanced cross-asset ranking is for the separate
  // Top Risk Assets panel and is not guaranteed to include vehicles.
  const vehicleItems: RiskItem[] = data.atRiskVehicles
    .filter((vehicle) => {
      const category = vehicle.riskCategoryRaw?.toUpperCase();
      return (
        vehicle.riskScore !== null &&
        (category === "HIGH" || category === "CRITICAL")
      );
    })
    .map((vehicle) => ({
      id: vehicle.assetId,
      key: vehicle.assetId,
      href: `/vehicles/${vehicle.assetId}`,
      detail:
        (vehicle.likelyIssue ??
          [vehicle.manufacturer, vehicle.model, vehicle.homeStationId]
            .filter(Boolean)
            .join(" · ")) ||
        "No issue reported",
      risk: vehicle.riskScore!,
      tag: vehicle.priority ?? undefined,
    }));

  return (
    <PageShell
      title="Dashboard"
      subtitle="Overview of Stations, Chargers & Batteries"
    >
      <div className="flex flex-col gap-3">
        <DataSourceBadge source={data.source} />
        <CriticalAlertBanner rows={data.atRisk} />

        <div
          className={`grid grid-cols-1 gap-3 md:grid-cols-2 ${data.vehicles ? "xl:grid-cols-4" : "xl:grid-cols-3"}`}
        >
          <StatCard
            icon={Warehouse}
            iconBg="color-mix(in srgb, var(--series-7) 12%, transparent)"
            iconColor="var(--series-7)"
            label="Stations"
            value={stationCounts.total}
            href="/stations"
            breakdown={[
              { label: "Online", value: stationCounts.online, tone: "good" },
              {
                label: "Offline",
                value: stationCounts.offline,
                tone: "critical",
              },
            ]}
            items={stationItems}
            emptyMessage="All stations healthy."
          />
          <StatCard
            icon={Plug}
            iconBg="color-mix(in srgb, var(--series-1) 12%, transparent)"
            iconColor="var(--series-1)"
            label="Chargers"
            value={chargerCounts.total}
            href="/chargers"
            // Faulty chargers are counted inside online/offline upstream, so the
            // three figures sit alongside each other rather than summing.
            breakdown={[
              { label: "Online", value: chargerCounts.online, tone: "good" },
              {
                label: "Offline",
                value: chargerCounts.offline,
                tone: "critical",
              },
              { label: "Faulty", value: chargerCounts.faulty, tone: "warning" },
            ]}
            items={chargerItems}
            emptyMessage="No faulty or offline chargers."
          />
          <StatCard
            icon={BatteryCharging}
            iconBg="color-mix(in srgb, var(--status-good) 12%, transparent)"
            iconColor="var(--status-good)"
            label="Batteries"
            value={batteries.total}
            href="/batteries"
            breakdown={[
              {
                label: "Health",
                value: `${batteries.overallHealth}/100`,
                tone: "good",
              },
              {
                label: "High risk",
                value: batteries.highRisk,
                tone: "warning",
              },
              {
                label: "Predicted",
                value: batteries.predictedFailures,
                tone: "critical",
              },
            ]}
            items={batteryItems}
            emptyMessage="No battery above the Low risk band."
          />
          {data.vehicles && (
            <StatCard
              icon={Bike}
              iconBg="color-mix(in srgb, var(--series-2) 12%, transparent)"
              iconColor="var(--series-2)"
              label="Vehicles"
              value={data.vehicles.total}
              href="/vehicles"
              breakdown={[
                ...(data.vehicles.overallHealth != null
                  ? [
                      {
                        label: "Health",
                        value: `${Math.round(data.vehicles.overallHealth)}/100`,
                        tone: "good" as const,
                      },
                    ]
                  : []),
                {
                  label: "High risk",
                  value: data.vehicles.highRisk,
                  tone: "warning" as const,
                },
                {
                  label: "Predicted",
                  value: data.vehicles.predictedFailures,
                  tone: "critical" as const,
                },
              ]}
              items={vehicleItems}
              emptyMessage="No vehicle above the Low risk band."
            />
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
          <Panel
            title="Top Risk Assets"
            titleNote="(top 5, balanced across asset types)"
            className="lg:col-span-7"
            action={<ViewAllLink href="/ai-predictions" />}
          >
            <TopRiskAssets assets={topRiskAssets} limit={5} />
          </Panel>

          <Panel
            title="Top Critical Alerts"
            className="lg:col-span-5"
            action={<ViewAllLink href="/alerts" />}
          >
            <AlertsPanel alerts={data.alerts} />
          </Panel>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <Panel title="Asset Health Distribution" titleNote="(all assets)">
            <HealthDonut
              buckets={data.healthBuckets}
              total={data.distributionTotal}
            />
          </Panel>

          <Panel
            title="AI Risk Summary"
            titleNote="(Next 24 Hrs)"
            footer={
              <div className="flex justify-center">
                <ViewAllLink
                  href="/ai-predictions"
                  label="View All Predictions"
                />
              </div>
            }
          >
            {/* Fleet-wide (every asset type), not battery-only — this panel
                is titled generically, and a battery-only predicted-failure
                count can read 0 while chargers/stations still have real
                ones (see DashboardData.fleetRiskSummary). Falls back to the
                battery-only figures only if the dedicated endpoint itself
                failed to load. */}
            <RiskSummaryPanel
              highRisk={data.fleetRiskSummary?.highRisk ?? batteries.highRisk}
              maintenanceDue={data.fleetRiskSummary?.maintenanceDue ?? batteries.maintenanceDue}
              maintenanceDueNote={data.fleetRiskSummary?.maintenanceDueNote ?? null}
              predictedFailures={data.fleetRiskSummary?.predictedFailures ?? batteries.predictedFailures}
              total={data.fleetRiskSummary?.total ?? batteries.total}
            />
          </Panel>

          <Panel title="Top Failure Reasons" titleNote="(Next 24 Hrs)">
            <FailureReasonsPanel reasons={data.failureReasons} />
          </Panel>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
          {/* Hidden until the service exposes a health-trend series. */}
          {data.healthTrend && (
            <Panel
              title="Battery Health Trend"
              className="lg:col-span-5"
              action={
                <span className="rounded-lg border border-[var(--border-hairline)] px-2.5 py-1 text-[12px] text-text-secondary">
                  Last {data.healthTrend.length} Days
                </span>
              }
            >
              <HealthTrendChart data={data.healthTrend} />
            </Panel>
          )}

          <Panel
            title="Top At Risk Batteries"
            titleNote="(Next 24 Hrs)"
            className={data.healthTrend ? "lg:col-span-7" : "lg:col-span-12"}
            action={<ViewAllLink href="/ai-predictions" />}
          >
            <TopAtRiskTable rows={data.atRisk} />
          </Panel>
        </div>
      </div>
    </PageShell>
  );
}
