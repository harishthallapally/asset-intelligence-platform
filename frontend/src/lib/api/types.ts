// Wire types for the AI Asset Intelligence Platform API.
//
// These mirror GET /dashboard/command-center exactly as the service returns it
// — snake_case and all — so the boundary is obvious. Everything downstream
// works from the normalised view model in `normalise.ts` instead.

export interface ApiStationCounts {
  total: number;
  online: number;
  offline: number;
}

export interface ApiChargerCounts {
  total: number;
  online: number;
  offline: number;
  /** Not mutually exclusive with online/offline — online + offline already
   * equals total, so a faulty charger is also counted in one of those. */
  faulty: number;
}

export interface ApiBatteryCounts {
  overall_health_score: number;
  overall_health_classification: string;
  total: number;
  healthy: number;
  watch: number;
  at_risk: number;
  critical: number;
  offline: number;
  high_risk_count: number;
  predicted_failure_count: number;
  /** Requested addition — absent until the service exposes it. */
  maintenance_due_count?: number | null;
}

export interface ApiAlert {
  timestamp: string;
  category: string;
  severity: string;
  entity_type: string;
  entity_id: string;
  station_id: string;
  description: string;
}

export interface ApiAtRiskBattery {
  battery_id: string;
  health_score: number;
  health_classification: string;
  anomaly_score: number;
  anomaly_severity: string;
  risk_score: number;
  risk_category: string;
  priority: string;
  likely_issue: string;
  prediction_window: string;
  /** Requested additions — absent until the service exposes them. */
  station_id?: string | null;
  failure_in_hours?: number | null;
}

export interface ApiFailureReason {
  reason: string;
  count: number;
  percent: number;
}

/** GET /batteries/health/trend?days=7 */
export interface ApiHealthTrendPoint {
  date: string;
  total: number;
  healthy_count: number;
  healthy_percent: number;
  warning_count: number;
  warning_percent: number;
  critical_count: number;
  critical_percent: number;
}

/** One bucket in GET /operations/health-distribution. */
export interface ApiDistributionBucket {
  count: number;
  percent: number;
}

export interface ApiDistributionGroup {
  total: number;
  healthy: ApiDistributionBucket;
  warning: ApiDistributionBucket;
  critical: ApiDistributionBucket;
  offline: ApiDistributionBucket;
}

/** GET /operations/health-distribution — all monitored assets, plus a split
 * by asset type (battery / charger / station). */
export interface ApiHealthDistribution extends ApiDistributionGroup {
  by_asset_type?: Record<string, ApiDistributionGroup>;
}

/** A risk figure from GET /operations/risk-summary. `note` explains how the
 * number was derived when it is an approximation. */
export interface ApiRiskFigure {
  count: number;
  percent: number;
  note?: string | null;
}

export interface ApiRiskSummary {
  total: number;
  window: string;
  high_risk_assets: ApiRiskFigure;
  maintenance_due: ApiRiskFigure;
  predicted_failures: ApiRiskFigure;
  by_asset_type?: Record<string, Record<string, ApiRiskFigure>>;
}

export interface ApiCommandCenter {
  stations: ApiStationCounts;
  chargers: ApiChargerCounts;
  batteries: ApiBatteryCounts;
  /** Absent on deployments that predate the 2W EV vehicle fleet. */
  vehicles?: ApiVehicleFleetSummary | null;
  top_critical_alerts: ApiAlert[];
  top_at_risk_batteries: ApiAtRiskBattery[];
  top_at_risk_vehicles?: ApiVehicleSummary[];
  top_failure_reasons: ApiFailureReason[];
  health_trend?: ApiHealthTrendPoint[] | null;
}

// ---------------------------------------------------------------------------
// GET /vehicles · GET /vehicles/summary · GET /vehicles/{asset_id}
//
// The 2W EV fleet — the same registry + scoring model as batteries/stations/
// chargers, keyed by asset_id ("EV-2W-1000") and carrying the vehicle's own
// registration_number (its number-plate code) alongside the health/risk
// scoring every other asset type gets.
// ---------------------------------------------------------------------------

