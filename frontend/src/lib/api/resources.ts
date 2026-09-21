// Loaders for the battery / station / charger screens.
//
// Unlike the dashboard — which keeps a synthetic fallback so a demo always has
// something on screen — these screens are live-only. Falling back here would
// mean showing a different fleet with a different ID scheme (BAT-09001 vs
// BAT001), which is more confusing than an honest "service unavailable".

import {
  ApiUnavailableError,
  apiBaseUrl,
  fetchAssetTelemetry,
  fetchBatteries,
  fetchBattery,
  fetchBatterySummary,
  fetchAssets,
  fetchChargerDetail,
  fetchChargers,
  fetchChargerScores,
  fetchCommandCenter,
  fetchDemoDatasets,
  fetchDemoScenarios,
  fetchOperationsAlerts,
  fetchOperationsRisk,
  fetchPredictiveWarnings,
  fetchStationDetail,
  fetchStations,
  fetchStationScores,
  fetchStationsSummary,
  fetchVehicle,
  fetchVehicles,
  fetchVehicleSummary,
} from "./client";
import type { ApiBatteryCounts, ApiVehicleFleetSummary } from "./types";
import {
  aggregateStationTelemetry,
  mergeChargerScore,
  mergeStationScore,
  normaliseAlert,
  normaliseAsset,
  normaliseAssetTelemetry,
  normaliseBattery,
  normaliseBatteryDetail,
  normaliseCharger,
  normaliseChargerDetail,
  normaliseOperationsRisk,
  normalisePredictiveWarning,
  normaliseStation,
  normaliseStationDetail,
  normaliseVehicle,
  normaliseVehicleDetail,
  type AssetRow,
  type AssetTelemetryPointView,
  type BatteryDetailView,
  type BatteryRow,
  type AlertTone,
  type ChargerDetailView,
  type ChargerRow,
  type DashboardAlert,
  type OperationsRiskRow,
  type PredictiveWarningRow,
  type StationDetailView,
  type StationRow,
  type VehicleDetailView,
  type VehicleRow,
} from "./normalise";

export interface Loaded<T> {
  data: T | null;
  error: string | null;
}

const NOT_CONFIGURED =
  "The dashboard is not connected to the monitoring platform — set the service address in frontend/.env.local and restart.";

function describe(error: unknown): string {
  if (error instanceof ApiUnavailableError) return error.message;
  return error instanceof Error ? error.message : String(error);
}

async function load<T>(fn: () => Promise<T>): Promise<Loaded<T>> {
  if (!apiBaseUrl()) return { data: null, error: NOT_CONFIGURED };
  try {
    return { data: await fn(), error: null };
  } catch (error) {
    return { data: null, error: describe(error) };
  }
}

export interface BatteriesPageData {
  rows: BatteryRow[];
  summary: ApiBatteryCounts | null;
}

export function getBatteriesPage(): Promise<Loaded<BatteriesPageData>> {
  return load(async () => {
    // The summary is a nicety for the filter chips — a failure there should not
    // take the whole table down with it.
    const [rows, summary] = await Promise.all([
      fetchBatteries(),
      fetchBatterySummary().catch(() => null),
    ]);
    return { rows: rows.map(normaliseBattery), summary };
  });
}

export function getBatteryDetail(
  batteryId: string,
): Promise<Loaded<BatteryDetailView>> {
  return load(async () =>
    normaliseBatteryDetail(await fetchBattery(batteryId)),
  );
}

export interface VehiclesPageData {
  rows: VehicleRow[];
  summary: ApiVehicleFleetSummary | null;
}

export function getVehiclesPage(): Promise<Loaded<VehiclesPageData>> {
  return load(async () => {
    const [rows, summary] = await Promise.all([
      fetchVehicles(),
      fetchVehicleSummary().catch(() => null),
    ]);
    return { rows: rows.map(normaliseVehicle), summary };
  });
}

export function getVehicleDetail(
  assetId: string,
): Promise<Loaded<VehicleDetailView>> {
  return load(async () => normaliseVehicleDetail(await fetchVehicle(assetId)));
}

/** GET /operations/risk, every dock fleet-wide — carrying a location string
 * and business_impact the per-type score endpoints don't. Used by the Map
 * View to group risk by location. The endpoint's own default (no filter) is
 * a small cross-type "balanced" sample, not the full dock list, so this
 * always passes assetType/limit explicitly — see getTopRiskAssets for the
 * cross-type version. Never throws — an empty list just means the Map
 * View's hotspots quietly show nothing. */
