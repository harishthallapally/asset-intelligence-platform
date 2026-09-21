import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { Panel } from "@/components/ui/Panel";
import { ApiErrorState } from "@/components/ui/ApiErrorState";
import { RiskPill } from "@/components/ui/RiskPill";
import { HealthBar, healthColor } from "@/components/ui/HealthBar";
import { getVehicleDetail } from "@/lib/api/resources";
import { formatScoredAt } from "@/lib/formatScoredAt";
import { riskWarningColor } from "@/lib/riskColor";

const CLASSIFICATION_TONE: Record<string, string> = {
  HEALTHY: "var(--status-good)",
  WATCH: "var(--status-warning)",
  AT_RISK: "var(--status-serious)",
  CRITICAL: "var(--status-critical)",
};

const WARRANTY_TONE: Record<string, string> = {
  IN_WARRANTY: "var(--status-good)",
  EXPIRING_SOON: "var(--status-warning)",
  EXPIRED: "var(--status-critical)",
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString("en-IN", { dateStyle: "medium" });
}

function label(value: string | null): string {
  if (!value) return "—";
  return value
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function VehicleDetailPage({
  params,
}: {
  params: Promise<{ vehicleId: string }>;
}) {
  const { vehicleId } = await params;
  const { data, error } = await getVehicleDetail(vehicleId);

  if (error || !data) {
    return (
      <PageShell title={vehicleId} subtitle="Vehicle 360">
        <ApiErrorState
          title={`Could not load ${vehicleId}`}
          error={error ?? "Unknown error"}
        />
      </PageShell>
    );
  }

  const vehicle = data;

  const scoredLabel = vehicle.scoredAt ? formatScoredAt(vehicle.scoredAt) : "—";

  return (
    <PageShell title={vehicle.assetId} subtitle="Vehicle 360">
      <div className="flex flex-col gap-4">
        <Link
          href="/vehicles"
          className="flex w-fit items-center gap-1.5 text-[13px] font-medium text-[var(--series-1)] hover:underline"
        >
          <ArrowLeft size={14} />
          All vehicles
        </Link>

        <Panel>
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 xl:grid-cols-6">
            <div>
              <div className="text-[12px] text-text-muted">Vehicle Code</div>
              <div className="mt-1 font-mono text-[15px] font-semibold tracking-wide text-text-primary">
                {vehicle.registrationNumber ?? "—"}
              </div>
            </div>
            <div>
              <div className="text-[12px] text-text-muted">Model</div>
              <div className="mt-1 text-[15px] font-semibold text-text-primary">
                {vehicle.manufacturer
                  ? `${vehicle.manufacturer} ${vehicle.model ?? ""}`.trim()
                  : (vehicle.model ?? "—")}
              </div>
            </div>
            <div>
              <div className="text-[12px] text-text-muted">Home Station</div>
              <div className="mt-1 text-[15px] font-semibold text-text-primary">
                {vehicle.homeStationId ?? "—"}
              </div>
            </div>
            <div>
              <div className="text-[12px] text-text-muted">Condition</div>
              <div
                className="mt-1 text-[15px] font-semibold"
                style={{
                  color: vehicle.healthClassification
                    ? (CLASSIFICATION_TONE[
                        vehicle.healthClassification.toUpperCase()
                      ] ?? "var(--text-primary)")
                    : "var(--text-primary)",
                }}
              >
                {label(vehicle.healthClassification)}
              </div>
            </div>
            <div>
              <div className="text-[12px] text-text-muted">Health Score</div>
              {vehicle.healthScore != null ? (
                <div
                  className="mt-1 text-[15px] font-semibold tabular-nums"
                  style={{ color: healthColor(vehicle.healthScore) }}
                >
                  {vehicle.healthScore}
                  <span className="text-[12px] font-normal text-text-muted">
                    /100
                  </span>
                </div>
              ) : (
                <div className="mt-1 text-[15px] text-text-muted">—</div>
              )}
            </div>
            <div>
              <div className="text-[12px] text-text-muted">Predictive Risk</div>
              <div className="mt-1">
                {vehicle.riskScore != null ? (
                  <RiskPill
                    percent={vehicle.riskScore}
                    category={vehicle.riskCategoryRaw ?? "LOW"}
                    showCategory
                  />
                ) : (
                  <span className="text-[13px] text-text-muted">—</span>
                )}
              </div>
            </div>
          </div>
        </Panel>

        {vehicle.batteryWarranty && (
          <Panel title="Battery Warranty">
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 xl:grid-cols-6">
              <div>
                <div className="text-[12px] text-text-muted">Status</div>
                <div
                  className="mt-1 text-[15px] font-semibold"
                  style={{
                    color: vehicle.batteryWarranty.status
                      ? (WARRANTY_TONE[
                          vehicle.batteryWarranty.status.toUpperCase()
                        ] ?? "var(--text-primary)")
                      : "var(--text-primary)",
                  }}
                >
                  {label(vehicle.batteryWarranty.status)}
                </div>
              </div>
              <div>
                <div className="text-[12px] text-text-muted">
                  Limiting Factor
                </div>
                <div className="mt-1 text-[15px] font-semibold text-text-primary">
                  {label(vehicle.batteryWarranty.limitingFactor)}
                </div>
              </div>
              <div>
                <div className="text-[12px] text-text-muted">
                  Days Remaining
                </div>
                <div className="mt-1 text-[15px] font-semibold tabular-nums text-text-primary">
                  {vehicle.batteryWarranty.daysRemaining ?? "—"}
                </div>
              </div>
              <div>
                <div className="text-[12px] text-text-muted">
                  Distance Remaining
                </div>
                <div className="mt-1 text-[15px] font-semibold tabular-nums text-text-primary">
                  {vehicle.batteryWarranty.distanceRemainingKm != null
                    ? `${vehicle.batteryWarranty.distanceRemainingKm.toLocaleString("en-IN")} km`
                    : "—"}
                </div>
              </div>
              <div>
                <div className="text-[12px] text-text-muted">Odometer</div>
                <div className="mt-1 text-[15px] font-semibold tabular-nums text-text-primary">
                  {vehicle.batteryWarranty.odometerKm != null
                    ? `${vehicle.batteryWarranty.odometerKm.toLocaleString("en-IN")} km`
                    : "—"}
                </div>
              </div>
              <div>
                <div className="text-[12px] text-text-muted">Coverage</div>
                <div className="mt-1 text-[13px] font-medium text-text-primary">
                  {formatDate(vehicle.batteryWarranty.start)} –{" "}
                  {formatDate(vehicle.batteryWarranty.end)}
                </div>
              </div>
            </div>
          </Panel>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Panel title="Health Dimensions">
            {vehicle.dimensions.length === 0 ? (
              <p className="text-[13px] text-text-muted">
                No dimension scores reported.
              </p>
            ) : (
              <ul className="space-y-3">
                {vehicle.dimensions.map((dimension) => (
                  <li key={dimension.key} className="flex items-center gap-3">
                    <span className="w-32 flex-none text-[13px] text-text-secondary">
                      {dimension.label}
                    </span>
                    <div className="flex-1">
                      <HealthBar score={dimension.score} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Detected Signals">
            {vehicle.detectedSignals.length === 0 ? (
              <p className="text-[13px] text-text-muted">
                No anomaly signals detected against this vehicle&apos;s
                baseline.
              </p>
            ) : (
              <ul className="space-y-2">
                {vehicle.detectedSignals.map((signal) => (
                  <li
                    key={signal}
                    className="flex items-start gap-2 text-[13px] text-text-secondary"
                  >
                    <span className="mt-[7px] h-1.5 w-1.5 flex-none rounded-full bg-[var(--status-warning)]" />
                    {signal}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel
            title="AI Insight"
            action={<Sparkles size={16} className="text-[var(--series-1)]" />}
          >
            <p
              className="text-[13px] font-medium leading-relaxed"
              style={{
                color: riskWarningColor(vehicle.riskCategoryRaw ?? "LOW"),
              }}
            >
              {vehicle.likelyIssue ?? "No significant risk identified"}
            </p>
            {vehicle.riskNote && (
              <p className="mt-3 text-[12.5px] leading-relaxed text-text-secondary">
                {vehicle.riskNote}
              </p>
            )}
            <dl className="mt-4 space-y-1.5 border-t border-[var(--border-hairline)] pt-3 text-[12px]">
              <div className="flex justify-between gap-3">
                <dt className="text-text-muted">Business impact</dt>
                <dd
                  className="font-medium"
                  style={{
                    color:
                      vehicle.businessImpact?.toUpperCase() === "HIGH"
                        ? "var(--status-critical)"
                        : "var(--text-secondary)",
                  }}
                >
                  {vehicle.businessImpact ?? "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-text-muted">SLA</dt>
                <dd className="text-right font-medium text-text-secondary">
                  {vehicle.sla ?? "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-text-muted">Scored at</dt>
                <dd className="font-medium text-text-secondary">
                  {scoredLabel}
                </dd>
              </div>
            </dl>
          </Panel>
        </div>

        {vehicle.suggestedChecks.length > 0 && (
          <Panel title="Recommended Checks">
            <ol className="ml-4 list-decimal space-y-1 text-[13px] text-text-secondary">
              {vehicle.suggestedChecks.map((check) => (
                <li key={check}>{check}</li>
              ))}
            </ol>
          </Panel>
        )}
      </div>
    </PageShell>
  );
}