export interface ApiVehicleFleetSummary {
  total: number;
  healthy: number;
  watch: number;
  at_risk: number;
  critical: number;
  offline: number;
  high_risk_count: number;
  predicted_failure_count: number;
  average_health_score?: number | null;
  as_of?: string | null;
}

/** One row of GET /vehicles, or of top_at_risk_vehicles / operations risk
 * lists that carry vehicles. */
export interface ApiVehicleSummary {
  asset_id: string;
  asset_type?: string | null;
  asset_sub_type?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  registration_number?: string | null;
  location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  home_station_id?: string | null;
  status?: string | null;
  operational_status?: string | null;
  last_seen?: string | null;
  health_score?: number | null;
  health_classification?: string | null;
  anomaly_score?: number | null;
  anomaly_severity?: string | null;
  risk_score?: number | null;
  risk_category?: string | null;
  priority?: string | null;
  likely_issue?: string | null;
  likely_issue_code?: string | null;
  scenario_id?: string | null;
  confidence?: number | null;
  confidence_band?: string | null;
  prediction_window?: string | null;
  scored_at?: string | null;
}

export interface ApiVehicleDimensionScores {
  battery?: number | null;
  motor?: number | null;
  energy_efficiency?: number | null;
  vehicle_performance?: number | null;
  connectivity?: number | null;
  operational?: number | null;
}

/** The vehicle's fitted battery warranty — "N months OR X km, whichever
 * comes first". `limiting_factor` names which limit binds (time / distance);
 * `as_of` is the fleet's latest data date the status was judged against. */
export interface ApiVehicleBatteryWarranty {
  status?: string | null;
  limiting_factor?: string | null;
  start?: string | null;
  end?: string | null;
  as_of?: string | null;
  months?: number | null;
  days_remaining?: number | null;
  distance_km?: number | null;
  distance_remaining_km?: number | null;
  odometer_km?: number | null;
}

/** GET /vehicles/{asset_id} — the vehicle's own Asset 360. */
export interface ApiVehicleDetail extends ApiVehicleSummary {
  dimension_scores?: ApiVehicleDimensionScores | null;
  detected_signals?: string[];
  sla?: string | null;
  business_impact?: string | null;
  recommended_action?: string | null;
  suggested_checks?: string[];
  risk_note?: string | null;
  battery_warranty?: ApiVehicleBatteryWarranty | null;
  battery_warranty_status?: string | null;
  /** Non-telemetry findings — same shape and meaning as a station's (incident
   * history, firmware risk, etc.). Empty when none apply. */
  ai_insights?: ApiAIInsight[];
  /** Equipment facts for the vehicle itself — separate from battery_warranty
   * above, which covers the fitted battery pack specifically. */
  firmware_version?: string | null;
  manufacture_date?: string | null;
  warranty_months?: number | null;
  warranty_status?: string | null;
}

/** One row of GET /vehicles/{asset_id}/telemetry — daily aggregates for a
 * single vehicle's own Asset 360 trend chart (battery temperature/SoC, motor,
 * energy/range, speed and connectivity uptime). */
export interface ApiVehicleTelemetryPoint {
  date?: string | null;
  battery_temperature_mean?: number | null;
  battery_temperature_max?: number | null;
  battery_soc_mean?: number | null;
  motor_temperature_mean?: number | null;
  motor_current_mean?: number | null;
  energy_consumption_total?: number | null;
  energy_per_km?: number | null;
  range_full_estimate?: number | null;
  distance_km?: number | null;
  vehicle_speed_mean?: number | null;
  connectivity_uptime?: number | null;
  reading_count?: number | null;
  error_count?: number | null;
}

// ---------------------------------------------------------------------------
// GET /batteries · GET /batteries/risk/top · GET /batteries/{id}
// ---------------------------------------------------------------------------

/** A row from GET /batteries — same shape as the dashboard's at-risk entries. */
export type ApiBattery = ApiAtRiskBattery;

