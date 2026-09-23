import Link from "next/link";
import { PageShell } from "@/components/layout/PageShell";
import { Panel } from "@/components/ui/Panel";
import { ApiErrorState } from "@/components/ui/ApiErrorState";
import { RiskPill } from "@/components/ui/RiskPill";
import { MAP_LEGEND, NetworkMap, type MapAssetMarker, type MapCityLabel, type MapMarker } from "@/components/dashboard/NetworkMap";
import { KIND_STYLE, TopRiskAssets, type RankedAsset } from "@/components/dashboard/TopRiskAssets";
import { cityCoordFromLocation, jitterCoord } from "@/lib/geo/indiaCities";
import { getStationsPage, getTopAssetPerCategory } from "@/lib/api/resources";
import { operationsRiskHref, type StationRow } from "@/lib/api/normalise";

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

function riskTextColor(riskCategoryRaw: string): string {
  const v = riskCategoryRaw.toUpperCase();
  if (v === "CRITICAL" || v === "HIGH") return "var(--status-critical)";
  if (v === "MODERATE") return "var(--status-warning)";
  return "var(--status-good)";
}

const KIND_BY_ASSET_TYPE: Record<string, RankedAsset["kind"]> = {
  BATTERY: "battery",
  CHARGER: "charger",
  STATION: "station",
  DOCK: "dock",
  VEHICLE: "vehicle",
};

/** One category's marker/list entry — the common fields needed to place and
 * rank it, whichever of the four categories it is. */
interface CategoryAsset {
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
  const [{ data, error }, categoryRows] = await Promise.all([getStationsPage(), getTopAssetPerCategory()]);

  if (error || !data) {
    return (
      <PageShell title="Map View" subtitle="Geographic distribution of stations and risk concentration">
        <ApiErrorState title="Could not load stations" error={error ?? "Unknown error"} />
      </PageShell>
    );
  }

  const stations = data.rows;
  const stationsOffline = stations.filter((s) => !s.online).length;
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

  // One marker per category — battery, vehicle, charger and station each
  // get their own single current worst instance, so all four always have a
  // presence on the map (never crowded out by whichever type happens to be
  // riskiest overall). Station comes from the already-loaded full register
  // (real composite scoring, not a fifth fetch); the other three come from
  // getTopAssetPerCategory. Dock is deliberately left out — it has no page
  // of its own to link to (see operationsRiskHref).
  // effectiveRisk is only used to pick *which* station is worst (an offline
  // one always wins that ranking, even if its last-known score looks fine) —
  // the percentage actually shown is the station's own real risk_score, never
  // the synthetic 100 that ranking uses. Showing that fabricated number here
  // would misrepresent a station's real, computed risk.
  const topStation = [...stations].sort((a, b) => effectiveRisk(b) - effectiveRisk(a))[0];
  const categoryAssets: CategoryAsset[] = [
    ...(topStation
      ? [
          {
            kind: "station" as const,
            id: topStation.stationId,
            href: `/stations/${topStation.stationId}`,
            location: topStation.name,
            riskScore: topStation.riskScore ?? 0,
            riskCategoryRaw: topStation.riskCategoryRaw ?? (!topStation.online ? "CRITICAL" : "LOW"),
            priority: topStation.priority ?? "P4",
            issue: !topStation.online ? "Station offline" : (topStation.likelyIssue ?? "No issue reported"),
          },
        ]
      : []),
    ...categoryRows.flatMap((row) => {
      const kind = KIND_BY_ASSET_TYPE[row.assetType.toUpperCase()];
      const href = operationsRiskHref(row);
      if (!kind || !href || row.riskScore == null) return [];
      return [
        {
          kind,
          id: row.assetId,
          href,
          location: row.location ?? "",
          riskScore: row.riskScore,
          riskCategoryRaw: row.riskCategoryRaw ?? "LOW",
          priority: row.priority,
          issue: row.likelyIssue ?? "No issue reported",
        },
      ];
    }),
  ].sort((a, b) => b.riskScore - a.riskScore);

  const topAssets: RankedAsset[] = categoryAssets.map((c) => ({
    id: c.id,
    key: `${c.kind}-${c.id}`,
    kind: c.kind,
    href: c.href,
    issue: c.issue,
    location: c.location,
    risk: c.riskScore,
    tag: c.priority,
  }));

  // Same four, placed on the map — each one's own `location` string resolves
  // to a city coordinate exactly like a station's does, jittered by its own
  // id so two categories that happen to share a city don't land on the same
  // spot (or exactly on that city's plain station dot).
  const assetMarkers: MapAssetMarker[] = categoryAssets.flatMap((c) => {
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
          {/* Actionable, not explanatory — a direct jump to each of the four
              flagged assets, so the map doubles as a shortcut bar instead of
              just a picture the user still has to go find things from. */}
          {categoryAssets.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2 border-t border-[var(--border-hairline)] pt-3">
              {categoryAssets.map((asset) => {
                const style = KIND_STYLE[asset.kind];
                const Icon = style.icon;
                return (
                  <Link
                    key={`${asset.kind}-${asset.id}`}
                    href={asset.href}
                    className="flex items-center gap-1.5 rounded-full border border-[var(--border-hairline)] py-1 pr-2.5 pl-1 text-[12px] font-medium text-text-secondary transition-colors hover:border-[var(--series-1)] hover:text-[var(--series-1)]"
                  >
                    <span
                      className="flex h-4 w-4 flex-none items-center justify-center rounded-full"
                      style={{ backgroundColor: style.color }}
                    >
                      <Icon size={9} className="text-white" strokeWidth={2.5} />
                    </span>
                    {asset.id}
                    <span className="font-semibold" style={{ color: riskTextColor(asset.riskCategoryRaw) }}>
                      {Math.round(asset.riskScore)}%
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
          {stationsOffline > 0 && (
            <p className="mt-2.5 text-[12px] text-text-muted">
              <span className="font-semibold text-[var(--status-critical)]">{stationsOffline}</span> of{" "}
              {stations.length} station{stations.length === 1 ? "" : "s"} offline right now.
            </p>
          )}
          {unresolvedCities.length > 0 && (
            <p className="mt-1.5 text-[11.5px] text-text-muted">
              {unresolvedCities.length} station location{unresolvedCities.length === 1 ? "" : "s"} not shown on the
              map (city not recognised): {unresolvedCities.join(", ")}.
            </p>
          )}
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel title="Top Risk Assets" titleNote="(one per category)">
            <TopRiskAssets assets={topAssets} limit={4} />
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
