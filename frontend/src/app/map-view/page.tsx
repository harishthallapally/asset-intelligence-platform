import Link from "next/link";
import { PageShell } from "@/components/layout/PageShell";
import { Panel } from "@/components/ui/Panel";
import { ApiErrorState } from "@/components/ui/ApiErrorState";
import { RiskPill } from "@/components/ui/RiskPill";
import { MAP_LEGEND, NetworkMap, type MapAssetMarker, type MapCityLabel, type MapMarker } from "@/components/dashboard/NetworkMap";
import { KIND_STYLE, TopRiskAssets, type RankedAsset } from "@/components/dashboard/TopRiskAssets";
import { cityCoordFromLocation, jitterCoord } from "@/lib/geo/indiaCities";
import { getChargersPage, getStationsPage, getPredictiveWarningsPage } from "@/lib/api/resources";
import type { StationRow } from "@/lib/api/normalise";

/** Every station has a `location` string ("Bengaluru, Karnataka") but no
 * lat/lng of its own — the platform doesn't expose per-station coordinates
 * yet, so each station is placed at its city's coordinates (public,
 * verifiable geography), jittered so stations in the same city don't stack.
 * Risk/health are each station's own real figures (GET /stations/scores,
 * merged in by getStationsPage) — only the pin's position is city-level. */
function resolveMarker(station: StationRow): MapMarker | null {
  const coord = cityCoordFromLocation(station.name);
  if (!coord) return null;
  const jittered = jitterCoord(coord, station.stationId);
  return {
    stationId: station.stationId,
    label: station.name,
    lat: jittered.lat,
    lng: jittered.lng,
    online: station.online,
    riskScore: station.riskScore,
    riskCategory: station.riskCategoryRaw,
    avgHealthScore: station.avgHealthScore,
  };
}

/** An offline station always sorts to the top regardless of what it last
 * reported; otherwise this is the station's own risk score — the same
 * figure GET /stations/risk/top?sort_by=risk&order=desc would rank by
 * (StationsPage already carries it, composite-aware, so there's no need for
 * a second fetch to the dedicated endpoint). */
function effectiveRisk(station: StationRow): number {
  return !station.online ? 100 : (station.riskScore ?? -1);
}

// The predictive-warnings register's own asset_type strings — "2W_EV" is the
// 2-wheeler EV fleet's type string there (see normalisePredictiveWarning),
// distinct from the "VEHICLE" kind this UI renders it as.
const KIND_BY_ASSET_TYPE: Record<string, RankedAsset["kind"]> = {
  BATTERY: "battery",
  CHARGER: "charger",
  STATION: "station",
  DOCK: "dock",
  "2W_EV": "vehicle",
};

/** One P1 asset's marker/list entry — the common fields needed to place and
 * rank it, whichever asset type it is. */
interface P1Asset {
  kind: RankedAsset["kind"];
  id: string;
  href: string;
  location: string;
  riskScore: number;
  riskCategoryRaw: string;
  priority: string;
  issue: string;
}

