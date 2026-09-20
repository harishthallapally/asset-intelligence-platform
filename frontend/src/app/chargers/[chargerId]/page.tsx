import Link from "next/link";
import { ArrowLeft, BatteryCharging, LayoutGrid, Plug, Sparkles, Warehouse } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { Panel } from "@/components/ui/Panel";
import { ApiErrorState } from "@/components/ui/ApiErrorState";
import { HealthBar, healthColor } from "@/components/ui/HealthBar";
import { RiskPill } from "@/components/ui/RiskPill";
import { StatusDot } from "@/components/ui/StatusDot";
import { TelemetryChart } from "@/components/battery/TelemetryChart";
import { CreateFieldActionButton } from "@/components/battery/CreateFieldActionButton";
import { getChargerDetail } from "@/lib/api/resources";
import { formatScoredAt } from "@/lib/formatScoredAt";
import { riskWarningColor } from "@/lib/riskColor";

function label(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** The service sends `last_seen: null` for chargers that have never reported;
 * without this guard `new Date(null)` renders as 1 Jan 1970. */
function formatLastSeen(value: string | null): string {
  if (!value) return "Never";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.getTime() === 0) return "Never";
  return parsed.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export default async function ChargerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ chargerId: string }>;
  // `charger_id` repeats across stations (CHG01..CHG15 at every station), so
  // the station id disambiguates which charger this page means.
  searchParams: Promise<{ station?: string }>;
}) {
  const { chargerId } = await params;
  const { station: stationId } = await searchParams;
  const { data, error } = await getChargerDetail(chargerId, stationId);

  if (error || !data) {
    return (
      <PageShell title={chargerId} subtitle="Charger detail">
        <ApiErrorState title={`Could not load ${chargerId}${stationId ? ` at ${stationId}` : ""}`} error={error ?? "Unknown error"} />
      </PageShell>
    );
  }

  const { charger, scoring, station, telemetry } = data;
  const scoredLabel = scoring ? formatScoredAt(scoring.scoredAt) : null;

  return (
    <PageShell title={`${charger.stationId} · ${charger.chargerId}`} subtitle={`Dock ${charger.dockId}`}>
      <div className="flex flex-col gap-4">
        <Link
          href="/chargers"
          className="flex w-fit items-center gap-1.5 text-[13px] font-medium text-[var(--series-1)] hover:underline"
        >
          <ArrowLeft size={14} />
          All chargers
        </Link>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Panel>
            <div className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl"
                style={{ backgroundColor: "color-mix(in srgb, var(--series-1) 12%, transparent)" }}
              >
                <Plug size={19} style={{ color: "var(--series-1)" }} />
              </span>
              <div>
                <div className="text-[12px] text-text-muted">Status</div>
                <div className="mt-0.5">
                  <StatusDot status={charger.online ? "ONLINE" : "OFFLINE"} />
                </div>
              </div>
            </div>
            <div className="mt-4 text-[12px] text-text-muted">Faulty</div>
            <div className="mt-1 text-[15px] font-semibold" style={{ color: charger.faulty ? "var(--status-critical)" : "var(--text-primary)" }}>
              {charger.faulty ? "Yes — fault reported" : "No"}
            </div>
          </Panel>

          <Panel>
            <div className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl"
                style={{ backgroundColor: "color-mix(in srgb, var(--series-7) 12%, transparent)" }}
              >
                <LayoutGrid size={19} style={{ color: "var(--series-7)" }} />
              </span>
              <div>
                <div className="text-[12px] text-text-muted">Dock</div>
                <div className="mt-0.5 text-[15px] font-semibold text-text-primary">{charger.dockId}</div>
              </div>
            </div>
            <div className="mt-4 text-[12px] text-text-muted">Last Seen</div>
            <div className="mt-1 text-[13px] font-medium tabular-nums text-text-primary">
              {formatLastSeen(charger.lastSeen)}
            </div>
          </Panel>

          <Panel>
            <div className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl"
                style={{ backgroundColor: "color-mix(in srgb, var(--status-good) 12%, transparent)" }}
              >
                <Warehouse size={19} style={{ color: "var(--status-good)" }} />
              </span>
              <div>
                <div className="text-[12px] text-text-muted">Station</div>
                <Link
                  href={`/stations/${charger.stationId}`}
                  className="mt-0.5 block text-[15px] font-semibold text-[var(--series-1)] hover:underline"
                >
                  {charger.stationId}
                </Link>
              </div>
            </div>
            {station && (
              <>
                <div className="mt-4 text-[12px] text-text-muted">Station Avg Dock Health</div>
                <div className="mt-1">
                  <HealthBar score={station.avgHealthScore} />
                </div>
              </>
            )}
          </Panel>
        </div>

        {/* GET /chargers/{charger_uid} — the charger's own real AI score, not
            derived from the dock it sits on. */}
        {scoring && (
          <>
            <Panel>
              <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 xl:grid-cols-6">
                <div>
                  <div className="text-[12px] text-text-muted">Condition</div>
                  <div className="mt-1 text-[15px] font-semibold" style={{ color: riskWarningColor(scoring.riskCategoryRaw) }}>
                    {label(scoring.healthClassification)}
                  </div>
                </div>
                <div>
                  <div className="text-[12px] text-text-muted">Health Score</div>
                  <div
                    className="mt-1 text-[15px] font-semibold tabular-nums"
                    style={{ color: healthColor(scoring.healthScore) }}
                  >
                    {scoring.healthScore}
                    <span className="text-[12px] font-normal text-text-muted">/100</span>
                  </div>
                </div>
                <div>
                  <div className="text-[12px] text-text-muted">Anomaly</div>
                  <div className="mt-1 text-[15px] font-semibold tabular-nums text-text-primary">
                    {scoring.anomalyScore}
                    <span className="ml-1 text-[12px] font-normal text-text-muted">{label(scoring.anomalySeverity)}</span>
                  </div>
                </div>
                <div>
                  <div className="text-[12px] text-text-muted">Predictive Risk</div>
                  <div className="mt-1">
                    <RiskPill percent={scoring.riskScore} category={scoring.riskCategoryRaw} showCategory />
                  </div>
                </div>
                <div>
                  <div className="text-[12px] text-text-muted">Priority</div>
                  <div className="mt-1 text-[15px] font-semibold tabular-nums text-text-primary">{scoring.priority}</div>
                </div>
                <div>
                  <div className="text-[12px] text-text-muted">Prediction Window</div>
                  <div className="mt-1 text-[13px] font-medium text-text-primary">{scoring.predictionWindow}</div>
                </div>
              </div>
            </Panel>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Panel title="Health Dimensions">
                {scoring.dimensions.length === 0 ? (
                  <p className="text-[13px] text-text-muted">No dimension scores reported.</p>
                ) : (
                  <ul className="space-y-3">
                    {scoring.dimensions.map((dimension) => (
                      <li key={dimension.key} className="flex items-center gap-3">
                        <span className="w-32 flex-none text-[13px] text-text-secondary">{dimension.label}</span>
                        <div className="flex-1">
                          <HealthBar score={dimension.score} />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>

              <Panel title="Detected Signals">
                {scoring.detectedSignals.length === 0 ? (
                  <p className="text-[13px] text-text-muted">
                    No anomaly signals detected against this charger&apos;s baseline.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {scoring.detectedSignals.map((signal) => (
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
                  style={{ color: riskWarningColor(scoring.riskCategoryRaw) }}
                >
                  {scoring.likelyIssue}
                </p>
                <p className="mt-3 text-[12.5px] leading-relaxed text-text-secondary">{scoring.riskNote}</p>
                <dl className="mt-4 space-y-1.5 border-t border-[var(--border-hairline)] pt-3 text-[12px]">
                  <div className="flex justify-between gap-3">
                    <dt className="text-text-muted">Business impact</dt>
                    <dd
                      className="font-medium"
                      style={{ color: scoring.businessImpact.toUpperCase() === "HIGH" ? "var(--status-critical)" : "var(--text-secondary)" }}
                    >
                      {scoring.businessImpact}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-text-muted">SLA</dt>
                    <dd className="text-right font-medium text-text-secondary">{scoring.sla}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-text-muted">Scored at</dt>
                    <dd className="font-medium text-text-secondary">{scoredLabel}</dd>
                  </div>
                </dl>
              </Panel>
            </div>

            {scoring.currentBattery && (
              <Panel
                title="Current Battery"
                titleNote="(charging at this dock right now)"
                action={
                  <Link
                    href={`/batteries/${scoring.currentBattery.batteryId}`}
                    className="text-[12px] font-medium text-[var(--series-1)] hover:underline"
                  >
                    Open battery →
                  </Link>
                }
              >
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div>
                    <div className="text-[12px] text-text-muted">Battery</div>
                    <Link
                      href={`/batteries/${scoring.currentBattery.batteryId}`}
                      className="mt-1 block text-[15px] font-semibold text-[var(--series-1)] hover:underline"
                    >
                      {scoring.currentBattery.batteryId}
                    </Link>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 text-[12px] text-text-muted">
                      <BatteryCharging size={13} className="flex-none" />
                      Charging Status
                    </div>
                    <div className="mt-1 text-[15px] font-semibold text-text-primary">
                      {scoring.currentBattery.chargerStatus ? label(scoring.currentBattery.chargerStatus) : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[12px] text-text-muted">Charge Level</div>
                    <div className="mt-1 text-[15px] font-semibold tabular-nums text-text-primary">
                      {scoring.currentBattery.chargingSocPercent !== null
                        ? `${Math.round(scoring.currentBattery.chargingSocPercent)}%`
                        : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[12px] text-text-muted">Battery Health</div>
                    <div className="mt-1">
                      {scoring.currentBattery.healthScore !== null ? (
                        <HealthBar score={scoring.currentBattery.healthScore} />
                      ) : (
                        <span className="text-[13px] text-text-muted">—</span>
                      )}
                    </div>
                  </div>
                </div>
              </Panel>
            )}
          </>
        )}

        {station && (
          <Panel title="Parent Station" action={
            <Link href={`/stations/${station.stationId}`} className="text-[12px] font-medium text-[var(--series-1)] hover:underline">
              Open station →
            </Link>
          }>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <div className="text-[12px] text-text-muted">Docks</div>
                <div className="mt-1 text-[15px] font-semibold text-text-primary">{station.dockCount}</div>
              </div>
              <div>
                <div className="text-[12px] text-text-muted">Chargers Online</div>
                <div className="mt-1 text-[15px] font-semibold text-text-primary">{station.chargersOnline}</div>
              </div>
              <div>
                <div className="text-[12px] text-text-muted">High Risk Docks</div>
                <div className="mt-1 text-[15px] font-semibold" style={{ color: station.highRiskDocks > 0 ? "var(--status-critical)" : "var(--text-primary)" }}>
                  {station.highRiskDocks}
                </div>
              </div>
              <div>
                <div className="text-[12px] text-text-muted">Station Status</div>
                <div className="mt-1">
                  <StatusDot status={station.online ? "ONLINE" : "OFFLINE"} />
                </div>
              </div>
            </div>
          </Panel>
        )}

        {telemetry.length > 0 && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel title="Charger Temperature" titleNote="(daily avg, °C)">
              <TelemetryChart data={telemetry} dataKey="temperature" color="var(--status-critical)" unit="°C" gradientId="charger-temp" />
            </Panel>
            <Panel title="Charging Duration" titleNote="(daily avg, seconds)">
              <TelemetryChart data={telemetry} dataKey="chargingDuration" color="var(--series-1)" unit="s" gradientId="charger-duration" />
            </Panel>
          </div>
        )}

        {scoring && (
          <Panel title="Recommended Field Action">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <p className="text-[13px] text-text-secondary">
                  <span className="font-semibold text-text-primary">{scoring.priority}</span> · {scoring.sla} ·{" "}
                  {scoring.likelyIssue}
                </p>
                {scoring.suggestedChecks.length > 0 ? (
                  <ol className="mt-3 ml-4 list-decimal space-y-1 text-[13px] text-text-secondary">
                    {scoring.suggestedChecks.map((check) => (
                      <li key={check}>{check}</li>
                    ))}
                  </ol>
                ) : (
                  <p className="mt-2 text-[13px] text-text-muted">No checks suggested.</p>
                )}
              </div>
              <CreateFieldActionButton batteryId={charger.chargerId} sla={scoring.sla} priority={scoring.priority} />
            </div>
          </Panel>
        )}
      </div>
    </PageShell>
  );
}
