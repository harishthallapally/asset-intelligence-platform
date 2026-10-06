import { PageShell } from "@/components/layout/PageShell";
import { Panel } from "@/components/ui/Panel";
import { ApiErrorState } from "@/components/ui/ApiErrorState";
import { AlertsTable } from "@/components/alerts/AlertsTable";
import { appPredictedAlerts } from "@/lib/api/normalise";
import { getAppsPage, getOperationsAlertsPage } from "@/lib/api/resources";

export default async function AlertsPage() {
  const [{ data: alerts, error }, { data: apps }] = await Promise.all([
    getOperationsAlertsPage(200),
    getAppsPage(),
  ]);

  if (error || !alerts) {
    return (
      <PageShell title="Alerts" subtitle="Alert feed across the fleet">
        <ApiErrorState title="Could not load alerts" error={error ?? "Unknown error"} />
      </PageShell>
    );
  }

  const appAlerts = appPredictedAlerts(apps?.rows ?? []);
  const rows = [...alerts, ...appAlerts];

  return (
    <PageShell
      title="Alerts"
      subtitle={`${rows.length.toLocaleString()} recent alerts across the fleet${
        appAlerts.length ? ` · ${appAlerts.length} predicted app alerts` : ""
      }`}
    >
      <Panel>
        <AlertsTable alerts={rows} />
      </Panel>
    </PageShell>
  );
}
