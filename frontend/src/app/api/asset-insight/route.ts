// Server route behind the Asset Background column's lazy cell (see
// useAssetInsight.ts). The column shows a per-asset ai_insights headline, but
// that field only exists on each asset's own detail endpoint, never on a list
// endpoint — so a register as large as Batteries (3,124 rows) cannot have it
// fetched eagerly for every row. The client batches whichever rows are
// actually on screen (one page, ~15 ids) into a single POST here, and this
// route fans those out to the real per-asset detail calls server-side, where
// API_BASE_URL is available.

import { NextResponse } from "next/server";
import {
  fetchBattery,
  fetchChargerDetail,
  fetchStationDetail,
  fetchVehicle,
} from "@/lib/api/client";
import type { ApiAIInsight } from "@/lib/api/types";

type AssetType = "vehicle" | "battery" | "charger" | "station";

interface AssetRef {
  type: AssetType;
  id: string;
  /** Chargers only — a charger_uid is "<stationId>-<chargerId>", so the row's
   * own id alone can't be looked up without it. */
  stationId?: string;
}

/** The same key shape client and server must agree on for the results map. */
function refKey(ref: AssetRef): string {
  return ref.type === "charger" ? `charger:${ref.stationId}-${ref.id}` : `${ref.type}:${ref.id}`;
}

/** Prefers a finding that actually raises the risk score over a purely
 * informational one; otherwise just the first the platform returned.
 * "telemetry_risk" entries just restate the base risk_score/health_score as
 * a sentence and are present on nearly every asset — the rest of the app
 * (see normalise.ts) always filters these out so "insights" means an actual
 * non-telemetry finding (firmware regression, fleet correlation, etc.), not
 * noise repeated on every row. */
function pickHeadline(insights: ApiAIInsight[] | null | undefined): string | null {
  const real = (insights ?? []).filter((insight) => insight.category !== "telemetry_risk");
  if (real.length === 0) return null;
  const uplift = real.find((insight) => insight.contributes_uplift);
  return (uplift ?? real[0]).headline;
}

async function headlineFor(ref: AssetRef): Promise<string | null> {
  switch (ref.type) {
    case "vehicle":
      return pickHeadline((await fetchVehicle(ref.id)).ai_insights);
    case "battery":
      return pickHeadline((await fetchBattery(ref.id)).ai_insights);
    case "station":
      return pickHeadline((await fetchStationDetail(ref.id)).ai_insights);
    case "charger": {
      if (!ref.stationId) return null;
      const chargerUid = `${ref.stationId}-${ref.id}`;
      return pickHeadline((await fetchChargerDetail(chargerUid)).ai_insights);
    }
    default:
      return null;
  }
}

function isAssetType(value: unknown): value is AssetType {
  return value === "vehicle" || value === "battery" || value === "charger" || value === "station";
}

function parseRefs(raw: unknown): AssetRef[] {
  if (!Array.isArray(raw)) return [];
  const refs: AssetRef[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const { type, id, stationId } = entry as Record<string, unknown>;
    if (!isAssetType(type) || typeof id !== "string" || !id) continue;
    refs.push({ type, id, stationId: typeof stationId === "string" ? stationId : undefined });
  }
  // This is meant for one visible table page (15 rows), not an arbitrary
  // client-controlled fan-out of upstream calls.
  return refs.slice(0, 50);
}

export async function POST(request: Request) {
  let body: { assets?: unknown };
  try {
    body = (await request.json()) as { assets?: unknown };
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const refs = parseRefs(body.assets);
  if (refs.length === 0) {
    return NextResponse.json({ results: {} });
  }

  const entries = await Promise.all(
    refs.map(async (ref) => {
      try {
        return [refKey(ref), await headlineFor(ref)] as const;
      } catch {
        // One asset's lookup failing shouldn't blank the rest of the page.
        return [refKey(ref), null] as const;
      }
    }),
  );

  return NextResponse.json({ results: Object.fromEntries(entries) });
}
