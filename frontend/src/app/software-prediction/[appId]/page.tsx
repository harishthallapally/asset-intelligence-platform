import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { Panel } from "@/components/ui/Panel";
import { ApiErrorState } from "@/components/ui/ApiErrorState";
import { RiskPill } from "@/components/ui/RiskPill";
import { HealthBar, healthColor } from "@/components/ui/HealthBar";
import { TelemetryChart } from "@/components/battery/TelemetryChart";
import { getAppDetail, getAppTrend } from "@/lib/api/resources";
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

const EXIT_REASON_TONE: Record<string, string> = {
  CRASH_MANAGED: "var(--status-critical)",
  ANR: "var(--status-serious)",
  LOW_MEMORY: "var(--series-7)",
  CPU_LIMIT: "var(--status-warning)",
  WATCHDOG: "var(--status-warning)",
};

function Fact({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[12px] text-text-muted">{name}</div>
      <div className="mt-1 text-[15px] font-semibold text-text-primary">{children}</div>
    </div>
  );
}

export default async function AppDetailPage({ params }: { params: Promise<{ appId: string }> }) {
  const { appId } = await params;
  const [{ data: app, error }, { data: trend }] = await Promise.all([getAppDetail(appId), getAppTrend(appId, 30)]);

  if (error || !app) {
    return (
      <PageShell title={appId} subtitle="">
        <ApiErrorState title={`Could not load ${appId}`} error={error ?? "Unknown error"} />
      </PageShell>
    );
  }

  const points = trend ?? [];
  const exitMax = Math.max(1, ...(app.exits?.byReason.map((r) => r.count) ?? [0]));
  const notScored = app.healthClassification?.toUpperCase() === "NOT_SCORED";

  return (
    <PageShell title={app.assetId} subtitle={app.version ? `v${app.version}` : ""}>
      <div className="flex flex-col gap-4">
        <Link
          href="/software-prediction"
          className="flex w-fit items-center gap-1.5 text-[13px] font-medium text-[var(--series-1)] hover:underline"
        >
          <ArrowLeft size={14} />
          All app cohorts
        </Link>

        <Panel>
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-4 xl:grid-cols-7">
            <Fact name="Platform">{platformLabel(app)}</Fact>
            <Fact name="Device">{[app.manufacturer, app.model].filter(Boolean).join(" · ") || "—"}</Fact>
            <Fact name="App Version">{app.version ?? "—"}</Fact>
            <Fact name="Installs">{app.installCount?.toLocaleString("en-IN") ?? "—"}</Fact>
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
          <Panel title="Health by Subsystem">
            {app.dimensions.length === 0 ? (
              <p className="text-[13px] text-text-muted">No subsystem scores reported.</p>
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

          <Panel title="Crash & ANR Prediction" action={<Sparkles size={16} className="text-[var(--series-1)]" />}>
            <p
              className="text-[13px] font-medium leading-relaxed"
              style={{ color: riskWarningColor(app.riskCategoryRaw ?? "LOW") }}
            >
              {app.likelyIssue ?? "No significant risk identified"}
            </p>
            {app.riskNote && (
              <p className="mt-3 text-[12.5px] leading-relaxed text-text-secondary">{app.riskNote}</p>
            )}
            <dl className="mt-4 space-y-1.5 border-t border-[var(--border-hairline)] pt-3 text-[12px]">
              {[
                ["Prediction window", app.predictionWindow],
                ["Confidence", app.confidenceBand && app.confidenceBand !== "NOT_APPLICABLE" ? label(app.confidenceBand) : null],
                ["Release implicated", app.attributedVersion ? `v${app.attributedVersion}` : null],
                ["Business impact", app.businessImpact],
                ["SLA", app.sla],
                ["Scored at", app.scoredAt ? formatScoredAt(app.scoredAt) : null],
              ].map(([name, value]) => (
                <div key={name} className="flex justify-between gap-3">
                  <dt className="text-text-muted">{name}</dt>
                  <dd className="text-right font-medium text-text-secondary">{value ?? "—"}</dd>
                </div>
              ))}
            </dl>
          </Panel>

          <Panel
            title="App Exits"
            titleNote={app.exits ? `(last ${app.exits.windowDays} days · ${app.exits.total.toLocaleString("en-IN")} total)` : undefined}
          >
            {!app.exits || app.exits.total === 0 ? (
              <p className="text-[13px] text-text-muted">No abnormal exits reported.</p>
            ) : (
              <>
                <ul className="space-y-2">
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
                    Most exits on{" "}
                    <span className="font-semibold text-text-primary">{app.exits.byScreen[0].screen}</span> (
                    {app.exits.byScreen[0].count})
                  </p>
                )}
              </>
            )}
          </Panel>
        </div>

        {points.length > 0 && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
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

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Panel title="Detected Signals">
            {app.detectedSignals.length === 0 ? (
              <p className="text-[13px] text-text-muted">No anomalies detected against this cohort&apos;s baseline.</p>
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

          <Panel title="Recommended Action">
            <p className="text-[13px] text-text-secondary">
              <span className="font-semibold text-text-primary">{app.priority ?? "—"}</span>
              {app.owner ? ` · ${app.owner}` : ""}
            </p>
            {app.recommendedAction && (
              <p className="mt-2 text-[13px] leading-relaxed text-text-primary">{app.recommendedAction}</p>
            )}
            {app.suggestedChecks.length > 0 && (
              <ol className="mt-3 ml-4 list-decimal space-y-1 text-[13px] text-text-secondary">
                {app.suggestedChecks.map((check) => (
                  <li key={check}>{check}</li>
                ))}
              </ol>
            )}
          </Panel>
        </div>
      </div>
    </PageShell>
  );
}
