// Single entry point the dashboard calls.
//
// The command centre gives the KPI blocks, alerts and at-risk list; three
// purpose-built endpoints supply the donut, the trend chart and the risk
// summary. Each of those three degrades on its own — losing the trend must not
// blank the KPIs — so they are fetched with individual catches.
//
// Falls back to the local synthetic dataset when the service is unreachable, so
// a demo always has something on screen. Which source produced the numbers is
// returned alongside the data and shown in the header.

import {
  ApiUnavailableError,
  apiBaseUrl,
  fetchBatteryHealthTrend,
  fetchChargers,
  fetchCommandCenter,
  fetchHealthDistribution,
  fetchOperationsRisk,
  fetchRiskSummary,
  fetchStations,
  fetchVehicleSummary,
  fetchVehicles,
} from "./client";
import { buildDemoCommandCenter } from "./demoSource";
import {
  mergeChargerOperationsRisk,
  mergeStationOperationsRisk,
  normaliseCharger,
  normaliseCommandCenter,
  normaliseDistribution,
  normaliseOperationsRisk,
  normaliseStation,
  normaliseTrend,
  normaliseVehicle,
  type ChargerRow,
  type DashboardData,
  type StationRow,
} from "./normalise";

export interface DashboardResult {
  data: DashboardData;
  /** Individual stations and chargers, so the KPI cards can rank them. */
  stations: StationRow[];
  chargers: ChargerRow[];
  /** Why the live service was not used, when it wasn't. */
  fallbackReason: string | null;
}

function demoResult(reason: string): DashboardResult {
  const payload = buildDemoCommandCenter();
  const data = normaliseCommandCenter(payload, "demo");
  return {
    data: {
      ...data,
      healthBuckets: [],
      healthTrend: normaliseTrend(payload.health_trend),
    },
    stations: [],
    chargers: [],
    fallbackReason: reason,
  };
}

export async function getDashboardData(
  trendDays = 7,
): Promise<DashboardResult> {
  if (!apiBaseUrl()) return demoResult("API_BASE_URL is not set");

  try {
    const [
      payload,
      distribution,
      riskSummary,
      trend,
      stations,
      chargers,
      stationRiskItems,
      chargerRiskItems,
      vehicleRows,
      vehicleSummary,
    ] = await Promise.all([
      fetchCommandCenter(),
      fetchHealthDistribution().catch(() => null),
      fetchRiskSummary().catch(() => null),
      fetchBatteryHealthTrend(trendDays).catch(() => null),
      fetchStations().catch(() => []),
      fetchChargers().catch(() => []),
      // Each asset_type filter on GET /operations/risk returns that type's
      // own native score (identical to /stations/scores and
      // /chargers/scores) — not a dock proxy, so this screen's numbers
      // always match what the station/charger's own detail page shows.
      fetchOperationsRisk({ assetType: "STATION", limit: 100 }).catch(() => []),
      fetchOperationsRisk({ assetType: "CHARGER", limit: 500 }).catch(() => []),
      // Keep the dashboard vehicle card on the same registry and summary
      // endpoints as the Vehicles page, rather than the command-center
      // snapshot which can be calculated or cached on a different schedule.
      fetchVehicles().catch(() => []),
      fetchVehicleSummary().catch(() => null),
    ]);

    const data = normaliseCommandCenter(payload, "api");
    // The Batteries KPI card's own maintenance-due figure must stay
    // battery-scoped (it sits alongside battery-only highRisk/
    // predictedFailures) — riskSummary.maintenance_due is fleet-wide, so the
    // per-type breakdown is what belongs here, not the top-level count.
    const batteryMaintenanceDue = riskSummary?.by_asset_type?.battery?.maintenance_due;
    const stationRisk = stationRiskItems.map(normaliseOperationsRisk);
    const chargerRisk = chargerRiskItems.map(normaliseOperationsRisk);

    // A STATION-type row's own asset_id is the station_id itself.
    const riskByStationId = new Map(
      stationRisk.map((r) => [r.assetId.toLowerCase(), r]),
    );
    // A CHARGER-type row's own asset_id is its charger_uid
    // ("<station_id>-<charger_id>"), which is exactly how the charger row
    // below is keyed too.
    const riskByChargerUid = new Map(
      chargerRisk.map((r) => [r.assetId.toLowerCase(), r]),
    );

    return {
      data: {
        ...data,
        healthBuckets: distribution ? normaliseDistribution(distribution) : [],
        distributionTotal: distribution?.total ?? data.batteries.total,
        batteries: {
          ...data.batteries,
          // The command centre does not carry a maintenance-due count; the
          // dedicated risk-summary endpoint does.
          maintenanceDue: batteryMaintenanceDue?.count ?? data.batteries.maintenanceDue,
        },
        fleetRiskSummary: riskSummary
          ? {
              total: riskSummary.total,
              highRisk: riskSummary.high_risk_assets.count,
              maintenanceDue: riskSummary.maintenance_due.count,
              maintenanceDueNote: riskSummary.maintenance_due.note ?? null,
              predictedFailures: riskSummary.predicted_failures.count,
            }
          : null,
        healthTrend: normaliseTrend(trend) ?? data.healthTrend,
        vehicles: vehicleSummary
          ? {
              total: vehicleSummary.total,
              overallHealth: vehicleSummary.average_health_score ?? null,
              highRisk: vehicleSummary.high_risk_count,
              predictedFailures: vehicleSummary.predicted_failure_count,
            }
          : data.vehicles,
        atRiskVehicles:
          vehicleRows.length > 0
            ? vehicleRows.map(normaliseVehicle)
            : data.atRiskVehicles,
        // failureReasons comes straight from GET /dashboard/command-center's
        // own top_failure_reasons (set in normaliseCommandCenter) — that is
        // the platform's canonical "Top Failure Reasons" list for this panel.
      },
      stations: stations
        .map(normaliseStation)
        .map((row) =>
          mergeStationOperationsRisk(
            row,
            riskByStationId.get(row.stationId.toLowerCase()),
          ),
        ),
      chargers: chargers
        .map(normaliseCharger)
        .map((row) =>
          mergeChargerOperationsRisk(
            row,
            riskByChargerUid.get(
              `${row.stationId}-${row.chargerId}`.toLowerCase(),
            ),
          ),
        ),
      fallbackReason: null,
    };
  } catch (error) {
    const reason =
      error instanceof ApiUnavailableError
        ? error.message
        : "unexpected error contacting the API";
    return demoResult(reason);
  }
}
