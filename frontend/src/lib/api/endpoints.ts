// The complete API surface, in one place.
//
// Interactive reference (Swagger UI): {API_BASE_URL}/docs
// Machine-readable schema:            {API_BASE_URL}/openapi.json
//
// Every path the dashboard can call is declared here rather than written inline
// at each call site, so the full surface is visible in one file, typos are
// caught by the compiler, and query parameters are built consistently.
//
// Keep this in sync with /docs.

function qs(params: Record<string, string | number | undefined | null>): string {
  const entries = Object.entries(params).filter(
    ([, value]) => value !== undefined && value !== null && value !== "",
  );
  if (entries.length === 0) return "";
  return `?${entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join("&")}`;
}

const id = (value: string) => encodeURIComponent(value);

export const ENDPOINTS = {
  // --- Service ---
  health: () => "/health",

  // --- Dashboard ---
  commandCenter: () => "/dashboard/command-center",

  // --- Batteries ---
  batteries: (p: { classification?: string; riskCategory?: string } = {}) =>
    `/batteries${qs({ classification: p.classification, risk_category: p.riskCategory })}`,
  battery: (batteryId: string) => `/batteries/${id(batteryId)}`,
  batterySummary: () => "/batteries/summary",
  batteryHealthTrend: (days = 7) => `/batteries/health/trend${qs({ days })}`,
  batteryTelemetry: (batteryId: string, days = 14) => `/batteries/${id(batteryId)}/telemetry${qs({ days })}`,
  batteriesTopRisk: (sortBy = "risk", order: "asc" | "desc" = "desc") =>
    `/batteries/risk/top${qs({ sort_by: sortBy, order })}`,

  // --- Assets (QIS docks) ---
  assets: (p: { classification?: string; riskCategory?: string } = {}) =>
    `/assets${qs({ classification: p.classification, risk_category: p.riskCategory })}`,
  asset: (assetId: string) => `/assets/${id(assetId)}`,
  assetEvents: (assetId: string, limit?: number) => `/assets/${id(assetId)}/events${qs({ limit })}`,
  assetTelemetry: (assetId: string, days = 7) => `/assets/${id(assetId)}/telemetry${qs({ days })}`,

  // --- Vehicles (2W EV fleet) ---
  vehicles: (p: { classification?: string; riskCategory?: string } = {}) =>
    `/vehicles${qs({ classification: p.classification, risk_category: p.riskCategory })}`,
  vehicle: (assetId: string) => `/vehicles/${id(assetId)}`,
  vehicleSummary: () => "/vehicles/summary",
  vehicleTelemetry: (assetId: string, days = 14) => `/vehicles/${id(assetId)}/telemetry${qs({ days })}`,
  vehiclesTopRisk: (sortBy = "risk", order: "asc" | "desc" = "desc", limit?: number) =>
    `/vehicles/risk/top${qs({ sort_by: sortBy, order, limit })}`,

  // --- Stations & chargers ---
  stations: () => "/stations",
  stationsSummary: () => "/stations/summary",
  stationsScores: () => "/stations/scores",
  station: (stationId: string) => `/stations/${id(stationId)}`,
  chargers: () => "/chargers",
  chargersSummary: () => "/chargers/summary",
  // Real per-charger AI score, keyed by the fleet-unique charger_uid — see
  // ApiChargerScore.
  chargersScores: () => "/chargers/scores",
  // The charger's own "Asset 360" — see ApiChargerDetail. chargerUid is
  // "<station_id>-<charger_id>", e.g. "QIS018-CHG11".
  chargerDetail: (chargerUid: string) => `/chargers/${id(chargerUid)}`,

  // --- Operations ---
  operationsSummary: () => "/operations/summary",
  operationsAlerts: (limit?: number) => `/operations/alerts${qs({ limit })}`,
  operationsPredictiveWarnings: (p: { assetType?: string; minCategory?: string } = {}) =>
    `/operations/predictive-warnings${qs({ asset_type: p.assetType, min_category: p.minCategory })}`,
  // asset_type filters to one type (STATION|CHARGER|DOCK|BATTERY); mix only
  // applies to the default risk/desc sort with no asset_type filter —
  // "balanced" (the API's own default) round-robins the worst of each type
  // so a top-N list isn't all-batteries, "strict" is the raw global ranking.
  operationsRisk: (
    p: {
      sortBy?: string;
      order?: "asc" | "desc";
      limit?: number;
      assetType?: string;
      mix?: "balanced" | "strict";
    } = {},
  ) => `/operations/risk${qs({ sort_by: p.sortBy, order: p.order, limit: p.limit, asset_type: p.assetType, mix: p.mix })}`,
  operationsRiskSummary: () => "/operations/risk-summary",
  operationsHealthDistribution: () => "/operations/health-distribution",
  operationsFailureReasons: (p: { limit?: number; scope?: string } = {}) =>
    `/operations/failure-reasons${qs({ limit: p.limit, scope: p.scope })}`,
  operationsRecommendations: (priority?: string) =>
    `/operations/recommendations${qs({ priority })}`,
  fieldActions: () => "/operations/field-actions",

  // --- Copilot ---
  copilotAsk: () => "/copilot/ask",
  copilotContext: () => "/copilot/context",
  copilotExampleQuestions: () => "/copilot/example-questions",

  // --- Demo controls ---
  demoScenarios: () => "/demo/scenarios",
  demoDatasets: () => "/demo/datasets",
  demoReset: () => "/demo/reset",
  demoInject: () => "/demo/inject",
  demoApplyPack: () => "/demo/apply-pack",
} as const;