export default async function MapViewPage() {
  const [{ data, error }, { data: predictiveRows }, { data: chargerRows }] = await Promise.all([
    getStationsPage(),
    getPredictiveWarningsPage(),
    getChargersPage(),
  ]);

  if (error || !data) {
    return (
      <PageShell title="Map View" subtitle="Geographic distribution of stations and risk concentration">
        <ApiErrorState title="Could not load stations" error={error ?? "Unknown error"} />
      </PageShell>
    );
  }

  const stations = data.rows;
  const markers = stations.map(resolveMarker).filter((m): m is MapMarker => m !== null);
  const unresolvedCities = [...new Set(stations.filter((s) => !cityCoordFromLocation(s.name)).map((s) => s.name))];

  // One label per city, at the city's own coordinate (not the jittered
  // per-station one), so the label doesn't drift with whichever station
  // happens to render last.
  const cityLabels: MapCityLabel[] = [...new Set(stations.map((s) => s.name.split(",")[0]?.trim()))]
    .map((city) => {
      const coord = city ? cityCoordFromLocation(city) : null;
      return coord ? { name: city!, lat: coord.lat, lng: coord.lng } : null;
    })
    .filter((c): c is MapCityLabel => c !== null);

  // Top 5 stations by their own real risk score (GET /stations/risk/top) —
  // an offline station still sorts to the top regardless.
  const topStations = [...stations].sort((a, b) => effectiveRisk(b) - effectiveRisk(a)).slice(0, 5);

  // Rolled up by city — ranked by real avg risk score (same figure as Top
  // Risk Stations), but "at risk" here is each city's real at-risk dock
  // count (GET /stations — highRiskDocks/atRiskDocks/criticalDocks), a more
  // granular real number than a per-station yes/no flag would give.
  const byCity = new Map<string, { stations: number; atRiskDocks: number; riskSum: number }>();
  for (const station of stations) {
    const city = station.name.split(",")[0]?.trim() ?? station.name;
    const entry = byCity.get(city) ?? { stations: 0, atRiskDocks: 0, riskSum: 0 };
    entry.stations += 1;
    entry.atRiskDocks += station.highRiskDocks + station.atRiskDocks + station.criticalDocks;
    entry.riskSum += effectiveRisk(station);
    byCity.set(city, entry);
  }
  const topCities = [...byCity.entries()]
    .sort((a, b) => b[1].riskSum / b[1].stations - a[1].riskSum / a[1].stations)
    .slice(0, 5);

  // Every asset currently at P1. Stations, vehicles, batteries and docks come
  // from GET /operations/predictive-warnings; chargers come from GET /chargers
  // instead, because the register's CHARGER rows are dock-level ids scored
  // differently and never match the priorities the Chargers screen shows.
  const locationByStation = new Map(stations.map((s) => [s.stationId, s.name]));
  const p1Chargers: P1Asset[] = (chargerRows ?? [])
    .filter((c) => c.priority === "P1" && c.riskScore != null)
    .map((c) => ({
      kind: "charger" as const,
      id: `${c.stationId}-${c.chargerId}`,
      href: `/chargers/${c.chargerId}?station=${c.stationId}`,
      location: locationByStation.get(c.stationId) ?? "",
      riskScore: c.riskScore!,
      riskCategoryRaw: c.riskCategoryRaw ?? "LOW",
      priority: "P1",
      issue: c.likelyIssue ?? "No issue reported",
    }));
  const p1Register: P1Asset[] = (predictiveRows ?? [])
    .filter((row) => row.priority === "P1" && row.assetType.toUpperCase() !== "CHARGER")
    .flatMap((row) => {
      const kind = KIND_BY_ASSET_TYPE[row.assetType.toUpperCase()];
      if (!kind || !row.href || row.riskScore == null) return [];
      return [
        {
          kind,
          id: row.assetId,
          href: row.href,
          location: row.location ?? "",
          riskScore: row.riskScore,
          riskCategoryRaw: row.riskCategoryRaw ?? "LOW",
          priority: row.priority,
          issue: row.likelyIssue ?? "No issue reported",
        },
      ];
    });
  const p1Assets = [...p1Register, ...p1Chargers].sort((a, b) => b.riskScore - a.riskScore);

  // Side list: the riskiest P1 assets, capped per type (5 in total).
  const quota: Partial<Record<RankedAsset["kind"], number>> = { station: 2, vehicle: 2, battery: 1 };
  const taken = new Map<RankedAsset["kind"], number>();
  const topAssets: RankedAsset[] = p1Assets
    .filter((c) => {
      const count = taken.get(c.kind) ?? 0;
      if (count >= (quota[c.kind] ?? 0)) return false;
      taken.set(c.kind, count + 1);
      return true;
    })
    .map((c) => ({
      id: c.id,
      key: `${c.kind}-${c.id}`,
      kind: c.kind,
      href: c.href,
      issue: c.issue,
      location: c.location,
      risk: c.riskScore,
      tag: c.priority,
    }));

  // Same set, placed on the map — each one's own `location` string resolves
  // to a city coordinate exactly like a station's does, jittered by its own
  // id so two assets that happen to share a city don't land on the same
  // spot (or exactly on that city's plain station dot).
  const assetMarkers: MapAssetMarker[] = p1Assets.flatMap((c) => {
    const coord = c.location ? cityCoordFromLocation(c.location) : null;
    if (!coord) return [];
    const jittered = jitterCoord(coord, `asset-${c.kind}-${c.id}`);
    return [
      {
        id: c.id,
        kind: c.kind,
        href: c.href,
        lat: jittered.lat,
        lng: jittered.lng,
        riskScore: c.riskScore,
        riskCategory: c.riskCategoryRaw,
        issue: c.issue,
      },
    ];
  });

  return (
    <PageShell title="Map View" subtitle="Geographic distribution of stations and risk concentration">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title="Station Network" className="self-start lg:col-span-2">
          <NetworkMap stations={markers} assets={assetMarkers} cityLabels={cityLabels} />
          <div className="mt-4 flex flex-wrap gap-4">
            {MAP_LEGEND.map((item) => (
              <span key={item.label} className="flex items-center gap-1.5 text-[12px] text-text-secondary">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                {item.label}
              </span>
            ))}
          </div>
          {assetMarkers.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-4 border-t border-[var(--border-hairline)] pt-2.5">
              {[...new Set(assetMarkers.map((asset) => asset.kind))].map((kind) => {
                const style = KIND_STYLE[kind];
                const Icon = style.icon;
                return (
                  <span key={kind} className="flex items-center gap-1.5 text-[12px] text-text-secondary">
                    <span
                      className="flex h-4 w-4 items-center justify-center rounded-full"
                      style={{ backgroundColor: style.color }}
                    >
                      <Icon size={9} className="text-white" strokeWidth={2.5} />
                    </span>
                    {style.label}
                  </span>
                );
              })}
            </div>
          )}
          {unresolvedCities.length > 0 && (
            <p className="mt-1.5 text-[11.5px] text-text-muted">
              {unresolvedCities.length} station location{unresolvedCities.length === 1 ? "" : "s"} not shown on the
              map (city not recognised): {unresolvedCities.join(", ")}.
            </p>
          )}
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel title="Top Risk Assets" titleNote="(top 5 at P1 priority)">
            <TopRiskAssets assets={topAssets} limit={5} />
          </Panel>

          <Panel title="Top Risk Stations" titleNote={`(top ${Math.min(5, topStations.length)} by risk score)`}>
            <ul className="-my-1 divide-y divide-[var(--border-hairline)]">
              {topStations.map((station) => (
                <li key={station.stationId}>
                  <Link
                    href={`/stations/${station.stationId}`}
                    className="flex items-center justify-between gap-3 py-2.5 hover:bg-[var(--surface-2)]"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-medium text-text-primary">
                        {station.stationId}
                      </span>
                      <span className="block truncate text-[12px] text-text-muted">{station.name}</span>
                    </span>
                    {!station.online ? (
                      <span
                        className="flex-none whitespace-nowrap rounded-md px-2 py-1 text-[12px] font-semibold"
                        style={{ backgroundColor: "var(--status-critical-bg)", color: "var(--status-critical)" }}
                      >
                        Offline
                      </span>
                    ) : station.riskScore !== null && station.riskCategoryRaw ? (
                      <RiskPill percent={station.riskScore} category={station.riskCategoryRaw} />
                    ) : (
                      <span className="flex-none text-[12px] text-text-muted">—</span>
                    )}
                  </Link>
                </li>
              ))}
              {topStations.length === 0 && <p className="py-4 text-[13px] text-text-muted">No stations.</p>}
            </ul>
          </Panel>

          <Panel title="By City" titleNote={`(top ${Math.min(5, topCities.length)} by avg risk)`}>
            <ul className="-my-1 divide-y divide-[var(--border-hairline)]">
              {topCities.map(([city, entry]) => (
                <li key={city} className="flex items-center justify-between gap-3 py-2.5 text-[13px]">
                  <span className="text-text-secondary">{city}</span>
                  <span className="tabular-nums text-text-muted">
                    {entry.stations} station{entry.stations === 1 ? "" : "s"} ·{" "}
                    <span className="font-semibold text-[var(--status-critical)]">{entry.atRiskDocks}</span> at
                    risk
                  </span>
                </li>
              ))}
              {topCities.length === 0 && <p className="py-4 text-[13px] text-text-muted">No cities.</p>}
            </ul>
          </Panel>
        </div>
      </div>
    </PageShell>
  );
}
