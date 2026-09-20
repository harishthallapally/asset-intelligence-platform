import { PageShell } from "@/components/layout/PageShell";
import { Panel } from "@/components/ui/Panel";
import { ApiErrorState } from "@/components/ui/ApiErrorState";
import { VehiclesTable } from "@/components/vehicles/VehiclesTable";
import { getVehiclesPage } from "@/lib/api/resources";

export default async function VehiclesPage() {
  const { data, error } = await getVehiclesPage();

  const subtitle = data
    ? `${data.rows.length.toLocaleString()} vehicles${
        data.summary?.average_health_score != null
          ? ` · overall health ${Math.round(data.summary.average_health_score)}/100`
          : ""
      }`
    : "Live vehicle data";

  return (
    <PageShell title="Vehicles" subtitle={subtitle}>
      {error || !data ? (
        <ApiErrorState title="Could not load the vehicle data" error={error ?? "Unknown error"} />
      ) : (
        <Panel>
          <VehiclesTable rows={data.rows} />
        </Panel>
      )}
    </PageShell>
  );
}
