import { MAX_TELEMETRY_FETCH_DAYS, fitToRange, spanDays } from "@/lib/dateRange";
import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { Panel } from "@/components/ui/Panel";
import { ApiErrorState } from "@/components/ui/ApiErrorState";
import { RiskPill } from "@/components/ui/RiskPill";
import { HealthBar, healthColor } from "@/components/ui/HealthBar";
import { CreateFieldActionButton } from "@/components/battery/CreateFieldActionButton";
import { ShareOnWhatsAppButton } from "@/components/battery/ShareOnWhatsAppButton";
import { TelemetryChart } from "@/components/battery/TelemetryChart";
import { getAppDetail, getAppTrend, getPageDateRange } from "@/lib/api/resources";
import { CLASSIFICATION_TONE, label, platformLabel } from "@/lib/appFormat";
import { formatScoredAt } from "@/lib/formatScoredAt";
import { riskWarningColor } from "@/lib/riskColor";

const EXIT_REASON_LABEL: Record<string, string> = {
  CRASH_MANAGED: "Crash",
  ANR: "ANR (app not responding)",
  LOW_MEMORY: "Out of memory",
  CPU_LIMIT: "CPU limit",
  WATCHDOG: "Watchdog kill",
  SYSTEM_STOPPED: "Stopped by system",
  USER_REQUESTED: "Closed by user",
};

const PRIORITY_TONE: Record<string, string> = {
  P1: "var(--status-critical)",
  P2: "var(--status-serious)",
  P3: "var(--status-warning)",
};

const EXIT_REASON_TONE: Record<string, string> = {
  CRASH_MANAGED: "var(--status-critical)",
  ANR: "var(--status-serious)",
  LOW_MEMORY: "var(--series-7)",
  CPU_LIMIT: "var(--status-warning)",
  WATCHDOG: "var(--status-warning)",
};

