// Normalises the API payload into the view model the dashboard renders.
//
// The four fields still to be added on the service side are modelled as
// nullable here, so the UI can hide those panels instead of showing zeros:
//   - batteries.maintenance_due_count  -> maintenanceDue
//   - health_trend                     -> healthTrend
//   - top_at_risk_batteries[].station_id      -> row.stationId
//   - top_at_risk_batteries[].failure_in_hours-> row.failureInHours

import type {
  ApiAIInsight,
  ApiAlert,
  ApiAsset,
  ApiAssetTelemetryPoint,
  ApiBattery,
  ApiBatteryTelemetryPoint,
  ApiHealthDistribution,
  ApiBatteryDetail,
  ApiCharger,
  ApiCommandCenter,
  ApiHealthTrendPoint,
  ApiPredictiveWarning,
  ApiChargerDetail,
  ApiChargerScore,
  ApiOperationsRiskItem,
  ApiStation,
  ApiStationDetail,
  ApiStationScore,
  ApiVehicleDetail,
  ApiVehicleSummary,
  ApiVehicleTelemetryPoint,
} from "./types";

export type DataSource = "api" | "demo";

export type HealthState = "healthy" | "warning" | "critical" | "offline";
export type RiskCategory = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
export type AlertTone = "critical" | "serious" | "warning" | "neutral";

export interface Bucket {
  state: HealthState;
  label: string;
  count: number;
  pct: number;
}

export interface DashboardAlert {
  key: string;
  title: string;
  entityLabel: string;
  /** The affected asset's own page, or its station's when the alert only
   * carries an opaque reference number rather than a real asset id. */
  href: string | null;
  stationId: string;
  timestamp: string;
  severity: string;
  tone: AlertTone;
}

export interface AtRiskRow {
  batteryId: string;
  stationId: string | null;
  healthScore: number;
  healthClassification: string;
  riskScore: number;
  riskCategory: RiskCategory;
  priority: string;
  likelyIssue: string;
  predictionWindow: string;
  failureInHours: number | null;
}

export interface TrendPoint {
  label: string;
  /** Percentages, matching the chart's "% of batteries" axis. */
  healthy: number;
  warning: number;
  critical: number;
}

export interface DashboardData {
  source: DataSource;
  stations: { total: number; online: number; offline: number };
  chargers: { total: number; online: number; offline: number; faulty: number };
  batteries: {
    total: number;
    overallHealth: number;
    classification: string;
    highRisk: number;
    predictedFailures: number;
    /** null until the service exposes it — the tile is hidden when null. */
    maintenanceDue: number | null;
  };
  /** null on deployments that predate the 2W EV vehicle fleet — the KPI card
   * is hidden when null, same convention as maintenanceDue above. */
  vehicles: {
    total: number;
    overallHealth: number | null;
    highRisk: number;
    predictedFailures: number;
  } | null;
  healthBuckets: Bucket[];
  /** Total the donut is drawn from — all monitored assets, not just batteries. */
  distributionTotal: number;
  /** GET /operations/risk-summary's own fleet-wide figures — every asset
   * type combined, with a matching total for the percentage math. The "AI
   * Risk Summary" panel is titled generically (not "Battery Risk Summary"),
   * so it reads from here rather than the batteries-only block above; a
   * battery-only predicted-failure count of 0 would otherwise hide the
   * charger/station predictions that do exist. null only if the endpoint
   * itself failed to load. */
  fleetRiskSummary: {
    total: number;
    highRisk: number;
    maintenanceDue: number;
    maintenanceDueNote: string | null;
    predictedFailures: number;
  } | null;
  alerts: DashboardAlert[];
  atRisk: AtRiskRow[];
  /** Vehicle-specific risk rows from the command-center API. */
  atRiskVehicles: VehicleRow[];
  failureReasons: { reason: string; count: number; pct: number }[];
  /** null until the service exposes it — the chart is hidden when null. */
  healthTrend: TrendPoint[] | null;
}

const STATE_LABEL: Record<HealthState, string> = {
  healthy: "Healthy",
  warning: "Warning",
  critical: "Critical",
  offline: "Offline",
};

/** Severity strings are free-form in the schema, so match generously and fall
 * back to neutral rather than mis-colouring an unknown value. */
export function alertTone(severity: string): AlertTone {
  const s = severity.toUpperCase();
  if (s.includes("CRITICAL") || s.includes("FATAL")) return "critical";
  if (s.includes("HIGH") || s.includes("SEVERE") || s.includes("ERROR"))
    return "serious";
  if (s.includes("WARN") || s.includes("MEDIUM") || s.includes("MODERATE"))
    return "warning";
  return "neutral";
}

export function riskCategory(value: string): RiskCategory {
  const v = value.toUpperCase();
  if (v.includes("CRITICAL")) return "CRITICAL";
  if (v.includes("HIGH")) return "HIGH";
  if (v.includes("MODERATE") || v.includes("MEDIUM")) return "MODERATE";
  return "LOW";
}

/** Turns a category/description pair into an alert headline. */
function alertTitle(category: string, description: string): string {
  const readable = category
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return description?.trim() ? description : readable;
}

/** `entity_id` on this platform is not reliably the affected asset's own id —
 * roughly a quarter of alerts carry a real one (BAT.../QIS.../CHG...), the
 * rest carry an opaque internal reference like "ALERT0062" that only looks
 * like an id. This tells the two apart so the UI never presents a made-up
 * reference number as if it were a battery, station or charger's real id. */
function realAssetId(entityId: string): boolean {
  return /^(BAT|QIS|CHG)/i.test(entityId);
}

