"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, Info, Loader2 } from "lucide-react";
import { FROM_COOKIE, TO_COOKIE, addDays, spanDays } from "@/lib/dateRange";

const PRESETS = [
  { days: 7, label: "Last 7 days" },
  { days: 14, label: "Last 14 days" },
  { days: 30, label: "Last 30 days" },
  { days: 90, label: "Last 90 days" },
];

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function fmt(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function saveRange(from: string, to: string) {
  document.cookie = `${FROM_COOKIE}=${from}; path=/; max-age=31536000; samesite=lax`;
  document.cookie = `${TO_COOKIE}=${to}; path=/; max-age=31536000; samesite=lax`;
}

/**
 * Date control for the header.
 *
 * Both ends are editable — the end date is no longer pinned to wall-clock
 * "today". Its ceiling is `latest`: the platform's own latest scored day
 * (passed in as `dataAsOf`), since the service can run a day or more behind
 * real time and picking a day past that would just show an empty window.
 * The choice is saved in a cookie, so it carries across every page, and
 * every trend/telemetry chart lays its data out against this window.
 */
export function DateRangePicker({
  dataAsOf,
  from,
  to,
}: {
  dataAsOf: string | null;
  from: string;
  to: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const latest = useMemo(() => (dataAsOf ? dataAsOf.slice(0, 10) : ymd(new Date())), [dataAsOf]);

  const [open, setOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);
  // Mirrors the server-confirmed from/to into draft state on prop change
  // (e.g. after a router.refresh()) without an effect — see
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes.
  const [syncedFrom, setSyncedFrom] = useState(from);
  const [syncedTo, setSyncedTo] = useState(to);
  if (from !== syncedFrom || to !== syncedTo) {
    setSyncedFrom(from);
    setSyncedTo(to);
    setDraftFrom(from);
    setDraftTo(to);
  }
  // Changing the range re-renders on the server, which waits on the platform
  // API — without a pending state the control looks unresponsive for seconds.
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  function apply(nextFrom: string, nextTo: string) {
    const safeTo = nextTo > latest ? latest : nextTo;
    const safeFrom = nextFrom > safeTo ? safeTo : nextFrom;
    saveRange(safeFrom, safeTo);
    // Older links may still carry ?days=; drop it so the URL matches the range.
    const params = new URLSearchParams(searchParams.toString());
    params.delete("days");
    const query = params.toString();
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname);
      router.refresh();
    });
    setOpen(false);
  }

  function applyPreset(days: number) {
    apply(addDays(latest, -(days - 1)), latest);
  }

  function applyDraft() {
    apply(draftFrom, draftTo);
  }

  const activePresetDays = useMemo(() => {
    if (to !== latest) return null;
    const span = spanDays(from, to);
    return PRESETS.some((p) => p.days === span) ? span : null;
  }, [from, to, latest]);

  const draftDirty = draftFrom !== from || draftTo !== to;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-xl border border-[var(--border-hairline)] px-3.5 py-2 text-[13px] text-text-secondary hover:bg-[var(--surface-2)] disabled:opacity-70"
        disabled={pending}
      >
        {pending ? (
          <Loader2 size={15} className="animate-spin text-text-muted" />
        ) : (
          <CalendarDays size={15} className="text-text-muted" />
        )}
        {pending ? "Updating…" : `${fmt(from)} – ${fmt(to)}`}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Select date range"
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-[300px] rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-1)] p-3 shadow-xl shadow-black/10"
        >
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-[11px] font-medium text-text-muted">
              Start date
              <input
                type="date"
                value={draftFrom}
                max={draftTo}
                onChange={(event) => setDraftFrom(event.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-1)] px-2 py-1.5 text-[12.5px] text-text-primary"
              />
            </label>
            <label className="block text-[11px] font-medium text-text-muted">
              End date
              <input
                type="date"
                value={draftTo}
                min={draftFrom}
                max={latest}
                onChange={(event) => setDraftTo(event.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-1)] px-2 py-1.5 text-[12.5px] text-text-primary"
              />
            </label>
          </div>

          <button
            onClick={applyDraft}
            disabled={pending || !draftDirty}
            className="mt-2.5 w-full rounded-lg px-3 py-1.5 text-[12.5px] font-semibold text-white transition-opacity disabled:opacity-40"
            style={{ backgroundColor: "var(--series-1)" }}
          >
            Apply
          </button>

          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-[var(--border-hairline)] pt-3">
            {PRESETS.map((preset) => (
              <button
                key={preset.days}
                onClick={() => applyPreset(preset.days)}
                className="rounded-full px-2.5 py-1 text-[11.5px] font-medium transition-colors"
                style={{
                  backgroundColor: activePresetDays === preset.days ? "var(--series-1)" : "var(--surface-2)",
                  color: activePresetDays === preset.days ? "#fff" : "var(--text-secondary)",
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <p className="mt-3 flex gap-1.5 border-t border-[var(--border-hairline)] pt-2.5 text-[11px] leading-relaxed text-text-muted">
            <Info size={12} className="mt-0.5 flex-none" />
            <span>
              Charts and KPIs reflect this exact range. The platform&apos;s latest scoring run is{" "}
              {fmt(latest)}; dates after that have no data yet.
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