/** GET /batteries/{id} — the list row plus the detail-only fields. */
export interface ApiBatteryDetail extends ApiBattery {
  dimension_scores: Record<string, number>;
  detected_signals: string[];
  sla: string;
  business_impact: string;
  suggested_checks: string[];
  risk_note: string;
  scored_at: string;
  /** Non-telemetry findings — same shape and meaning as a station's (incident
   * history, firmware risk, etc.). Empty when none apply. */
  ai_insights?: ApiAIInsight[];
  /** Equipment facts — same fields on every "unit" asset type (battery,
   * vehicle, charger); stations have none of these, being a location rather
   * than a single manufactured unit. */
  firmware_version?: string | null;
  manufacture_date?: string | null;
  warranty_months?: number | null;
  warranty_status?: string | null;
}

/** GET /batteries/summary — identical to the command-center battery block. */
export type ApiBatterySummary = ApiBatteryCounts;

/** One row of GET /batteries/{id}/telemetry — daily aggregates for a single
 * battery's own Asset 360 trend chart. Different field set from
 * ApiAssetTelemetryPoint (the dock's telemetry): a battery has no charger
 * temperature or offline_rate of its own, but does have cell-balance and
 * state-of-health, which no dock metric captures. */
export interface ApiBatteryTelemetryPoint {
  date: string;
  battery_temperature_mean?: number | null;
  charging_duration_mean?: number | null;
  efficiency_mean?: number | null;
  output_current_std?: number | null;
  soh_mean?: number | null;
  cell_voltage_delta_mean?: number | null;
  swap_success_rate?: number | null;
}

// ---------------------------------------------------------------------------
// GET /stations · GET /stations/summary · GET /chargers
// ---------------------------------------------------------------------------

export interface ApiStation {
  station_id: string;
  dock_count: number;
  chargers_online: number;
  chargers_offline: number;
  online: boolean;
  /** The plain average of this station's own docks' health scores — a
   * different figure from `health_score` below, which is the station's own
   * AI-scored health (not simply averaged from its docks). */
  avg_health_score: number;
  healthy_docks: number;
  at_risk_docks: number;
  critical_docks: number;
  high_risk_docks: number;
  /** The station's own AI health/risk score — GET /stations now embeds the
   * same scoring GET /stations/scores does, so the register never has to
   * fall back to avg_health_score for this. All nullable since older
   * deployments may not send them yet. */
  health_score?: number | null;
  health_classification?: string | null;
  anomaly_score?: number | null;
  anomaly_severity?: string | null;
  risk_score?: number | null;
  risk_category?: string | null;
  priority?: string | null;
  likely_issue?: string | null;
  prediction_window?: string | null;
  scored_at?: string | null;
  /** Requested additions — absent until the service exposes them. */
  latitude?: number | null;
  longitude?: number | null;
  name?: string | null;
  location?: string | null;
}

/** GET /stations/summary */
export type ApiStationSummary = ApiStationCounts;

/** One row of GET /stations/scores — the AI-scored summary for every
 * station in one call (health/anomaly/risk/priority/likely issue), separate
 * from the dock/charger overview GET /stations returns. */
export interface ApiStationScore {
  station_id: string;
  location: string;
  health_score: number;
  health_classification: string;
  anomaly_score: number;
  anomaly_severity: string;
  risk_score: number;
  risk_category: string;
  priority: string;
  likely_issue: string;
  prediction_window: string;
  scored_at: string;
  /** How many non-telemetry findings (GET /stations/{id}'s ai_insights) this
   * station has — 0 when none apply. */
  insight_count: number;
  /** How much those insights pushed risk above the raw telemetry-only
   * risk_score above; 0 when nothing escalated it. */
  risk_uplift: number;
  /** The "true" risk once insights are folded in — null when insight_count
   * is 0 (nothing to fold in, so it equals risk_score/risk_category/priority
   * anyway). This is the number to rank and colour by, not the raw one. */
  composite_risk_score: number | null;
  composite_risk_category: string | null;
  composite_priority: string | null;
  composite_prediction_window: string | null;
  /** True when the composite figures above actually differ from the raw
   * ones — i.e. an insight moved this station into a worse band. */
  composite_escalated: boolean;
  uplift_reasons: string[];
}

/** One non-telemetry finding attached to a station (GET /stations/{id}) —
 * maintenance history, a seasonal climate projection, a regional
 * connectivity rollup, etc. `basis` says where it came from so it's never
 * mistaken for a measured deviation; `contributes_uplift` says whether it
 * actually pushed the composite risk above the raw one. */
