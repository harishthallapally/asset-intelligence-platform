import Link from "next/link";
import { PageShell } from "@/components/layout/PageShell";
import { Panel } from "@/components/ui/Panel";
import { ApiErrorState } from "@/components/ui/ApiErrorState";
import { ChargersTable } from "@/components/chargers/ChargersTable";
import { getChargersPage } from "@/lib/api/resources";

export default async function ChargersPage({
  searchParams,
}: {
  // Set when a station's own page links here (its Chargers stat card) —
  // scopes the list instead of showing every charger on the fleet.
  searchParams: Promise<{ station?: string }>;
}) {
  const { station: stationId } = await searchParams;
  const { data: allRows, error } = await getChargersPage();
  const data = stationId ? allRows?.filter((c) => c.stationId.toLowerCase() === stationId.toLowerCase()) : allRows;

  const subtitle = data
    ? `${data.length} charger${data.length === 1 ? "" : "s"} · ${data.filter((c) => c.online).length} online · ${data.filter((c) => c.faulty).length} faulty${stationId ? ` · at ${stationId}` : ""}`
    : "Live charger inventory";

  return (
    <PageShell title="Chargers" subtitle={subtitle}>
      {error || !data ? (
        <ApiErrorState title="Could not load chargers" error={error ?? "Unknown error"} />
      ) : (
        <div className="flex flex-col gap-2">
          <Panel
            action={
              stationId && (
                <Link href="/chargers" className="text-[12px] font-medium text-[var(--series-1)] hover:underline">
                  Clear filter (show all)
                </Link>
              )
            }
          >
            <ChargersTable rows={data} />
          </Panel>
          <p className="px-1 text-[11.5px] text-text-muted">
            Condition, Health Score, Anomaly, Risk, Priority and Likely Issue are each charger&apos;s own real
            score (GET /chargers/scores) — open a charger for its full dimensions, signals and recommended
            action.
          </p>
        </div>
      )}
    </PageShell>
  );
}
