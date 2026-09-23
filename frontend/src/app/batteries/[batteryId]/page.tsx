import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { Panel } from "@/components/ui/Panel";
import { ApiErrorState } from "@/components/ui/ApiErrorState";
import { RiskPill } from "@/components/ui/RiskPill";
import { HealthBar, healthColor } from "@/components/ui/HealthBar";
import { CreateFieldActionButton } from "@/components/battery/CreateFieldActionButton";
import { TelemetryChart } from "@/components/battery/TelemetryChart";
import { getBatteryDetail, getBatteryTelemetryPoints } from "@/lib/api/resources";
import { formatScoredAt } from "@/lib/formatScoredAt";
import { riskWarningColor } from "@/lib/riskColor";

const CLASSIFICATION_TONE: Record<string, string> = {
  HEALTHY: "var(--status-good)",
  WATCH: "var(--status-warning)",
  AT_RISK: "var(--status-serious)",
  CRITICAL: "var(--status-critical)",
};

function label(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function BatteryDetailPage({
  params,
}: {
  params: Promise<{ batteryId: string }>;
}) {
  const { batteryId } = await params;
  const [{ data: battery, error }, { data: telemetry }] = await Promise.all([
    getBatteryDetail(batteryId),
    getBatteryTelemetryPoints(batteryId, 14),
  ]);

  if (error || !battery) {
    return (
      <PageShell title={batteryId} subtitle="Battery 360">
        <ApiErrorState title={`Could not load ${batteryId}`} error={error ?? "Unknown error"} />
      </PageShell>
    );
  }

  const scoredLabel = formatScoredAt(battery.scoredAt);
  const telemetryRows = telemetry ?? [];

  return (
    <PageShell title={battery.batteryId} subtitle="Battery 360">
      <div className="flex flex-col gap-4">
        <Link
          href="/batteries"
          className="flex w-fit items-center gap-1.5 text-[13px] font-medium text-[var(--series-1)] hover:underline"
        >
          <ArrowLeft size={14} />
          All batteries
        </Link>

        <Panel>
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 xl:grid-cols-6">
            <div>
              <div className="text-[12px] text-text-muted">Condition</div>
              <div
                className="mt-1 text-[15px] font-semibold"
                style={{
                  color:
                    CLASSIFICATION_TONE[battery.healthClassification.toUpperCase()] ??
                    "var(--text-primary)",
                }}
              >
                {label(battery.healthClassification)}
              </div>
            </div>
            <div>
              <div className="text-[12px] text-text-muted">Health Score</div>
              <div
                className="mt-1 text-[15px] font-semibold tabular-nums"
                style={{ color: healthColor(battery.healthScore) }}
              >
                {battery.healthScore}
                <span className="text-[12px] font-normal text-text-muted">/100</span>
              </div>
            </div>
            <div>
              <div className="text-[12px] text-text-muted">Anomaly</div>
              <div className="mt-1 text-[15px] font-semibold tabular-nums text-text-primary">
                {battery.anomalyScore}
                <span className="ml-1 text-[12px] font-normal text-text-muted">
                  {label(battery.anomalySeverity)}
                </span>
              </div>
            </div>
            <div>
              <div className="text-[12px] text-text-muted">Predictive Risk</div>
              <div className="mt-1">
                <RiskPill percent={battery.riskScore} category={battery.riskCategoryRaw} showCategory />
              </div>
            </div>
            <div>
              <div className="text-[12px] text-text-muted">Priority</div>
              <div className="mt-1 text-[15px] font-semibold tabular-nums text-text-primary">
                {battery.priority}
              </div>
            </div>
            <div>
              <div className="text-[12px] text-text-muted">Prediction Window</div>
              <div className="mt-1 text-[13px] font-medium text-text-primary">
                {battery.predictionWindow}
              </div>
            </div>
          </div>
        </Panel>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Panel title="Health Dimensions">
            {battery.dimensions.length === 0 ? (
              <p className="text-[13px] text-text-muted">No dimension scores reported.</p>
            ) : (
              <ul className="space-y-3">
                {battery.dimensions.map((dimension) => (
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
            {battery.detectedSignals.length === 0 ? (
              <p className="text-[13px] text-text-muted">
                No anomaly signals detected against this pack&apos;s baseline.
              </p>
            ) : (
              <ul className="space-y-2">
                {battery.detectedSignals.map((signal) => (
                  <li key={signal} className="flex items-start gap-2 text-[13px] text-text-secondary">
                    <span className="mt-[7px] h-1.5 w-1.5 flex-none rounded-full bg-[var(--status-warning)]" />
                    {signal}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="AI Insight" action={<Sparkles size={16} className="text-[var(--series-1)]" />}>
            <p
              className="text-[13px] font-medium leading-relaxed"
              style={{ color: riskWarningColor(battery.riskCategoryRaw) }}
            >
              {battery.likelyIssue}
            </p>
            <p className="mt-3 text-[12.5px] leading-relaxed text-text-secondary">{battery.riskNote}</p>
            <dl className="mt-4 space-y-1.5 border-t border-[var(--border-hairline)] pt-3 text-[12px]">
              <div className="flex justify-between gap-3">
                <dt className="text-text-muted">Business impact</dt>
                <dd
                  className="font-medium"
                  style={{ color: battery.businessImpact.toUpperCase() === "HIGH" ? "var(--status-critical)" : "var(--text-secondary)" }}
                >
                  {battery.businessImpact}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-text-muted">SLA</dt>
                <dd className="text-right font-medium text-text-secondary">{battery.sla}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-text-muted">Scored at</dt>
                <dd className="font-medium text-text-secondary">{scoredLabel}</dd>
              </div>
            </dl>

            {/* Non-telemetry findings (GET /batteries/{id}'s ai_insights) —
                incident history, firmware risk, etc. Just the headline here —
                detail and recommended_action are dropped since the checks
                below in Recommended Field Action already cover that ground. */}
            {battery.aiInsights.length > 0 && (
              <ul className="mt-4 space-y-2.5 border-t border-[var(--border-hairline)] pt-3">
                {battery.aiInsights.map((insight, index) => (
                  <li key={`${insight.category}-${index}`}>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-text-muted ring-1 ring-[var(--border-hairline)]">
                        {label(insight.category)}
                      </span>
                      {insight.contributesUplift && (
                        <span
                          className="rounded px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide"
                          style={{ backgroundColor: "var(--status-critical-bg)", color: "var(--status-critical)" }}
                        >
                          Raised risk
                        </span>
                      )}
                    </div>
                    <p
                      className="mt-1 text-[12.5px] font-medium leading-relaxed"
                      style={{ color: insight.contributesUplift ? "var(--status-critical)" : "var(--text-secondary)" }}
                    >
                      {insight.headline}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        {telemetryRows.length > 0 && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel title="Battery Temperature" titleNote="(daily avg, °C)">
              <TelemetryChart data={telemetryRows} dataKey="temperature" color="var(--status-critical)" unit="°C" gradientId="battery-temp" />
            </Panel>
            <Panel title="State of Health" titleNote="(daily avg, %)">
              <TelemetryChart data={telemetryRows} dataKey="stateOfHealth" color="var(--status-good)" unit="%" gradientId="battery-soh" />
            </Panel>
            <Panel title="Charging Efficiency" titleNote="(daily avg, %)">
              <TelemetryChart data={telemetryRows} dataKey="efficiency" color="var(--series-1)" unit="%" gradientId="battery-efficiency" />
            </Panel>
            <Panel title="Charging Duration" titleNote="(daily avg, seconds)">
              <TelemetryChart data={telemetryRows} dataKey="chargingDuration" color="var(--status-warning)" unit="s" gradientId="battery-duration" />
            </Panel>
          </div>
        )}

        <Panel title="Recommended Field Action">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="text-[13px] text-text-secondary">
                <span className="font-semibold text-text-primary">{battery.priority}</span> ·{" "}
                {battery.sla} · {battery.likelyIssue}
              </p>
              {battery.suggestedChecks.length > 0 ? (
                <ol className="mt-3 ml-4 list-decimal space-y-1 text-[13px] text-text-secondary">
                  {battery.suggestedChecks.map((check) => (
                    <li key={check}>{check}</li>
                  ))}
                </ol>
              ) : (
                <p className="mt-2 text-[13px] text-text-muted">No checks suggested.</p>
              )}
            </div>
            <CreateFieldActionButton batteryId={battery.batteryId} sla={battery.sla} priority={battery.priority} />
          </div>
        </Panel>

      </div>
    </PageShell>
  );
}