function entityLabel(alert: ApiAlert): string {
  const type = alert.entity_type
    ? alert.entity_type.charAt(0).toUpperCase() + alert.entity_type.slice(1)
    : "Entity";
  if (realAssetId(alert.entity_id)) return `${type} ${alert.entity_id}`;
  // Not a real per-asset id — station_id is always real, so say that instead
  // of presenting the opaque reference as if it named the asset.
  return `${type} at ${alert.station_id}`;
}

/** Best-effort link from an alert's entity to its detail page. Falls back to
 * the alert's `station_id` (always a real station) rather than a dead link
 * when `entity_id` is only an opaque reference number, not a real asset id. */
function entityHref(alert: ApiAlert): string | null {
  const id = alert.entity_id;
  if (/^BAT/i.test(id)) return `/batteries/${id}`;
  if (/^QIS/i.test(id)) {
    const digits = id.match(/\d+/)?.[0];
    if (digits) return `/stations/QIS${digits.padStart(3, "0")}`;
  }
  // CHARGER entity_ids need a station to disambiguate (see the charger
  // detail page), which this shape doesn't carry — and any opaque
  // "ALERT####" reference isn't navigable at all — so land on the station.
  if (alert.station_id) return `/stations/${alert.station_id}`;
  return null;
}

/** Shared by the command-center's `top_critical_alerts` and the dedicated
 * GET /operations/alerts feed — both return the same `ApiAlert` shape. */
export function normaliseAlert(alert: ApiAlert, idx: number): DashboardAlert {
  return {
    key: `${alert.entity_id}-${alert.timestamp}-${idx}`,
    title: alertTitle(alert.category, alert.description),
    entityLabel: entityLabel(alert),
    stationId: alert.station_id,
    timestamp: alert.timestamp,
    severity: alert.severity,
    tone: alertTone(alert.severity),
    href: entityHref(alert),
  };
}

