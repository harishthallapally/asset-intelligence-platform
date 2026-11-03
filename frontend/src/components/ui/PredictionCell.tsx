"use client";

import { useAssetInsight, type AssetInsightRef } from "@/lib/useAssetInsight";

/** The Asset Background column's cell: the asset's ai_insights headline (e.g.
 * "Abnormal behaviour observed after update to software version 2.2.3"),
 * fetched lazily per visible row — see useAssetInsight. Truncated with a
 * title tooltip since headlines run long, same treatment as Likely Issue. */
export function PredictionCell({ asset }: { asset: AssetInsightRef }) {
  const headline = useAssetInsight(asset);

  if (headline === undefined) {
    return <span className="text-text-muted">…</span>;
  }
  if (!headline) {
    return <span className="text-text-muted">—</span>;
  }
  return (
    <span className="block max-w-[160px] truncate" title={headline}>
      {headline}
    </span>
  );
}
