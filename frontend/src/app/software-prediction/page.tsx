import { AlertOctagon, HeartPulse, ShieldAlert, Smartphone } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { Panel } from "@/components/ui/Panel";
import { ApiErrorState } from "@/components/ui/ApiErrorState";
import { StatCard } from "@/components/ui/StatCard";
import { AppsTable } from "@/components/software/AppsTable";
import { getAppsPage } from "@/lib/api/resources";

export default async function SoftwarePredictionPage() {
  const { data, error } = await getAppsPage();

  if (error || !data) {
    return (
      <PageShell title="Software Prediction" subtitle="iOS and Android app health">
        <ApiErrorState title="Could not load the app data" error={error ?? "Unknown error"} />
      </PageShell>
    );
  }

  const { rows, summary } = data;
  const android = rows.filter((r) => r.platform.toUpperCase() === "ANDROID").length;
  const ios = rows.filter((r) => r.platform.toUpperCase() === "IOS").length;
  const installs = summary?.total_installs ?? rows.reduce((sum, r) => sum + (r.installCount ?? 0), 0);
  const highRisk = rows.filter((r) => ["HIGH", "CRITICAL"].includes(r.riskCategoryRaw?.toUpperCase() ?? "")).length;
  const p1 = rows.filter((r) => r.priority === "P1").length;
  const scored = rows.filter((r) => r.healthScore != null);
  const avgHealth =
    summary?.average_health_score ??
    (scored.length ? scored.reduce((sum, r) => sum + r.healthScore!, 0) / scored.length : null);

  return (
    <PageShell
      title="Software Prediction"
      subtitle={`${rows.length} app cohorts · ${installs.toLocaleString("en-IN")} installs`}
    >
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={Smartphone}
            iconBg="color-mix(in srgb, var(--series-1) 12%, transparent)"
            iconColor="var(--series-1)"
            label="App Cohorts"
            value={rows.length}
            breakdown={[
              { label: "Android", value: android, tone: "good" },
              { label: "iOS", value: ios, tone: "good" },
            ]}
          />
          <StatCard
            icon={HeartPulse}
            iconBg="color-mix(in srgb, var(--status-good) 12%, transparent)"
            iconColor="var(--status-good)"
            label="Healthy Cohorts"
            value={rows.filter((r) => r.healthClassification?.toUpperCase() === "HEALTHY").length}
            breakdown={[
              ...(avgHealth != null
                ? [{ label: "Avg health", value: `${Math.round(avgHealth)}/100`, tone: "good" as const }]
                : []),
              {
                label: "Not scored",
                value: rows.filter((r) => r.healthClassification?.toUpperCase() === "NOT_SCORED").length,
                tone: "warning" as const,
              },
            ]}
          />
          <StatCard
            icon={ShieldAlert}
            iconBg="var(--status-critical-bg)"
            iconColor="var(--status-critical)"
            label="High Crash/ANR Risk"
            value={highRisk}
            breakdown={
              summary
                ? [{ label: "Predicted failures", value: summary.predicted_failure_count, tone: "critical" }]
                : undefined
            }
          />
          <StatCard
            icon={AlertOctagon}
            iconBg="color-mix(in srgb, var(--series-7) 14%, transparent)"
            iconColor="var(--series-7)"
            label="P1 Priority"
            value={p1}
          />
        </div>

        <Panel title="App Cohorts" titleNote="(ranked by predictive crash/ANR risk)">
          <AppsTable rows={rows} />
        </Panel>
      </div>
    </PageShell>
  );
}