export async function getOperationsRiskRows(): Promise<OperationsRiskRow[]> {
  try {
    return (await fetchOperationsRisk({ assetType: "DOCK", limit: 500 })).map(
      normaliseOperationsRisk,
    );
  } catch {
    return [];
  }
}

/** GET /operations/risk's own cross-asset-type ranking (stations, chargers,
 * docks, batteries together) — "balanced" (the API's default) round-robins
 * the worst of each type so a top-N list isn't all-batteries (the fleet has
 * 3,124 of those against 26 stations). This is the platform's own answer to
 * "what needs attention right now", not a client-side recombination of
 * separately-fetched per-type lists. Never throws — an empty list just
 * means the Top Risk Assets panel shows nothing. */
export async function getTopRiskAssets(
  limit = 10,
): Promise<OperationsRiskRow[]> {
  try {
    return (
      await fetchOperationsRisk({
        sortBy: "risk",
        order: "desc",
        limit,
        mix: "balanced",
      })
    ).map(normaliseOperationsRisk);
  } catch {
    return [];
  }
}

export interface StationsPageData {
  rows: StationRow[];
  summary: { total: number; online: number; offline: number } | null;
}

export function getStationsPage(): Promise<Loaded<StationsPageData>> {
  return load(async () => {
    // /stations/scores is a second, independent call (Condition/Anomaly/Risk
    // for every station in one shot) — merged in, but its own failure
    // shouldn't blank the dock/charger overview from /stations.
    const [apiRows, summary, scores] = await Promise.all([
      fetchStations(),
      fetchStationsSummary().catch(() => null),
      fetchStationScores().catch(() => []),
    ]);
    const scoreByStation = new Map(
      scores.map((s) => [s.station_id.toLowerCase(), s]),
    );
    const rows = apiRows
      .map(normaliseStation)
      .map((row) =>
        mergeStationScore(row, scoreByStation.get(row.stationId.toLowerCase())),
      );
    return { rows, summary };
  });
}

export interface StationDetailData {
  station: StationRow;
  /** From GET /stations/{id} — the same AI-scoring detail a battery's page
   * shows (dimensions, signals, recommended checks). Null only if that call
   * itself fails; the rest of the page still renders from `station`. */
  scoring: StationDetailView | null;
  /** Station-level daily trend — this platform has no station telemetry
   * endpoint, so it's the mean of every dock at this station's own telemetry
   * (see `aggregateStationTelemetry`). Empty if the dock register or every
   * dock's telemetry call fails. */
  telemetry: AssetTelemetryPointView[];
}

export interface VehicleDetailData {
  vehicle: VehicleDetailView;
  /** Home-station dock telemetry used as operational context; the platform
   * does not expose a native vehicle telemetry-history endpoint. */
  telemetry: AssetTelemetryPointView[];
}

/** This platform's dock register (GET /assets) ids docks as
 * "QIS-{station digits}-{dock digits}" — the same convention
 * `deriveDockAssetId` builds one of; here every dock belonging to a station
 * is found by that prefix instead, since the point is "all of them", not one. */
function dockAssetIdsForStation(
  stationId: string,
  assets: { asset_id: string }[],
): string[] {
  const stationDigits = stationId.match(/(\d+)/)?.[1]?.padStart(3, "0");
  if (!stationDigits) return [];
  const prefix = `QIS-${stationDigits}-`;
  return assets
    .filter((a) => a.asset_id.startsWith(prefix))
    .map((a) => a.asset_id);
}

/**
 * A station's own facts (dock/charger counts, status) come from GET
 * /stations; its AI scoring from the dedicated GET /stations/{id}; its trend
 * from averaging every one of its docks' own telemetry. Deliberately does not
 * pull the charger or battery registers — those have their own list pages,
 * scoped to this station via `?station=`, rather than being duplicated here.
 */