export default async function AppDetailPage({
  params,
}: {
  params: Promise<{ appId: string }>;
}) {
  const { appId } = await params;
  const range = await getPageDateRange();
  const [{ data: app, error }, { data: trend }] = await Promise.all([
    getAppDetail(appId),
    getAppTrend(appId, Math.min(MAX_TELEMETRY_FETCH_DAYS, spanDays(range.from, range.to))),
  ]);

  if (error || !app) {
    return (
      <PageShell title={appId} subtitle="">
        <ApiErrorState title={`Could not load ${appId}`} error={error ?? "Unknown error"} />
      </PageShell>
    );
  }

  const points = fitToRange(trend ?? [], range.from, range.to);
  const exitMax = Math.max(1, ...(app.exits?.byReason.map((r) => r.count) ?? [0]));
  const notScored = app.healthClassification?.toUpperCase() === "NOT_SCORED";
  const scoredLabel = app.scoredAt ? formatScoredAt(app.scoredAt) : "—";

  return (
    <PageShell title={app.assetId} subtitle={app.version ? `v${app.version}` : ""}>
      <div className="flex flex-col gap-4">
        <Link
          href="/software-prediction"
          className="flex w-fit items-center gap-1.5 text-[13px] font-medium text-[var(--series-1)] hover:underline"
        >
          <ArrowLeft size={14} />
          All apps
        </Link>

        <Panel>
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-4 xl:grid-cols-7">
            <div>
              <div className="text-[12px] text-text-muted">Platform</div>
              <div className="mt-1 text-[15px] font-semibold text-text-primary">{platformLabel(app)}</div>
            </div>
            <div>
              <div className="text-[12px] text-text-muted">Device</div>
              <div className="mt-1 text-[15px] font-semibold text-text-primary">
                {[app.manufacturer, app.model].filter(Boolean).join(" · ") || "—"}
              </div>
            </div>
            <div>
              <div className="text-[12px] text-text-muted">Installs</div>
              <div className="mt-1 text-[15px] font-semibold tabular-nums text-text-primary">
                {app.installCount?.toLocaleString("en-IN") ?? "—"}
              </div>
            </div>
            <div>
              <div className="text-[12px] text-text-muted">Condition</div>
              <div
                className="mt-1 text-[15px] font-semibold"
                style={{
                  color: CLASSIFICATION_TONE[app.healthClassification?.toUpperCase() ?? ""] ?? "var(--text-primary)",
                }}
              >
                {label(app.healthClassification)}
              </div>
            </div>
            <div>
              <div className="text-[12px] text-text-muted">Health Score</div>
              {app.healthScore != null ? (
                <div className="mt-1 text-[15px] font-semibold tabular-nums" style={{ color: healthColor(app.healthScore) }}>
                  {app.healthScore}
                  <span className="text-[12px] font-normal text-text-muted">/100</span>
                </div>
              ) : (
                <div className="mt-1 text-[15px] text-text-muted">—</div>
              )}
            </div>
            <div>
              <div className="text-[12px] text-text-muted">Predictive Risk</div>
              <div className="mt-1">
                {app.riskScore != null ? (
                  <RiskPill percent={app.riskScore} category={app.riskCategoryRaw ?? "LOW"} showCategory />
                ) : (
                  <span className="text-[13px] text-text-muted">—</span>
                )}
              </div>
            </div>
            <div>
              <div className="text-[12px] text-text-muted">Priority</div>
              <div
                className="mt-1 text-[15px] font-semibold tabular-nums"
                style={{ color: app.priority ? (PRIORITY_TONE[app.priority] ?? "var(--text-primary)") : "var(--text-muted)" }}
              >
                {app.priority ?? "—"}
              </div>
            </div>
          </div>
          {notScored && (
            <p className="mt-4 border-t border-[var(--border-hairline)] pt-3 text-[12.5px] text-text-muted">
              Not scored yet — this cohort hasn&apos;t reported enough sessions
              {app.sessions != null ? ` (${app.sessions.toLocaleString("en-IN")} so far)` : ""} for a reliable health
              and risk score.
            </p>
          )}
        </Panel>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Panel title="Health Dimensions">
            {app.dimensions.length === 0 ? (
              <p className="text-[13px] text-text-muted">No dimension scores reported.</p>
            ) : (
              <ul className="space-y-3">
                {app.dimensions.map((dimension) => (
                  <li key={dimension.key} className="flex items-center gap-3">
                    <span className="w-36 flex-none text-[13px] text-text-secondary">{dimension.label}</span>
                    <div className="flex-1">
                      <HealthBar score={dimension.score} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Detected Signals">
            {app.detectedSignals.length === 0 ? (
              <p className="text-[13px] text-text-muted">No anomaly signals detected against this app&apos;s baseline.</p>
            ) : (
              <ul className="space-y-2">
                {app.detectedSignals.map((signal) => (
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
              style={{ color: riskWarningColor(app.riskCategoryRaw ?? "LOW") }}
            >
              {app.likelyIssue ?? "No significant risk identified"}
            </p>
            {app.riskNote && <p className="mt-3 text-[12.5px] leading-relaxed text-text-secondary">{app.riskNote}</p>}
            <dl className="mt-4 space-y-1.5 border-t border-[var(--border-hairline)] pt-3 text-[12px]">
              <div className="flex justify-between gap-3">
                <dt className="text-text-muted">Prediction window</dt>
                <dd className="text-right font-medium text-text-secondary">{app.predictionWindow ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-text-muted">Business impact</dt>
                <dd
                  className="font-medium"
                  style={{
                    color:
                      app.businessImpact?.toUpperCase() === "HIGH" ? "var(--status-critical)" : "var(--text-secondary)",
                  }}
                >
                  {app.businessImpact ?? "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-text-muted">SLA</dt>
                <dd className="text-right font-medium text-text-secondary">{app.sla ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-text-muted">Scored at</dt>
                <dd className="font-medium text-text-secondary">{scoredLabel}</dd>
              </div>
            </dl>
          </Panel>
        </div>

        {(trend ?? []).length > 0 && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel title="Crash Rate" titleNote="(daily, % of sessions)">
              <TelemetryChart data={points} dataKey="crashRatePct" color="var(--status-critical)" unit="%" gradientId="app-crash" />
            </Panel>
            <Panel title="ANR Rate" titleNote="(daily, % of sessions)">
              <TelemetryChart data={points} dataKey="anrRatePct" color="var(--status-serious)" unit="%" gradientId="app-anr" />
            </Panel>
            <Panel title="CPU · Main-Thread Block" titleNote="(daily p95, ms)">
              <TelemetryChart data={points} dataKey="mainThreadBlockMs" color="var(--status-warning)" unit="ms" gradientId="app-cpu" />
            </Panel>
            <Panel title="Memory · Peak Usage" titleNote="(daily p95, MB)">
              <TelemetryChart data={points} dataKey="peakMemoryMb" color="var(--series-7)" unit="MB" gradientId="app-mem" />
            </Panel>
            <Panel title="Network · API Latency" titleNote="(daily p95, ms)">
              <TelemetryChart data={points} dataKey="apiLatencyMs" color="var(--series-1)" unit="ms" gradientId="app-net" />
            </Panel>
            <Panel title="Bluetooth · Connect Success" titleNote="(daily, %)">
              <TelemetryChart data={points} dataKey="bleConnectSuccessPct" color="var(--status-good)" unit="%" gradientId="app-ble" />
            </Panel>
          </div>
        )}

        {app.exits && app.exits.total > 0 && (
          <Panel
            title="App Exits"
            titleNote={`(last ${app.exits.windowDays} days · ${app.exits.total.toLocaleString("en-IN")} total)`}
          >
            <ul className="grid grid-cols-1 gap-x-8 gap-y-2.5 sm:grid-cols-2">
              {app.exits.byReason.map(({ reason, count }) => (
                <li key={reason} className="text-[12.5px]">
                  <div className="flex justify-between gap-3">
                    <span className="text-text-secondary">{EXIT_REASON_LABEL[reason] ?? label(reason)}</span>
                    <span className="font-semibold tabular-nums text-text-primary">{count}</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-[var(--surface-2)]">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(count / exitMax) * 100}%`,
                        backgroundColor: EXIT_REASON_TONE[reason] ?? "var(--text-muted)",
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
            {app.exits.byScreen[0] && app.exits.byScreen[0].count > 0 && (
              <p className="mt-3 border-t border-[var(--border-hairline)] pt-3 text-[12px] text-text-muted">
                Most exits on <span className="font-semibold text-text-primary">{app.exits.byScreen[0].screen}</span> (
                {app.exits.byScreen[0].count})
              </p>
            )}
          </Panel>
        )}

        <Panel title="Recommended Field Action">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="text-[13px] text-text-secondary">
                <span className="font-semibold text-text-primary">{app.priority ?? "P4"}</span> ·{" "}
                {app.sla ?? "Routine"} · {app.likelyIssue ?? "No significant risk identified"}
              </p>
              {app.recommendedAction && (
                <p className="mt-2 text-[13px] leading-relaxed text-text-primary">{app.recommendedAction}</p>
              )}
              {app.suggestedChecks.length > 0 ? (
                <ol className="mt-3 ml-4 list-decimal space-y-1 text-[13px] text-text-secondary">
                  {app.suggestedChecks.map((check) => (
                    <li key={check}>{check}</li>
                  ))}
                </ol>
              ) : (
                <p className="mt-2 text-[13px] text-text-muted">No checks suggested.</p>
              )}
            </div>
            <div className="flex flex-none items-center gap-2">
              <ShareOnWhatsAppButton
                message={`App ${app.assetId} — ${app.priority ?? "P4"} priority, SLA ${
                  app.sla ?? "Routine"
                }. ${app.likelyIssue ?? "No significant risk identified"}`}
              />
              <CreateFieldActionButton
                batteryId={app.assetId}
                sla={app.sla ?? "Routine"}
                priority={app.priority ?? "P4"}
              />
            </div>
          </div>
        </Panel>
      </div>
    </PageShell>
  );
}
