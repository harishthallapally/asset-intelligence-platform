import { AlertOctagon, AlertTriangle, ShieldAlert, Sparkles } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { Panel } from "@/components/ui/Panel";
import { ApiErrorState } from "@/components/ui/ApiErrorState";
import { StatCard } from "@/components/ui/StatCard";
import { PredictiveWarningsTable } from "@/components/predictions/PredictiveWarningsTable";
import { getPredictiveWarningsPage } from "@/lib/api/resources";

export default async function AiPredictionsPage() {
  const { data: rows, error } = await getPredictiveWarningsPage();

  if (error || !rows) {
    return (
      <PageShell title="AI Predictions" subtitle="Predictive risk register">
        <ApiErrorState title="Could not load predictive warnings" error={error ?? "Unknown error"} />
      </PageShell>
    );
  }

  const critical = rows.filter((r) => r.riskCategory === "CRITICAL").length;
  const highRisk = rows.filter((r) => r.riskCategory === "HIGH" || r.riskCategory === "CRITICAL").length;
  const p1 = rows.filter((r) => r.priority === "P1").length;

  const subtitle = `${rows.length.toLocaleString()} predictive warnings across the fleet`;

  return (
    <PageShell title="AI Predictions" subtitle={subtitle}>
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <StatCard
            icon={ShieldAlert}
            iconBg="var(--status-critical-bg)"
            iconColor="var(--status-critical)"
            label="Critical Risk"
            value={critical}
            breakdown={[{ label: "of total", value: `${Math.round((critical / (rows.length || 1)) * 100)}%`, tone: "critical" }]}
          />
          <StatCard
            icon={AlertTriangle}
            iconBg="var(--status-warning-bg)"
            iconColor="var(--status-warning)"
            label="High Risk or Above"
            value={highRisk}
            breakdown={[{ label: "of total", value: `${Math.round((highRisk / (rows.length || 1)) * 100)}%`, tone: "warning" }]}
          />
          <StatCard
            icon={AlertOctagon}
            iconBg="color-mix(in srgb, var(--series-7) 14%, transparent)"
            iconColor="var(--series-7)"
            label="P1 Priority"
            value={p1}
            breakdown={[{ label: "of total", value: `${Math.round((p1 / (rows.length || 1)) * 100)}%`, tone: "critical" }]}
          />
        </div>

        <Panel title="Predictive Risk Register" titleNote={`(${rows.length.toLocaleString()} assets)`}>
          <PredictiveWarningsTable rows={rows} />
        </Panel>

        <div className="flex items-start gap-2.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-1)] px-5 py-4">
          <Sparkles size={16} className="mt-0.5 flex-none text-[var(--series-1)]" />
          <p className="text-[13px] leading-relaxed text-text-secondary">
            <span className="font-semibold text-text-primary">Predictive Risk / Early Warning.</span> These
            scores express the likelihood of an operational issue developing inside the prediction window,
            based on recent telemetry trends — across every asset type the platform scores (batteries,
            stations, docks and chargers). They are not confirmed failure predictions.
          </p>
        </div>
      </div>
    </PageShell>
  );
}