export function getStationDetail(
  stationId: string,
): Promise<Loaded<StationDetailData>> {
  return load(async () => {
    const [stations, scoring, assets] = await Promise.all([
      fetchStations(),
      fetchStationDetail(stationId)
        .then(normaliseStationDetail)
        .catch(() => null),
      fetchAssets().catch(() => []),
    ]);
    const match = stations.find(
      (s) => s.station_id.toLowerCase() === stationId.toLowerCase(),
    );
    if (!match)
      throw new ApiUnavailableError(`Station ${stationId} was not found`, 404);

    const dockAssetIds = dockAssetIdsForStation(stationId, assets);
    const perDockTelemetry = await Promise.all(
      dockAssetIds.map((assetId) =>
        fetchAssetTelemetry(assetId, 14).catch(() => []),
      ),
    );

    return {
      station: normaliseStation(match),
      scoring,
      telemetry: aggregateStationTelemetry(
        perDockTelemetry.map(normaliseAssetTelemetry),
      ),
    };
  });
}

export function getChargersPage(): Promise<Loaded<ChargerRow[]>> {
  return load(async () => {
    // GET /chargers/scores is the charger's own real AI score, keyed by the
    // fleet-unique charger_uid ("<station_id>-<charger_id>") — a second
    // independent call so its failure doesn't blank the charger list.
    const [chargers, scores] = await Promise.all([
      fetchChargers(),
      fetchChargerScores().catch(() => []),
    ]);
    const scoreByUid = new Map(
      scores.map((s) => [s.charger_uid.toLowerCase(), s]),
    );
    return chargers.map((c) => {
      const row = normaliseCharger(c);
      return mergeChargerScore(
        row,
        scoreByUid.get(`${row.stationId}-${row.chargerId}`.toLowerCase()),
      );
    });
  });
}

/** The dock asset id a charger's telemetry trend comes from — the two
 * subsystems name docks differently ("D01" on the charger vs "QIS-001-01" on
 * the asset), so this reconstructs the asset-style id from the charger's own
 * station+dock numbers. Telemetry history only exists per-dock (GET
 * /assets/{id}/telemetry) — the charger's own detail endpoint has no
 * historical trend, only current scores. */
function deriveDockAssetId(stationId: string, dockId: string): string | null {
  const stationDigits = stationId.match(/(\d+)/)?.[1];
  const dockDigits = dockId.match(/(\d+)/)?.[1];
  if (!stationDigits || !dockDigits) return null;
  return `QIS-${stationDigits.padStart(3, "0")}-${dockDigits.padStart(2, "0")}`;
}

export interface ChargerDetailData {
  charger: ChargerRow;
  /** GET /chargers/{charger_uid} — the charger's own AI-scoring detail
   * (dimensions, signals, recommended checks, and whichever battery is
   * currently charging there). Null only if that call itself fails; the
   * rest of the page still renders from `charger`. */
  scoring: ChargerDetailView | null;
  station: StationRow | null;
  /** Recent daily telemetry for the dock this charger sits on. */
  telemetry: AssetTelemetryPointView[];
}

/**
 * `charger_id` is NOT unique across the fleet — the service reuses a small
 * pool (CHG01..CHG15, one per dock position) at every station, so "CHG12"
 * alone matches ~26 different chargers. `stationId` disambiguates; every
 * internal link passes it. Without it, the first match is used (and its
 * station used to build charger_uid) — callers should always supply it when
 * known.
 */
export function getChargerDetail(
  chargerId: string,
  stationId?: string,
): Promise<Loaded<ChargerDetailData>> {
  return load(async () => {
    const [chargers, stations] = await Promise.all([
      fetchChargers(),
      fetchStations().catch(() => []),
    ]);
    const match = chargers.find(
      (c) =>
        c.charger_id.toLowerCase() === chargerId.toLowerCase() &&
        (!stationId || c.station_id.toLowerCase() === stationId.toLowerCase()),
    );
    if (!match) {
      throw new ApiUnavailableError(
        stationId
          ? `Charger ${chargerId} was not found at station ${stationId}`
          : `Charger ${chargerId} was not found`,
        404,
      );
    }

    const charger = normaliseCharger(match);
    const stationMatch = stations.find(
      (s) => s.station_id.toLowerCase() === charger.stationId.toLowerCase(),
    );
    const chargerUid = `${charger.stationId}-${charger.chargerId}`;
    const dockAssetId = deriveDockAssetId(charger.stationId, charger.dockId);

    const [scoring, telemetryPoints] = await Promise.all([
      fetchChargerDetail(chargerUid)
        .then(normaliseChargerDetail)
        .catch(() => null),
      dockAssetId
        ? fetchAssetTelemetry(dockAssetId, 14).catch(() => [])
        : Promise.resolve([]),
    ]);

    return {
      charger,
      scoring,
      station: stationMatch ? normaliseStation(stationMatch) : null,
      telemetry: normaliseAssetTelemetry(telemetryPoints),
    };
  });
}