export interface ApiAIInsight {
  category: string;
  label: string;
  severity: string;
  basis: string;
  contributes_uplift: boolean;
  headline: string;
  detail: string | null;
  recommended_action: string | null;
  note: string | null;
}

/** GET /stations/{id} — the same AI-scoring shape as a battery's detail:
 * dimension scores, detected signals, and a recommended field action — plus
 * the composite/insight fields ApiStationScore also carries. */
export interface ApiStationDetail {
  station_id: string;
  location: string;
  health_score: number;
  health_classification: string;
  anomaly_score: number;
  anomaly_severity: string;
  risk_score: number;
  risk_category: string;
  priority: string;
  likely_issue: string;
  prediction_window: string;
  scored_at: string;
  insight_count: number;
  risk_uplift: number;
  composite_risk_score: number | null;
  composite_risk_category: string | null;
  composite_priority: string | null;
  composite_prediction_window: string | null;
  composite_escalated: boolean;
  uplift_reasons: string[];
  dimension_scores: Record<string, number>;
  detected_signals: string[];
  ai_insights: ApiAIInsight[];
  insight_signals: string[];
  sla: string;
  business_impact: string;
  suggested_checks: string[];
  risk_note: string;
}

export interface ApiCharger {
  charger_id: string;
  charger_uid?: string;
  dock_id: string;
  station_id: string;
  online: boolean;
  faulty: boolean;
  /** Null for chargers that have never reported — offline units send null here. */
  last_seen: string | null;
  /** The charger's own AI score — GET /chargers now embeds the same scoring
   * GET /chargers/scores does. Nullable since older deployments may not
   * send them yet. */
  health_score?: number | null;
  health_classification?: string | null;
  anomaly_score?: number | null;
  anomaly_severity?: string | null;
  risk_score?: number | null;
  risk_category?: string | null;
  priority?: string | null;
  likely_issue?: string | null;
  prediction_window?: string | null;
  scored_at?: string | null;
}

/** One row of GET /chargers/scores or /chargers/risk/top — the charger's own
 * real AI score, keyed by the fleet-unique `charger_uid` ("QIS018-CHG11")
 * rather than the reused `charger_id`. */
export interface ApiChargerScore {
  charger_uid: string;
  charger_id: string | null;
  station_id: string | null;
  dock_id: string | null;
  location: string | null;
  online: boolean;
  faulty: boolean;
  health_score: number | null;
  health_classification: string | null;
  anomaly_score: number | null;
  anomaly_severity: string | null;
  risk_score: number | null;
  risk_category: string | null;
  priority: string | null;
  likely_issue: string | null;
  prediction_window: string | null;
  scored_at: string | null;
}

/** Whichever battery is currently docked/charging at a charger, embedded in
 * GET /chargers/{charger_uid}. */
export interface ApiChargerCurrentBattery {
  battery_id: string;
  charger_status: string | null;
  charging_soc_percent: number | null;
  last_seen: string | null;
  health_score: number | null;
  health_classification: string | null;
}

/** GET /chargers/{charger_uid} — the charger's own "Asset 360": a native
 * AI score (dimensions, signals, recommended checks) the same shape as a
 * battery's or station's detail, keyed by the fleet-unique charger_uid
 * ("QIS018-CHG11") rather than the reused charger_id. */
export interface ApiChargerDetail {
  charger_uid: string;
  charger_id: string;
  station_id: string;
  dock_id: string;
  location: string | null;
  online: boolean;
  faulty: boolean;
  health_score: number;
  health_classification: string;
  anomaly_score: number;
  anomaly_severity: string;
  risk_score: number;
  risk_category: string;
  priority: string;
  likely_issue: string;
  prediction_window: string;
  scored_at: string;
  dimension_scores: Record<string, number>;
  detected_signals: string[];
  sla: string;
  business_impact: string;
  suggested_checks: string[];
  risk_note: string;
  current_battery: ApiChargerCurrentBattery | null;
  /** Non-telemetry findings — same shape and meaning as a station's (incident
   * history, firmware risk, etc.). Empty when none apply. */
  ai_insights?: ApiAIInsight[];
  /** Equipment facts — same fields as a battery's or vehicle's detail. */
  firmware_version?: string | null;
  manufacture_date?: string | null;
  warranty_months?: number | null;
  warranty_status?: string | null;
}

