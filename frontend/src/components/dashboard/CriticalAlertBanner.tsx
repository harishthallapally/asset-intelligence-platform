import Link from "next/link";
import { ArrowRight, TriangleAlert } from "lucide-react";
import { riskCategory, type StationRow } from "@/lib/api/normalise";

/**
 * Surfaces the riskiest P1 station at the top of the dashboard and links
 * straight to it. Renders nothing when no station is at P1.
 */
export function CriticalAlertBanner({ stations }: { stations: StationRow[] }) {
  const p1 = stations
    .filter((s) => s.priority === "P1")
    .sort((a, b) => (b.riskScore ?? -1) - (a.riskScore ?? -1));
  const worst = p1[0];
  if (!worst) return null;

  const category = riskCategory(worst.riskCategoryRaw ?? "LOW");
  const critical = !worst.online || category === "CRITICAL";
  const tone = critical ? "var(--status-critical)" : "var(--status-serious)";
  const bg = critical ? "var(--status-critical-bg)" : "var(--status-serious-bg)";
  const others = p1.length - 1;

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
            {others > 0 ? ` · ${others} other P1 station${others === 1 ? "" : "s"}` : ""}
          </span>
        </span>
      </span>
      <span
        className="flex flex-none items-center gap-1.5 text-[12.5px] font-semibold"
        style={{ color: tone }}
      >
        P1 · View station
        <ArrowRight size={13} />
      </span>
    </Link>
  );
}