export interface HeaderAlert {
  key: string;
  title: string;
  entityLabel: string;
  stationId: string;
  severity: string;
  tone: AlertTone;
  timestamp: string;
  href: string | null;
}

export interface HeaderContext {
  locations: { stationId: string; label: string; online: boolean }[];
  /** Count of unacknowledged high-severity alerts, for the bell badge. */
  alertCount: number;
  /** The most recent alerts, shown in the bell dropdown. */
  alerts: HeaderAlert[];
  /** Timestamp of the freshest data the platform returned. */
  dataAsOf: string | null;
}

/**
 * Everything the page header needs, from the live service. Each piece degrades
 * on its own — a station-list failure should not blank the alert badge.
 */
export async function getHeaderContext(): Promise<HeaderContext> {
  if (!apiBaseUrl())
    return { locations: [], alertCount: 0, alerts: [], dataAsOf: null };

  const [stations, commandCenter] = await Promise.all([
    fetchStations().catch(() => []),
    fetchCommandCenter().catch(() => null),
  ]);

  const alerts = commandCenter?.top_critical_alerts ?? [];
  const timestamps = alerts
    .map((a) => a.timestamp)
    .filter(Boolean)
    .sort();

  return {
    locations: stations.map((s) => ({
      stationId: s.station_id,
      label: s.name ?? s.location ?? s.station_id,
      online: s.online,
    })),
    alertCount: alerts.filter((a) => /CRITICAL|HIGH/i.test(a.severity)).length,
    alerts: alerts.slice(0, 6).map(normaliseAlert),
    dataAsOf: timestamps.length > 0 ? timestamps[timestamps.length - 1] : null,
  };
}

/** GET /assets — the dock register, fully scored (health/anomaly/risk). */
export function getAssetsPage(): Promise<Loaded<AssetRow[]>> {
  return load(async () => (await fetchAssets()).map(normaliseAsset));
}

/**
 * GET /operations/predictive-warnings, unfiltered — spans every asset type
 * (BATTERY/STATION/DOCK/CHARGER), ~4,000 rows on this fleet. This is the
 * platform's real predictive-risk register, backing the AI Predictions page.
 */
export function getPredictiveWarningsPage(): Promise<
  Loaded<PredictiveWarningRow[]>
> {
  return load(async () =>
    (await fetchPredictiveWarnings()).map(normalisePredictiveWarning),
  );
}

export type AlertRow = DashboardAlert;

/** GET /operations/alerts — the real alert feed backing the Alerts page. */
export function getOperationsAlertsPage(
  limit = 200,
): Promise<Loaded<AlertRow[]>> {
  return load(async () =>
    (await fetchOperationsAlerts(limit)).map(normaliseAlert),
  );
}

/**
 * GET /assets/{id}/telemetry — daily dock-level aggregates. This is the only
 * telemetry-history endpoint the platform exposes; there is no per-battery or
 * per-charger equivalent, so callers resolve to a dock asset id first.
 */
export function getAssetTelemetryPoints(
  assetId: string,
  days = 14,
): Promise<Loaded<AssetTelemetryPointView[]>> {
  return load(async () =>
    normaliseAssetTelemetry(await fetchAssetTelemetry(assetId, days)),
  );
}

export interface DemoContext {
  datasets: { code: string; label: string }[];
  scenarios: { code: string; label: string }[];
  assets: { assetId: string; label: string }[];
}

/** Options for the Demo Controls panel. Each list degrades on its own so one
 * failing lookup does not take the whole panel down. */
export async function getDemoContext(): Promise<Loaded<DemoContext>> {
  return load(async () => {
    const [datasets, scenarios, assets] = await Promise.all([
      fetchDemoDatasets().catch(() => []),
      fetchDemoScenarios().catch(() => []),
      fetchAssets().catch(() => []),
    ]);

    return {
      datasets: datasets.map((d) => ({
        code: d.name,
        label: d.name
          .replace(/[_-]+/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase()),
      })),
      scenarios: scenarios.map((s) => ({ code: s.code, label: s.label })),
      assets: assets.map((a) => ({
        assetId: a.asset_id,
        label: `${a.asset_id} — ${a.health_classification.toLowerCase().replace(/_/g, " ")}, risk ${Math.round(a.risk_score)}%`,
      })),
    };
  });
}
