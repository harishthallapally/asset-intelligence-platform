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

export const MAP_LEGEND = [
  { label: "Low risk", color: "var(--status-good)" },
  { label: "Moderate risk", color: "var(--status-warning)" },
  { label: "High / critical risk", color: "var(--status-critical)" },
  { label: "Station offline", color: "var(--text-muted)" },
];

export function NetworkMap({ stations, cityLabels }: { stations: MapMarker[]; cityLabels: MapCityLabel[] }) {
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
