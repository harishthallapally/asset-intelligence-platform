import { PageShell } from "@/components/layout/PageShell";
import { Panel } from "@/components/ui/Panel";
import { ApiErrorState } from "@/components/ui/ApiErrorState";
import { AppsTable } from "@/components/software/AppsTable";
import { getAppsPage } from "@/lib/api/resources";

export default async function SoftwarePage() {
  const { data, error } = await getAppsPage();

  return (
    <PageShell title="Software" subtitle="">
      {error || !data ? (
        <ApiErrorState title="Could not load the app data" error={error ?? "Unknown error"} />
      ) : (
        <Panel>
          <AppsTable rows={data.rows} />
        </Panel>
      )}
    </PageShell>
  );
}
