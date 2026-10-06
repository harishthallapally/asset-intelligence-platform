import { Topbar } from "./Topbar";
import { getHeaderContext } from "@/lib/api/resources";
import { selectedDays } from "@/lib/selectedDays";

/**
 * Wraps a page with the shared header. Locations, alerts and the data
 * timestamp all come from the live service, so every page's header reflects the
 * same source as its content.
 */
export async function PageShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const [header, days] = await Promise.all([getHeaderContext(), selectedDays()]);

  return (
    // No min-h-full/flex-1 here: this block's height must stay intrinsic to
    // its own content, so the site footer (rendered after it in the root
    // layout) sits right below the page instead of being forced down to the
    // viewport's full height on any page shorter than the screen.
    <div className="flex flex-col">
      <Topbar
        title={title}
        subtitle={subtitle}
        alertCount={header.alertCount}
        alerts={header.alerts}
        locations={header.locations}
        dataAsOf={header.dataAsOf}
        days={days}
      />
      <div className="px-5 pb-3 pt-3">{children}</div>
    </div>
  );
}
