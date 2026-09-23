import Link from "next/link";
import {
  INDIA_COS_MID,
  INDIA_MAX_LAT,
  INDIA_MIN_LNG,
  INDIA_PATH,
  INDIA_SCALE,
  INDIA_VIEW_H,
  INDIA_VIEW_W,
} from "./indiaOutline";
import { KIND_STYLE, type AssetKind } from "./TopRiskAssets";

export interface MapMarker {
  stationId: string;
  label: string;
  lat: number;
  lng: number;
  online: boolean;
  /** The station's own real predictive risk (GET /stations/scores) — null
   * only if that score didn't merge in. */
  riskScore: number | null;
  riskCategory: string | null;
  avgHealthScore: number;
}

/** A single non-station asset (battery, vehicle, charger or dock) plotted on
 * the network map with an icon matching its type — same icon/colour set the
 * dashboard's own Top Risk Assets list uses, so the two never disagree. */
export interface MapAssetMarker {
  id: string;
  kind: AssetKind;
  href: string;
  lat: number;
  lng: number;
  riskScore: number | null;
  riskCategory: string | null;
  issue: string | null;
}

export interface MapCityLabel {
  name: string;
  lat: number;
  lng: number;
  side?: "above" | "left" | "right";
}

/** Same projection the outline was generated with, expressed as a percentage
 * of the container, so HTML markers land exactly on the SVG boundary. */
function project(lat: number, lng: number): { x: number; y: number } {
  const x = ((lng - INDIA_MIN_LNG) * INDIA_COS_MID * INDIA_SCALE * 100) / INDIA_VIEW_W;
  const y = ((INDIA_MAX_LAT - lat) * INDIA_SCALE * 100) / INDIA_VIEW_H;
  return { x: Math.min(99, Math.max(1, x)), y: Math.min(99, Math.max(1, y)) };
}

const LABEL_STYLE: Record<"above" | "left" | "right", React.CSSProperties> = {
  above: { transform: "translate(-50%, -100%)", marginTop: "-3.4%" },
  left: { transform: "translate(-100%, -50%)", marginLeft: "-3.6%" },
  right: { transform: "translate(0, -50%)", marginLeft: "3.6%" },
};

function markerColor(marker: MapMarker): string {
  if (!marker.online) return "var(--text-muted)";
  if (marker.riskCategory === "CRITICAL" || marker.riskCategory === "HIGH") return "var(--status-critical)";
  if (marker.riskCategory === "MODERATE") return "var(--status-warning)";
  return "var(--status-good)";
}

function assetRiskColor(riskCategory: string | null): string {
  if (riskCategory === "CRITICAL" || riskCategory === "HIGH") return "var(--status-critical)";
  if (riskCategory === "MODERATE") return "var(--status-warning)";
  return "var(--status-good)";
}

export const MAP_LEGEND = [
  { label: "Low risk", color: "var(--status-good)" },
  { label: "Moderate risk", color: "var(--status-warning)" },
  { label: "High / critical risk", color: "var(--status-critical)" },
  { label: "Station offline", color: "var(--text-muted)" },
];

export function NetworkMap({
  stations,
  assets = [],
  cityLabels,
}: {
  stations: MapMarker[];
  /** Top-risk assets (battery/vehicle/charger/dock), one icon marker each —
   * rendered on top of the plain station dots so they stand out. */
  assets?: MapAssetMarker[];
  cityLabels: MapCityLabel[];
}) {
  return (
    <div
      className="relative mx-auto w-full max-w-[520px] overflow-hidden rounded-lg"
      style={{ aspectRatio: `${INDIA_VIEW_W} / ${INDIA_VIEW_H}` }}
    >
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox={`0 0 ${INDIA_VIEW_W} ${INDIA_VIEW_H}`}
        preserveAspectRatio="none"
        aria-hidden
      >
        <path
          d={INDIA_PATH}
          fill="color-mix(in srgb, var(--series-1) 7%, var(--surface-2))"
          stroke="color-mix(in srgb, var(--series-1) 45%, var(--text-muted))"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
        />
      </svg>

      {stations.map((marker) => {
        const { x, y } = project(marker.lat, marker.lng);
        const color = markerColor(marker);
        return (
          <Link
            key={marker.stationId}
            href={`/stations/${marker.stationId}`}
            title={`${marker.stationId} · ${marker.label} · ${
              !marker.online
                ? "Offline"
                : marker.riskScore !== null
                  ? `${Math.round(marker.riskScore)}% risk (${marker.riskCategory})`
                  : "Risk not available"
            } · avg health ${marker.avgHealthScore}`}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${x}%`, top: `${y}%` }}
          >
            <span
              className="block h-2 w-2 rounded-full ring-1 ring-white/80 transition-transform hover:scale-[2]"
              style={{ backgroundColor: color, boxShadow: "0 1px 2px rgba(0,0,0,0.25)" }}
            />
          </Link>
        );
      })}

      {/* One marker per category (battery/vehicle/charger/station), each its
          own current worst instance — rendered above the plain station dots,
          with a soft radar-style pulse so the four are easy to spot at a
          glance rather than blending into the dot field. */}
      {assets.map((asset) => {
        const { x, y } = project(asset.lat, asset.lng);
        const style = KIND_STYLE[asset.kind];
        const Icon = style.icon;
        const color = assetRiskColor(asset.riskCategory);
        return (
          <Link
            key={`${asset.kind}-${asset.id}`}
            href={asset.href}
            title={`${style.label} ${asset.id}${asset.issue ? ` · ${asset.issue}` : ""}${
              asset.riskScore !== null ? ` · ${Math.round(asset.riskScore)}% risk` : ""
            }`}
            className="group absolute z-20 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${x}%`, top: `${y}%` }}
          >
            <span
              className="absolute inset-0 -z-10 animate-ping rounded-full opacity-40"
              style={{ backgroundColor: color }}
            />
            <span
              className="flex h-6 w-6 items-center justify-center rounded-full ring-2 ring-white transition-transform group-hover:scale-125"
              style={{ backgroundColor: color, boxShadow: "0 2px 5px rgba(0,0,0,0.4)" }}
            >
              <Icon size={13} className="text-white" strokeWidth={2.5} />
            </span>
          </Link>
        );
      })}

      {/* Labels render above the marker clusters, with a halo so they stay
          legible over dense dots. */}
      {cityLabels.map((city) => {
        const { x, y } = project(city.lat, city.lng);
        const side = city.side ?? "above";
        return (
          <span
            key={city.name}
            className="pointer-events-none absolute z-10 whitespace-nowrap text-[9.5px] font-semibold uppercase tracking-wide text-text-primary"
            style={{
              left: `${x}%`,
              top: `${y}%`,
              textShadow:
                "0 0 3px var(--surface-1), 0 0 3px var(--surface-1), 0 0 6px var(--surface-1)",
              ...LABEL_STYLE[side],
            }}
          >
            {city.name}
          </span>
        );
      })}
    </div>
  );
}
