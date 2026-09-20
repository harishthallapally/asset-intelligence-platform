import Link from "next/link";
import { PageShell } from "@/components/layout/PageShell";
import { Panel } from "@/components/ui/Panel";
import { ApiErrorState } from "@/components/ui/ApiErrorState";
import { RiskPill } from "@/components/ui/RiskPill";
import { MAP_LEGEND, NetworkMap, type MapCityLabel, type MapMarker } from "@/components/dashboard/NetworkMap";
import { cityCoordFromLocation, jitterCoord } from "@/lib/geo/indiaCities";
import { getStationsPage } from "@/lib/api/resources";
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

export default async function MapViewPage() {
  const { data, error } = await getStationsPage();

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

  return (
    <PageShell title="Map View" subtitle="Geographic distribution of stations and risk concentration">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title="Station Network" className="self-start lg:col-span-2">
          <NetworkMap stations={markers} cityLabels={cityLabels} />
          <div className="mt-4 flex flex-wrap gap-4">
            {MAP_LEGEND.map((item) => (
              <span key={item.label} className="flex items-center gap-1.5 text-[12px] text-text-secondary">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                {item.label}
              </span>
            ))}
          </div>
          <p className="mt-3 text-[12px] text-text-muted">
            Station health and risk are live, per station (GET /stations/scores). The platform does not yet
            expose per-station coordinates, so each marker is placed at its city&apos;s location rather than
            an exact site — click a marker to open that station.
            {unresolvedCities.length > 0 && (
              <>
                {" "}
                {unresolvedCities.length} station location{unresolvedCities.length === 1 ? "" : "s"} not shown
                (city not recognised): {unresolvedCities.join(", ")}.
              </>
            )}
          </p>
        </Panel>

        <div className="flex flex-col gap-4">
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