function trendLabel(date: string): string {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function normaliseTrend(
  points: ApiHealthTrendPoint[] | null | undefined,
): TrendPoint[] | null {
  if (!points || points.length === 0) return null;
  return points.map((point) => ({
    label: trendLabel(point.date),
    healthy: point.healthy_percent,
    warning: point.warning_percent,
    critical: point.critical_percent,
  }));
}

export function normaliseCommandCenter(
  payload: ApiCommandCenter,
  source: DataSource,
): DashboardData {
  const b = payload.batteries;
  const total = b.total;

  return {
    source,
    stations: payload.stations,
    chargers: payload.chargers,
    batteries: {
      total,
      overallHealth: b.overall_health_score,
      classification: b.overall_health_classification,
      highRisk: b.high_risk_count,
      predictedFailures: b.predicted_failure_count,
      maintenanceDue: b.maintenance_due_count ?? null,
    },
    vehicles: payload.vehicles
      ? {
          total: payload.vehicles.total,
          overallHealth: payload.vehicles.average_health_score ?? null,
          highRisk: payload.vehicles.high_risk_count,
          predictedFailures: payload.vehicles.predicted_failure_count,
        }
      : null,
    alerts: (payload.top_critical_alerts ?? []).map(normaliseAlert),
    atRisk: (payload.top_at_risk_batteries ?? []).map((row) => ({
      batteryId: row.battery_id,
      stationId: row.station_id ?? null,
      healthScore: row.health_score,
      healthClassification: row.health_classification,
      riskScore: row.risk_score,
      riskCategory: riskCategory(row.risk_category),
      priority: row.priority,
      likelyIssue: row.likely_issue,
      predictionWindow: row.prediction_window,
      failureInHours: row.failure_in_hours ?? null,
    })),
    atRiskVehicles: (payload.top_at_risk_vehicles ?? []).map(normaliseVehicle),
    failureReasons: (payload.top_failure_reasons ?? []).map((r) => ({
      reason: r.reason,
      count: r.count,
      pct: r.percent,
    })),
    healthBuckets: [],
    distributionTotal: total,
    fleetRiskSummary: null,
    healthTrend: normaliseTrend(payload.health_trend),
  };
}

// ---------------------------------------------------------------------------
// Battery / station / charger view models
// ---------------------------------------------------------------------------

export interface BatteryRow {
  batteryId: string;
  healthScore: number;
  healthClassification: string;
  anomalyScore: number;
  anomalySeverity: string;
  riskScore: number;
  riskCategory: RiskCategory;
  riskCategoryRaw: string;
  priority: string;
  likelyIssue: string;
  predictionWindow: string;
  stationId: string | null;
}

export interface BatteryDetailView extends BatteryRow {
  /** Ordered for display; the service returns an open-ended map of dimensions. */
  dimensions: { key: string; label: string; score: number }[];
  detectedSignals: string[];
  sla: string;
  businessImpact: string;
  suggestedChecks: string[];
  riskNote: string;
  scoredAt: string;
  /** Non-telemetry findings — same shape and meaning as a station's. Empty
   * when none apply. */
  aiInsights: AIInsightView[];
  equipment: EquipmentView;
}

export interface StationRow {
  stationId: string;
  name: string;
  online: boolean;
  dockCount: number;
  chargersOnline: number;
  chargersOffline: number;
  avgHealthScore: number;
  healthyDocks: number;
  atRiskDocks: number;
  criticalDocks: number;
  highRiskDocks: number;
  latitude: number | null;
  longitude: number | null;
  /** The station's own AI-scored health — a different figure from
   * avgHealthScore above (the plain average of its docks). GET /stations
   * embeds this directly now, so it's populated from the very first fetch
   * rather than only after a separate /stations/scores merge. */
  healthScore: number | null;
  /** GET /stations now embeds the same scoring GET /stations/scores does,
   * so these are populated directly in normaliseStation — `mergeStationScore`
   * only needs to run for the *composite* figures (see below), which stay
   * exclusive to /stations/scores and /stations/{id}. `riskScore`,
   * `riskCategoryRaw` and `priority` are already the *composite* figures
   * (raw risk folded together with any non-telemetry insight) when one
   * applies — the "top", truest number, not the raw telemetry-only one. */
  healthClassification: string | null;
  anomalyScore: number | null;
  anomalySeverity: string | null;
  riskScore: number | null;
  riskCategoryRaw: string | null;
  priority: string | null;
  likelyIssue: string | null;
  /** True when a non-telemetry insight (seasonal climate, regional
   * connectivity, etc.) pushed the figures above beyond the raw
   * telemetry-only score below. */
  riskEscalated: boolean;
  /** The raw, telemetry-only score/category — equal to riskScore/
   * riskCategoryRaw above when nothing escalated it. */
  baseRiskScore: number | null;
  baseRiskCategoryRaw: string | null;
  insightCount: number;
  upliftReasons: string[];
}

/** Merges a GET /stations/scores row into a station's overview row — kept
 * separate from `normaliseStation` since the two come from different calls
 * that can succeed or fail independently. Prefers the composite risk figures
 * over the raw ones whenever an insight actually applies (composite_risk_score
 * non-null) — see StationRow's riskScore doc. */
export function mergeStationScore(
  row: StationRow,
  score: ApiStationScore | undefined,
): StationRow {
  if (!score) return row;
  const hasComposite = score.composite_risk_score !== null;
  return {
    ...row,
    healthScore: score.health_score,
    healthClassification: score.health_classification,
    anomalyScore: score.anomaly_score,
    anomalySeverity: score.anomaly_severity,
    riskScore: hasComposite ? score.composite_risk_score : score.risk_score,
    riskCategoryRaw: hasComposite
      ? (score.composite_risk_category ?? score.risk_category)
      : score.risk_category,
    priority: hasComposite
      ? (score.composite_priority ?? score.priority)
      : score.priority,
    likelyIssue: score.likely_issue,
    riskEscalated: score.composite_escalated,
    baseRiskScore: score.risk_score,
    baseRiskCategoryRaw: score.risk_category,
    insightCount: score.insight_count,
    upliftReasons: score.uplift_reasons,
  };
}

export interface ChargerRow {
  chargerId: string;
  dockId: string;
  stationId: string;
  online: boolean;
  faulty: boolean;
  /** Null when the charger has never reported. */
  lastSeen: string | null;
  /** There is no per-charger scoring endpoint — these come from the dock
   * this charger sits on (see `deriveDockAssetId` in resources.ts), merged
   * in separately, so null when that cross-reference doesn't resolve. */
  healthScore: number | null;
  healthClassification: string | null;
  anomalyScore: number | null;
  anomalySeverity: string | null;
  riskScore: number | null;
  riskCategoryRaw: string | null;
  priority: string | null;
  likelyIssue: string | null;
}

/** Turns an API dimension key such as `charging_electrical` into a label. */
function dimensionLabel(key: string): string {
  return key.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Equipment facts shared by every "unit" asset type's detail (battery,
 * vehicle, charger) — stations carry none of these, being a location rather
 * than a single manufactured unit. */
export interface EquipmentView {
  firmwareVersion: string | null;
  manufactureDate: string | null;
  warrantyMonths: number | null;
  warrantyStatus: string | null;
}

function normaliseEquipment(detail: {
  firmware_version?: string | null;
  manufacture_date?: string | null;
  warranty_months?: number | null;
  warranty_status?: string | null;
}): EquipmentView {
  return {
    firmwareVersion: detail.firmware_version ?? null,
    manufactureDate: detail.manufacture_date ?? null,
    warrantyMonths: detail.warranty_months ?? null,
    warrantyStatus: detail.warranty_status ?? null,
  };
}

export function normaliseBattery(row: ApiBattery): BatteryRow {
  return {
    batteryId: row.battery_id,
    healthScore: row.health_score,
    healthClassification: row.health_classification,
    anomalyScore: row.anomaly_score,
    anomalySeverity: row.anomaly_severity,
    riskScore: row.risk_score,
    riskCategory: riskCategory(row.risk_category),
    riskCategoryRaw: row.risk_category,
    priority: row.priority,
    likelyIssue: row.likely_issue,
    predictionWindow: row.prediction_window,
    stationId: row.station_id ?? null,
  };
}

export function normaliseBatteryDetail(
  detail: ApiBatteryDetail,
): BatteryDetailView {
  return {
    ...normaliseBattery(detail),
    dimensions: Object.entries(detail.dimension_scores ?? {}).map(
      ([key, score]) => ({
        key,
        label: dimensionLabel(key),
        score,
      }),
    ),
    detectedSignals: detail.detected_signals ?? [],
    sla: detail.sla,
    businessImpact: detail.business_impact,
    suggestedChecks: detail.suggested_checks ?? [],
    riskNote: detail.risk_note,
    scoredAt: detail.scored_at,
    aiInsights: (detail.ai_insights ?? [])
      .filter((insight) => insight.category !== "telemetry_risk")
      .map(normaliseAIInsight),
    equipment: normaliseEquipment(detail),
  };
}

/** GET /batteries/{id}/telemetry — a single pack's own daily trend (state of
 * health, temperature, charging behaviour), for its Asset 360 page. */
export interface BatteryTelemetryPointView {
  date: string;
  temperature: number;
  chargingDuration: number;
  efficiency: number;
  stateOfHealth: number;
  cellVoltageDelta: number;
}

export function normaliseBatteryTelemetry(
  points: ApiBatteryTelemetryPoint[],
): BatteryTelemetryPointView[] {
  return points.map((p) => ({
    date: p.date,
    temperature: p.battery_temperature_mean ?? 0,
    chargingDuration: p.charging_duration_mean ?? 0,
    efficiency: p.efficiency_mean ?? 0,
    stateOfHealth: p.soh_mean ?? 0,
    cellVoltageDelta: p.cell_voltage_delta_mean ?? 0,
  }));
}

// ---------------------------------------------------------------------------
// GET /vehicles · GET /vehicles/{asset_id} — the 2W EV fleet, same registry +
// scoring model as batteries/stations/chargers. registrationNumber is the
// vehicle's own number-plate code ("KA01AA1000").
// ---------------------------------------------------------------------------

export interface VehicleRow {
  assetId: string;
  registrationNumber: string | null;
  manufacturer: string | null;
  model: string | null;
  vehicleClass: string | null;
  location: string | null;
  homeStationId: string | null;
  operationalStatus: string | null;
  healthScore: number | null;
  healthClassification: string | null;
  anomalyScore: number | null;
  anomalySeverity: string | null;
  riskScore: number | null;
  riskCategory: RiskCategory;
  riskCategoryRaw: string | null;
  priority: string | null;
  likelyIssue: string | null;
  predictionWindow: string | null;
  scoredAt: string | null;
}

export interface BatteryWarrantyView {
  status: string | null;
  limitingFactor: string | null;
  start: string | null;
  end: string | null;
  asOf: string | null;
  months: number | null;
  daysRemaining: number | null;
  distanceKm: number | null;
  distanceRemainingKm: number | null;
  odometerKm: number | null;
}

export interface VehicleDetailView extends VehicleRow {
  dimensions: { key: string; label: string; score: number }[];
  detectedSignals: string[];
  sla: string | null;
  businessImpact: string | null;
  suggestedChecks: string[];
  riskNote: string | null;
  batteryWarranty: BatteryWarrantyView | null;
  batteryWarrantyStatus: string | null;
  /** Non-telemetry findings — same shape and meaning as a station's. Empty
   * when none apply. */
  aiInsights: AIInsightView[];
  equipment: EquipmentView;
}

export function normaliseVehicle(row: ApiVehicleSummary): VehicleRow {
  return {
    assetId: row.asset_id,
    registrationNumber: row.registration_number ?? null,
    manufacturer: row.manufacturer ?? null,
    model: row.model ?? null,
    vehicleClass: row.asset_sub_type ?? null,
    location: row.location ?? null,
    homeStationId: row.home_station_id ?? null,
    operationalStatus: row.operational_status ?? null,
    healthScore: row.health_score ?? null,
    healthClassification: row.health_classification ?? null,
    anomalyScore: row.anomaly_score ?? null,
    anomalySeverity: row.anomaly_severity ?? null,
    riskScore: row.risk_score ?? null,
    riskCategory: riskCategory(row.risk_category ?? "LOW"),
    riskCategoryRaw: row.risk_category ?? null,
    priority: row.priority ?? null,
    likelyIssue: row.likely_issue ?? null,
    predictionWindow: row.prediction_window ?? null,
    scoredAt: row.scored_at ?? null,
  };
}

export function normaliseVehicleDetail(
  detail: ApiVehicleDetail,
): VehicleDetailView {
  const warranty = detail.battery_warranty;
  return {
    ...normaliseVehicle(detail),
    dimensions: Object.entries(detail.dimension_scores ?? {})
      .filter((entry): entry is [string, number] => entry[1] != null)
      .map(([key, score]) => ({ key, label: dimensionLabel(key), score })),
    detectedSignals: detail.detected_signals ?? [],
    sla: detail.sla ?? null,
    businessImpact: detail.business_impact ?? null,
    suggestedChecks: detail.suggested_checks ?? [],
    riskNote: detail.risk_note ?? null,
    batteryWarranty: warranty
      ? {
          status: warranty.status ?? null,
          limitingFactor: warranty.limiting_factor ?? null,
          start: warranty.start ?? null,
          end: warranty.end ?? null,
          asOf: warranty.as_of ?? null,
          months: warranty.months ?? null,
          daysRemaining: warranty.days_remaining ?? null,
          distanceKm: warranty.distance_km ?? null,
          distanceRemainingKm: warranty.distance_remaining_km ?? null,
          odometerKm: warranty.odometer_km ?? null,
        }
      : null,
    batteryWarrantyStatus: detail.battery_warranty_status ?? null,
    aiInsights: (detail.ai_insights ?? [])
      .filter((insight) => insight.category !== "telemetry_risk")
      .map(normaliseAIInsight),
    equipment: normaliseEquipment(detail),
  };
}

/** GET /vehicles/{asset_id}/telemetry — a single 2W EV's own daily trend
 * (battery temperature, speed, distance, energy use), for its Asset 360 page. */
export interface VehicleTelemetryPointView {
  date: string;
  batteryTemp: number;
  avgSpeed: number;
  distanceKm: number;
  energyPerKm: number;
}

export function normaliseVehicleTelemetry(
  points: ApiVehicleTelemetryPoint[],
): VehicleTelemetryPointView[] {
  return points
    .filter((p): p is ApiVehicleTelemetryPoint & { date: string } => !!p.date)
    .map((p) => ({
      date: p.date,
      batteryTemp: p.battery_temperature_mean ?? 0,
      avgSpeed: p.vehicle_speed_mean ?? 0,
      distanceKm: p.distance_km ?? 0,
      energyPerKm: p.energy_per_km ?? 0,
    }));
}

export function normaliseStation(row: ApiStation): StationRow {
  return {
    stationId: row.station_id,
    name: row.name ?? row.location ?? row.station_id,
    online: row.online,
    dockCount: row.dock_count,
    chargersOnline: row.chargers_online,
    chargersOffline: row.chargers_offline,
    avgHealthScore: row.avg_health_score,
    healthyDocks: row.healthy_docks,
    atRiskDocks: row.at_risk_docks,
    criticalDocks: row.critical_docks,
    highRiskDocks: row.high_risk_docks,
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    healthScore: row.health_score ?? null,
    healthClassification: row.health_classification ?? null,
    anomalyScore: row.anomaly_score ?? null,
    anomalySeverity: row.anomaly_severity ?? null,
    riskScore: row.risk_score ?? null,
    riskCategoryRaw: row.risk_category ?? null,
    priority: row.priority ?? null,
    likelyIssue: row.likely_issue ?? null,
    riskEscalated: false,
    baseRiskScore: row.risk_score ?? null,
    baseRiskCategoryRaw: row.risk_category ?? null,
    insightCount: 0,
    upliftReasons: [],
  };
}

export function normaliseCharger(row: ApiCharger): ChargerRow {
  return {
    chargerId: row.charger_id,
    dockId: row.dock_id,
    stationId: row.station_id,
    online: row.online,
    faulty: row.faulty,
    lastSeen: row.last_seen ?? null,
    // GET /chargers now embeds the same scoring GET /chargers/scores does,
    // so this is populated directly rather than left null until a separate
    // merge succeeds — mergeChargerScore/mergeChargerOperationsRisk still
    // run to confirm/refresh these from their own dedicated calls.
    healthScore: row.health_score ?? null,
    healthClassification: row.health_classification ?? null,
    anomalyScore: row.anomaly_score ?? null,
    anomalySeverity: row.anomaly_severity ?? null,
    riskScore: row.risk_score ?? null,
    riskCategoryRaw: row.risk_category ?? null,
    priority: row.priority ?? null,
    likelyIssue: row.likely_issue ?? null,
  };
}

/** Merges the dock's own AI scoring into a charger row — kept for the
 * Chargers list/detail pages (see `deriveDockAssetId` in resources.ts). The
 * platform now also exposes a real per-charger score directly (GET
 * /chargers/scores, see `mergeChargerScore` below) — this dock-derived path
 * predates that and is a candidate to retire in a future pass. */
export function mergeChargerDockRisk(
  row: ChargerRow,
  asset: ApiAsset | undefined,
): ChargerRow {
  if (!asset) return row;
  return {
    ...row,
    healthScore: asset.health_score,
    healthClassification: asset.health_classification,
    anomalyScore: asset.anomaly_score,
    anomalySeverity: asset.anomaly_severity,
    riskScore: asset.risk_score,
    riskCategoryRaw: asset.risk_category,
    priority: asset.priority,
    likelyIssue: asset.likely_issue,
  };
}

/** Merges the charger's own real AI score (GET /chargers/scores) into a
 * charger row — keyed by the fleet-unique charger_uid
 * ("<station_id>-<charger_id>"), not the reused charger_id alone. */
export function mergeChargerScore(
  row: ChargerRow,
  score: ApiChargerScore | undefined,
): ChargerRow {
  if (!score) return row;
  return {
    ...row,
    healthScore: score.health_score,
    healthClassification: score.health_classification,
    anomalyScore: score.anomaly_score,
    anomalySeverity: score.anomaly_severity,
    riskScore: score.risk_score,
    riskCategoryRaw: score.risk_category,
    priority: score.priority,
    likelyIssue: score.likely_issue,
  };
}

/** Whichever battery is currently docked/charging at a charger — embedded in
 * GET /chargers/{charger_uid}, absent when the dock is empty. */
export interface ChargerCurrentBatteryView {
  batteryId: string;
  chargerStatus: string | null;
  chargingSocPercent: number | null;
  lastSeen: string | null;
  healthScore: number | null;
  healthClassification: string | null;
}

/** GET /chargers/{charger_uid} — the charger's own "Asset 360", the same
 * AI-scoring shape as a battery's or station's detail (dimensions, signals,
 * recommended checks), plus whichever battery is currently charging there. */
export interface ChargerDetailView {
  chargerUid: string;
  chargerId: string;
  stationId: string;
  dockId: string;
  location: string | null;
  online: boolean;
  faulty: boolean;
  healthScore: number;
  healthClassification: string;
  anomalyScore: number;
  anomalySeverity: string;
  riskScore: number;
  riskCategory: RiskCategory;
  riskCategoryRaw: string;
  priority: string;
  likelyIssue: string;
  predictionWindow: string;
  scoredAt: string;
  dimensions: { key: string; label: string; score: number }[];
  detectedSignals: string[];
  sla: string;
  businessImpact: string;
  suggestedChecks: string[];
  riskNote: string;
  currentBattery: ChargerCurrentBatteryView | null;
  /** Non-telemetry findings — same shape and meaning as a station's. Empty
   * when none apply. */
  aiInsights: AIInsightView[];
  equipment: EquipmentView;
}

export function normaliseChargerDetail(
  detail: ApiChargerDetail,
): ChargerDetailView {
  return {
    chargerUid: detail.charger_uid,
    chargerId: detail.charger_id,
    stationId: detail.station_id,
    dockId: detail.dock_id,
    location: detail.location,
    online: detail.online,
    faulty: detail.faulty,
    healthScore: detail.health_score,
    healthClassification: detail.health_classification,
    anomalyScore: detail.anomaly_score,
    anomalySeverity: detail.anomaly_severity,
    riskScore: detail.risk_score,
    riskCategory: riskCategory(detail.risk_category),
    riskCategoryRaw: detail.risk_category,
    priority: detail.priority,
    likelyIssue: detail.likely_issue,
    predictionWindow: detail.prediction_window,
    scoredAt: detail.scored_at,
    dimensions: Object.entries(detail.dimension_scores ?? {}).map(
      ([key, score]) => ({
        key,
        label: dimensionLabel(key),
        score,
      }),
    ),
    detectedSignals: detail.detected_signals ?? [],
    sla: detail.sla,
    businessImpact: detail.business_impact,
    suggestedChecks: detail.suggested_checks ?? [],
    riskNote: detail.risk_note,
    currentBattery: detail.current_battery
      ? {
          batteryId: detail.current_battery.battery_id,
          chargerStatus: detail.current_battery.charger_status,
          chargingSocPercent: detail.current_battery.charging_soc_percent,
          lastSeen: detail.current_battery.last_seen,
          healthScore: detail.current_battery.health_score,
          healthClassification: detail.current_battery.health_classification,
        }
      : null,
    aiInsights: (detail.ai_insights ?? [])
      .filter((insight) => insight.category !== "telemetry_risk")
      .map(normaliseAIInsight),
    equipment: normaliseEquipment(detail),
  };
}

// ---------------------------------------------------------------------------
// GET /operations/risk — the Predictive Operations screen's own risk list,
// one row per dock ("QIS-018-03"), carrying business_impact and a location
// string ("City, State") the per-type score endpoints don't. Used as the
// single risk source for the Dashboard's Top Risk Assets and the Map View,
// so both screens agree with each other and with the Predictive Operations
// screen itself.
// ---------------------------------------------------------------------------

export interface OperationsRiskRow {
  assetType: string;
  assetId: string;
  /** The API's own station_id, resolved for every type (not parsed) — null
   * only for the rare row the platform itself couldn't resolve one for. */
  stationId: string | null;
  /** Parsed from a DOCK-type asset id ("QIS-018-03" -> "D03") — null for
   * every other asset_type, or if the id doesn't match that shape. */
  dockId: string | null;
  location: string | null;
  riskScore: number;
  riskCategoryRaw: string;
  likelyIssue: string | null;
  businessImpact: string | null;
  priority: string;
  predictionWindow: string | null;
  scoredAt: string | null;
}

/** DOCK-type asset ids look like "QIS-018-03" — this pulls just the dock
 * number back out ("D03"), matching the format the charger register uses. */
function parseDockId(assetId: string): string | null {
  const match = assetId.match(/^QIS-\d+-(\d+)$/i);
  return match ? `D${match[1]}` : null;
}

/** Some deployments of GET /operations/risk stopped sending asset_type — the
 * id shape itself is unambiguous ("QIS-018-03" a dock, "QIS018" a station,
 * "QIS018-CHG11" a charger, "BAT..." a battery, "EV-..." a vehicle), so this
 * recovers the type rather than crashing the whole dashboard over one
 * dropped field. */
function inferAssetType(assetId: string): string {
  if (/^BAT/i.test(assetId)) return "BATTERY";
  if (/^EV-/i.test(assetId)) return "VEHICLE";
  if (/^QIS-\d+-\d+$/i.test(assetId)) return "DOCK";
  if (/^QIS\d+-CHG\d+$/i.test(assetId)) return "CHARGER";
  if (/^QIS\d+$/i.test(assetId)) return "STATION";
  return "UNKNOWN";
}

/** Recovers a DOCK or CHARGER row's own station_id from its asset_id when the
 * API doesn't send one directly — "QIS-018-03" and "QIS018-CHG11" both embed
 * their station's number. */
function inferStationId(assetType: string, assetId: string): string | null {
  if (assetType === "STATION") return assetId;
  if (assetType === "DOCK") {
    const digits = assetId.match(/^QIS-(\d+)-\d+$/i)?.[1];
    return digits ? `QIS${digits}` : null;
  }
  if (assetType === "CHARGER")
    return assetId.match(/^(QIS\d+)-CHG\d+$/i)?.[1] ?? null;
  return null;
}

export function normaliseOperationsRisk(
  row: ApiOperationsRiskItem,
): OperationsRiskRow {
  const assetType = row.asset_type ?? inferAssetType(row.asset_id);
  return {
    assetType,
    assetId: row.asset_id,
    stationId: row.station_id ?? inferStationId(assetType, row.asset_id),
    dockId:
      assetType.toUpperCase() === "DOCK" ? parseDockId(row.asset_id) : null,
    location: row.location,
    riskScore: row.risk_score,
    riskCategoryRaw: row.risk_category,
    likelyIssue: row.likely_issue,
    businessImpact: row.business_impact,
    priority: row.priority,
    predictionWindow: row.prediction_window ?? null,
    scoredAt: row.scored_at,
  };
}

/** Where a GET /operations/risk row's own page lives — DOCK has none, so it
 * falls back to the parent station (its station_id is always resolved). */
export function operationsRiskHref(row: OperationsRiskRow): string | null {
  switch (row.assetType.toUpperCase()) {
    case "BATTERY":
      return `/batteries/${row.assetId}`;
    case "VEHICLE":
      return `/vehicles/${row.assetId}`;
    case "STATION":
      return `/stations/${row.assetId}`;
    case "CHARGER": {
      // charger_uid is "<station_id>-<charger_id>" — both halves are
      // themselves hyphen-free, so this split is exact.
      const chargerId = row.stationId
        ? row.assetId.slice(row.stationId.length + 1)
        : null;
      return chargerId && row.stationId
        ? `/chargers/${chargerId}?station=${row.stationId}`
        : null;
    }
    case "DOCK":
      return row.stationId ? `/stations/${row.stationId}` : null;
    default:
      return null;
  }
}

/** Merges a station's own native risk (GET /operations/risk?asset_type=
 * STATION — identical to GET /stations/scores) into its row, so this figure
 * always matches what the station's own detail/list page shows rather than
 * a dock-derived proxy. */
export function mergeStationOperationsRisk(
  row: StationRow,
  risk: OperationsRiskRow | undefined,
): StationRow {
  if (!risk) return row;
  return {
    ...row,
    riskScore: risk.riskScore,
    riskCategoryRaw: risk.riskCategoryRaw,
    priority: risk.priority,
    likelyIssue: risk.likelyIssue,
  };
}

/** Merges a charger's own native risk (GET /operations/risk?asset_type=
 * CHARGER — identical to GET /chargers/scores) into its row, keyed by
 * charger_uid — not the dock it sits on, which can score differently. */
export function mergeChargerOperationsRisk(
  row: ChargerRow,
  risk: OperationsRiskRow | undefined,
): ChargerRow {
  if (!risk) return row;
  return {
    ...row,
    riskScore: risk.riskScore,
    riskCategoryRaw: risk.riskCategoryRaw,
    priority: risk.priority,
    likelyIssue: risk.likelyIssue,
  };
}

/** GET /stations/{id} — same AI-scoring shape as a battery's detail. */
/** One non-telemetry finding on a station's detail (GET /stations/{id}) —
 * see ApiAIInsight. */
export interface AIInsightView {
  category: string;
  label: string;
  severity: string;
  basis: string;
  contributesUplift: boolean;
  headline: string;
  detail: string | null;
  recommendedAction: string | null;
  note: string | null;
}

function normaliseAIInsight(insight: ApiAIInsight): AIInsightView {
  return {
    category: insight.category,
    label: insight.label,
    severity: insight.severity,
    basis: insight.basis,
    contributesUplift: insight.contributes_uplift,
    headline: insight.headline,
    detail: insight.detail,
    recommendedAction: insight.recommended_action,
    note: insight.note,
  };
}

export interface StationDetailView {
  stationId: string;
  location: string;
  healthScore: number;
  healthClassification: string;
  anomalyScore: number;
  anomalySeverity: string;
  /** The composite figures (raw risk folded together with any non-telemetry
   * insight below) when one applies — the "top", truest number. */
  riskScore: number;
  riskCategory: RiskCategory;
  riskCategoryRaw: string;
  priority: string;
  likelyIssue: string;
  predictionWindow: string;
  scoredAt: string;
  /** True when aiInsights below actually pushed the figures above beyond
   * the raw telemetry-only score. */
  riskEscalated: boolean;
  baseRiskScore: number;
  baseRiskCategoryRaw: string;
  upliftReasons: string[];
  dimensions: { key: string; label: string; score: number }[];
  detectedSignals: string[];
  /** Non-telemetry findings — maintenance history, seasonal climate
   * projections, regional connectivity rollups. Empty when none apply. */
  aiInsights: AIInsightView[];
  insightSignals: string[];
  sla: string;
  businessImpact: string;
  suggestedChecks: string[];
  riskNote: string;
}

export function normaliseStationDetail(
  detail: ApiStationDetail,
): StationDetailView {
  const hasComposite = detail.composite_risk_score !== null;
  return {
    stationId: detail.station_id,
    location: detail.location,
    healthScore: detail.health_score,
    healthClassification: detail.health_classification,
    anomalyScore: detail.anomaly_score,
    anomalySeverity: detail.anomaly_severity,
    riskScore: hasComposite
      ? (detail.composite_risk_score as number)
      : detail.risk_score,
    riskCategory: riskCategory(
      hasComposite
        ? (detail.composite_risk_category ?? detail.risk_category)
        : detail.risk_category,
    ),
    riskCategoryRaw: hasComposite
      ? (detail.composite_risk_category ?? detail.risk_category)
      : detail.risk_category,
    priority: hasComposite
      ? (detail.composite_priority ?? detail.priority)
      : detail.priority,
    likelyIssue: detail.likely_issue,
    predictionWindow: hasComposite
      ? (detail.composite_prediction_window ?? detail.prediction_window)
      : detail.prediction_window,
    scoredAt: detail.scored_at,
    riskEscalated: detail.composite_escalated,
    baseRiskScore: detail.risk_score,
    baseRiskCategoryRaw: detail.risk_category,
    upliftReasons: detail.uplift_reasons ?? [],
    dimensions: Object.entries(detail.dimension_scores ?? {}).map(
      ([key, score]) => ({
        key,
        label: dimensionLabel(key),
        score,
      }),
    ),
    detectedSignals: detail.detected_signals ?? [],
    // "telemetry_risk" insights just restate the base risk_score/
    // likely_issue/prediction_window already shown above and in Detected
    // Signals — dropped here so Additional AI Insights only ever shows
    // genuine non-telemetry findings (maintenance history, seasonal climate,
    // regional connectivity, etc.), for every asset this ever applies to.
    aiInsights: (detail.ai_insights ?? [])
      .filter((insight) => insight.category !== "telemetry_risk")
      .map(normaliseAIInsight),
    insightSignals: detail.insight_signals ?? [],
    sla: detail.sla,
    businessImpact: detail.business_impact,
    suggestedChecks: detail.suggested_checks ?? [],
    riskNote: detail.risk_note,
  };
}

/** GET /operations/predictive-warnings — spans every asset type, so this is
 * the real predictive-risk register (AI Predictions screen). */
export interface PredictiveWarningRow {
  assetType: string;
  assetId: string;
  location: string | null;
  riskScore: number;
  riskCategory: RiskCategory;
  riskCategoryRaw: string;
  priority: string;
  likelyIssue: string;
  predictionWindow: string;
  scoredAt: string;
  /** Link to the asset's own page, when this type has one. Docks don't have
   * a dedicated page, so they link to their parent station instead. */
  href: string | null;
}

function predictiveWarningHref(
  assetType: string,
  assetId: string,
): string | null {
  const type = assetType.toUpperCase();
  if (type === "BATTERY") return `/batteries/${assetId}`;
  if (type === "STATION") return `/stations/${assetId}`;
  // The 2W EV fleet's own asset_type string — "2W_EV" ids look like
  // "EV-2W-1015", which the DOCK/CHARGER regex below never matches, so this
  // case has to come first or a vehicle row silently gets no link at all.
  if (type === "2W_EV") return `/vehicles/${assetId}`;
  // DOCK and CHARGER ids here look like "QIS-018-03" — no per-dock page
  // exists, so link to the parent station (the id's first two segments).
  const stationMatch = assetId.match(/^([A-Za-z]+-?\d+)-\d+$/);
  if (stationMatch) return `/stations/${stationMatch[1].replace("-", "")}`;
  return null;
}

export function normalisePredictiveWarning(
  row: ApiPredictiveWarning,
): PredictiveWarningRow {
  return {
    assetType: row.asset_type,
    assetId: row.asset_id,
    location: row.location,
    riskScore: row.risk_score,
    riskCategory: riskCategory(row.risk_category),
    riskCategoryRaw: row.risk_category,
    priority: row.priority,
    likelyIssue: row.likely_issue,
    predictionWindow: row.prediction_window,
    scoredAt: row.scored_at,
    href: predictiveWarningHref(row.asset_type, row.asset_id),
  };
}

/** GET /assets — the dock register (QIS_DOCK assets), fully scored like a
 * battery: health, anomaly and predictive risk. */
export interface AssetRow {
  assetId: string;
  stationId: string;
  location: string;
  assetType: string;
  operationalStatus: string;
  healthScore: number;
  healthClassification: string;
  anomalyScore: number;
  anomalySeverity: string;
  riskScore: number;
  riskCategory: RiskCategory;
  riskCategoryRaw: string;
  priority: string;
  likelyIssue: string;
  predictionWindow: string;
}

export function normaliseAsset(row: ApiAsset): AssetRow {
  return {
    assetId: row.asset_id,
    stationId: row.station_id,
    location: row.location,
    assetType: row.asset_type,
    operationalStatus: row.operational_status,
    healthScore: row.health_score,
    healthClassification: row.health_classification,
    anomalyScore: row.anomaly_score,
    anomalySeverity: row.anomaly_severity,
    riskScore: row.risk_score,
    riskCategory: riskCategory(row.risk_category),
    riskCategoryRaw: row.risk_category,
    priority: row.priority,
    likelyIssue: row.likely_issue,
    predictionWindow: row.prediction_window,
  };
}

/** GET /assets/{id}/telemetry — daily dock-level aggregates. */
export interface AssetTelemetryPointView {
  date: string;
  temperature: number;
  chargingDuration: number;
  current: number;
  efficiency: number;
  offlineRate: number;
  swapSuccessRate: number;
  alertCount: number;
}

export function normaliseAssetTelemetry(
  points: ApiAssetTelemetryPoint[],
): AssetTelemetryPointView[] {
  return points.map((p) => ({
    date: p.date,
    temperature: p.charger_temperature_mean,
    chargingDuration: p.charging_duration_mean,
    current: p.output_current_mean,
    efficiency: p.efficiency_mean,
    offlineRate: p.offline_rate,
    swapSuccessRate: p.swap_success_rate,
    alertCount: p.alert_count,
  }));
}

/** There is no station-level telemetry endpoint — only per-dock (GET
 * /assets/{id}/telemetry). A station's trend is built by averaging every
 * dock at that station on each date (summing alert counts, since that's a
 * total rather than a mean). Docks that don't report on a given date simply
 * don't contribute to that date's average. */
export function aggregateStationTelemetry(
  perDock: AssetTelemetryPointView[][],
): AssetTelemetryPointView[] {
  const byDate = new Map<string, AssetTelemetryPointView[]>();
  for (const series of perDock) {
    for (const point of series) {
      const bucket = byDate.get(point.date);
      if (bucket) bucket.push(point);
      else byDate.set(point.date, [point]);
    }
  }

  const round1 = (n: number) => Math.round(n * 10) / 10;
  const mean = (
    points: AssetTelemetryPointView[],
    key: keyof AssetTelemetryPointView,
  ) =>
    round1(
      points.reduce((sum, p) => sum + (p[key] as number), 0) / points.length,
    );

  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, points]) => ({
      date,
      temperature: mean(points, "temperature"),
      chargingDuration: mean(points, "chargingDuration"),
      current: mean(points, "current"),
      efficiency: mean(points, "efficiency"),
      offlineRate: mean(points, "offlineRate"),
      swapSuccessRate: mean(points, "swapSuccessRate"),
      alertCount: points.reduce((sum, p) => sum + p.alertCount, 0),
    }));
}

/** Buckets for the Asset Health Distribution donut, from
 * GET /operations/health-distribution. */
export function normaliseDistribution(dist: ApiHealthDistribution): Bucket[] {
  return (
    [
      ["healthy", dist.healthy],
      ["warning", dist.warning],
      ["critical", dist.critical],
      ["offline", dist.offline],
    ] as [HealthState, { count: number; percent: number }][]
  ).map(([state, bucket]) => ({
    state,
    label: STATE_LABEL[state],
    count: bucket?.count ?? 0,
    pct: bucket?.percent ?? 0,
  }));
}
