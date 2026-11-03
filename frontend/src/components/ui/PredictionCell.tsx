"use client";

import { useAssetInsight, type AssetInsightRef } from "@/lib/useAssetInsight";

/** The Asset Background column's cell: the asset's ai_insights headline (e.g.
 * "Abnormal behaviour observed after update to software version 2.2.3"),
 * fetched lazily per visible row — see useAssetInsight. Shown in full,
 * wrapping onto its own lines rather than truncating — the column is sized
 * wide enough (see each table's headerClassName) that most headlines still
 * fit in two or three lines without making the row look oversized. */
export function PredictionCell({ asset }: { asset: AssetInsightRef }) {
  const headline = useAssetInsight(asset);

  if (headline === undefined) {
    return <span className="text-text-muted">…</span>;
  }
  if (!headline) {
    return <span className="text-text-muted">—</span>;
  }
  return <span className="block leading-snug">{headline}</span>;
}
