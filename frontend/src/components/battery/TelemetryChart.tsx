"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// Generic over any daily series with a `date` field — used for battery and
// dock telemetry alike (AssetTelemetryPointView).
export function TelemetryChart<T extends { date: string }>({
  data,
  dataKey,
  color,
  unit,
  gradientId,
}: {
  data: T[];
  dataKey: keyof T;
  color: string;
  unit: string;
  gradientId: string;
}) {
  if (!data.some((point) => typeof point[dataKey] === "number")) {
    return (
      <div className="flex h-[168px] items-center justify-center text-[12.5px] text-text-muted">
        No data in the selected date range.
      </div>
    );
  }

  return (
    <div className="h-[168px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 22, bottom: 0, left: -14 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.22} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--gridline)" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(iso: string) =>
              new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" })
            }
            // A fixed step (e.g. every 3rd point) can land short of the last
            // index for some range lengths, silently dropping the end date
            // the filter was set to — "preserveStartEnd" always keeps the
            // first and last ticks and only thins the ones in between.
            interval="preserveStartEnd"
            axisLine={{ stroke: "var(--gridline)" }}
            tickLine={false}
            tick={{ fill: "var(--text-muted)", fontSize: 11 }}
            // No axis padding: the line/area should run flush to the plot's
            // true edges (a padded gap here would sit inside the gridlines,
            // reading as a chunk of "missing" chart rather than a finished
            // edge). The last tick's label still has room to render in full
            // ("Oct 6" rather than a clipped "Oct") because the chart's own
            // right margin, above, is wide enough for it and sits outside
            // the grid, where empty space reads as a normal label gutter.
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            width={52}
            tick={{ fill: "var(--text-muted)", fontSize: 11 }}
            domain={["auto", "auto"]}
            // Recharts can pick ticks with long fractions (11.05, 9.35…) which
            // then clip against the axis width; one decimal keeps them legible.
            tickFormatter={(value: number) =>
              Number.isInteger(value) ? String(value) : value.toFixed(1)
            }
          />
          <Tooltip
            contentStyle={{
              background: "var(--surface-1)",
              border: "1px solid var(--border-hairline)",
              borderRadius: 8,
              fontSize: 12,
              color: "var(--text-primary)",
            }}
            labelFormatter={(label) => new Date(String(label)).toLocaleString("en-IN")}
            formatter={(value) => [`${value} ${unit}`, ""]}
          />
          <Area
            type="monotone"
            dataKey={dataKey as string}
            stroke={color}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={{ r: 3.5, strokeWidth: 2, stroke: "var(--surface-1)" }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
