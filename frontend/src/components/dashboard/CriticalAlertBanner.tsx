import Link from "next/link";
import { ArrowRight, TriangleAlert } from "lucide-react";
import { riskCategory, type StationRow } from "@/lib/api/normalise";

/** An offline station always sorts to the top regardless of what it last
 * reported — the same rule the Map View and Stations screen use. */
function effectiveRisk(station: StationRow): number {
  return !station.online ? 100 : (station.riskScore ?? -1);
}

/**
 * Surfaces the single most urgent station at the top of the dashboard and
 * links straight to it, so the highest-priority action is one click from
 * landing. Renders nothing when nothing is above the Low risk band and every
 * station is online.
 */
export function CriticalAlertBanner({ stations }: { stations: StationRow[] }) {
  const worst = [...stations].sort((a, b) => effectiveRisk(b) - effectiveRisk(a))[0];
  if (!worst) return null;

  const category = riskCategory(worst.riskCategoryRaw ?? "LOW");
  if (worst.online && category === "LOW") return null;

  const critical = !worst.online || category === "CRITICAL";
  const tone = critical ? "var(--status-critical)" : "var(--status-serious)";
  const bg = critical ? "var(--status-critical-bg)" : "var(--status-serious-bg)";
  const others =
    stations.filter((s) => !s.online || riskCategory(s.riskCategoryRaw ?? "LOW") !== "LOW").length - 1;

  return (
    <Link
      href={`/stations/${worst.stationId}`}
      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl px-4 py-2.5 transition-opacity hover:opacity-90"
      style={{ backgroundColor: bg, border: `1px solid color-mix(in srgb, ${tone} 25%, transparent)` }}
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <TriangleAlert size={18} className="flex-none" style={{ color: tone }} />
        <span className="min-w-0 text-[13px]">
          <span className="font-semibold text-text-primary">
            {worst.stationId} needs attention
          </span>
          <span className="text-text-secondary">
            {" "}
            —{" "}
            {!worst.online
              ? "station offline"
              : `${Math.round(worst.riskScore ?? 0)}% predictive risk (${category.toLowerCase()})`}
            {worst.likelyIssue ? `, ${worst.likelyIssue}` : ""}
            {others > 0 ? ` · ${others} other station${others === 1 ? "" : "s"} also flagged` : ""}
          </span>
        </span>
      </span>
      <span
        className="flex flex-none items-center gap-1.5 text-[12.5px] font-semibold"
        style={{ color: tone }}
      >
        {worst.priority ?? "—"} · View station
        <ArrowRight size={13} />
      </span>
    </Link>
  );
}