// ---------------------------------------------------------------------------
// Demo controls (POC-09 / spec section 14 — "Demo Data Control")
// ---------------------------------------------------------------------------

export interface ApiDemoScenario {
  code: string;
  label: string;
}

export interface ApiDemoDataset {
  name: string;
  path: string;
}

/** An asset row from GET /assets — the docks that scenarios can target. */
export interface ApiAsset {
  asset_id: string;
  station_id: string;
  location: string;
  asset_type: string;
  operational_status: string;
  health_score: number;
  health_classification: string;
  anomaly_score: number;
  anomaly_severity: string;
  risk_score: number;
  risk_category: string;
  priority: string;
  likely_issue: string;
  prediction_window: string;
}

// ---------------------------------------------------------------------------
// GET /operations/predictive-warnings · GET /operations/alerts ·
// GET /operations/risk · GET /assets/{id}/telemetry
// ---------------------------------------------------------------------------

/** One row of GET /operations/risk — docks and chargers again (asset_id
 * looks like "QIS-018-03"), but unlike /operations/predictive-warnings this
 * one carries `business_impact` and `scored_at`. No `sla` field exists here
 * — that is genuinely not something the platform scores for a dock/charger. */
/** Predictive Operations screen row — one scored asset of ANY type.
 * `asset_type` is STATION | CHARGER | DOCK | BATTERY, and `asset_id` is that
 * type's own key (station_id, charger_uid "<station>-<charger>", dock
 * asset_id, or battery_id). `station_id`/`location` are resolved for every
 * type, so a row is dispatchable on its own. */
export interface ApiOperationsRiskItem {
  /** Newer deployments of this endpoint stopped sending asset_type,
   * station_id and prediction_window — normaliseOperationsRisk infers a type
   * from the asset_id shape when it's missing. */
  asset_type?: string | null;
  asset_id: string;
  station_id?: string | null;
  location: string | null;
  risk_score: number;
  risk_category: string;
  likely_issue: string | null;
  business_impact: string | null;
  priority: string;
  prediction_window?: string | null;
  scored_at: string | null;
}

/** One row of GET /operations/predictive-warnings — spans every asset type
 * (BATTERY, STATION, DOCK, CHARGER), so this is the real "predictive risk
 * register" the AI Predictions screen wants. */
export interface ApiPredictiveWarning {
  asset_type: string;
  asset_id: string;
  location: string | null;
  risk_score: number;
  risk_category: string;
  priority: string;
  likely_issue: string;
  prediction_window: string;
  scored_at: string;
}

/** One row of GET /assets/{id}/telemetry — daily aggregates for a dock.
 * Batteries and vehicles have their own telemetry-history endpoints with a
 * different field set (see ApiBatteryTelemetryPoint / ApiVehicleTelemetryPoint);
 * there is still no per-charger telemetry endpoint, which is why a charger's
 * trend chart is borrowed from the dock it sits on. */
export interface ApiAssetTelemetryPoint {
  date: string;
  charger_temperature_mean: number;
  charging_duration_mean: number;
  output_current_mean: number;
  efficiency_mean: number;
  offline_rate: number;
  swap_success_rate: number;
  alert_count: number;
}

export interface ApiDemoResetResult {
  reset_at_utc: string;
  dataset: string;
  asset_count: number;
  battery_count: number;
  health_summary?: Record<string, number>;
  risk_summary?: Record<string, number>;
  battery_health_summary?: Record<string, number>;
  battery_risk_summary?: Record<string, number>;
}

/** POST /demo/inject returns the asset's freshly rescored state. */
export interface ApiDemoInjectResult {
  asset_id: string;
  scenario: string;
  scenario_label: string;
  severity: string;
  duration_days: number;
  metrics_perturbed: string[];
  health_score: number;
  health_classification: string;
  anomaly_score: number;
  anomaly_severity: string;
  risk_score: number;
  risk_category: string;
  likely_issue: string;
  priority: string;
}
