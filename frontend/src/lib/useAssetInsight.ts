"use client";

import { useEffect, useState } from "react";

export type AssetInsightRef =
  | { type: "vehicle" | "battery" | "station"; id: string }
  | { type: "charger"; id: string; stationId: string };

function refKey(ref: AssetInsightRef): string {
  return ref.type === "charger" ? `charger:${ref.stationId}-${ref.id}` : `${ref.type}:${ref.id}`;
}

// Module-level, so every table on the page (and across navigations within the
// same session) shares one cache and one in-flight batch — a battery that
// shows up again after paging back doesn't re-fetch.
const cache = new Map<string, string | null>();
const listeners = new Map<string, Set<() => void>>();
let pending: AssetInsightRef[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function notify(key: string) {
  listeners.get(key)?.forEach((fn) => fn());
}

async function flush() {
  const batch = pending;
  pending = [];
  flushTimer = null;
  if (batch.length === 0) return;

  try {
    const response = await fetch("/api/asset-insight", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assets: batch }),
    });
    const data = (await response.json()) as { results?: Record<string, string | null> };
    for (const ref of batch) {
      const key = refKey(ref);
      cache.set(key, data.results?.[key] ?? null);
      notify(key);
    }
  } catch {
    for (const ref of batch) {
      const key = refKey(ref);
      cache.set(key, null);
      notify(key);
    }
  }
}

function schedule(ref: AssetInsightRef) {
  const key = refKey(ref);
  if (cache.has(key) || pending.some((r) => refKey(r) === key)) return;
  pending.push(ref);
  // Every insight cell mounted in the same tick (one table page's worth of
  // rows) lands in the same batch, rather than firing one request per cell.
  if (!flushTimer) flushTimer = setTimeout(flush, 0);
}

/**
 * Lazily resolves one asset's ai_insights headline — the field only exists on
 * the per-asset detail endpoint, so this fetches on demand for whichever rows
 * are actually rendered (a table page), not the whole register up front.
 *
 * Returns `undefined` while loading, `null` once resolved with no finding
 * (render a dash), or the headline text.
 */
export function useAssetInsight(ref: AssetInsightRef): string | null | undefined {
  const key = refKey(ref);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (cache.has(key)) return;
    schedule(ref);
    let set = listeners.get(key);
    if (!set) {
      set = new Set();
      listeners.set(key, set);
    }
    const onChange = () => setTick((t) => t + 1);
    set.add(onChange);
    return () => {
      set!.delete(onChange);
    };
    // `ref` is re-created per render by callers; `key` is its stable identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return cache.has(key) ? cache.get(key)! : undefined;
}
