/**
 * A tiny, dependency-free SVG line chart. We deliberately avoid a charting
 * library so the frontend has no extra dependencies (and no React-19 peer
 * conflicts). It scales the series to a fixed viewBox and stretches to the
 * container width via `className="w-full"`.
 */

export interface ChartMarker {
  index: number;
  kind: "buy" | "sell";
}

interface LineChartProps {
  data: number[];
  height?: number;
  /** Stroke colour (hex). Defaults to the brand secondary. */
  color?: string;
  /** Optional buy/sell markers positioned by data index. */
  markers?: ChartMarker[];
  /** Draw a faint horizontal line at this value (e.g. the starting equity). */
  baseline?: number;
}

const VIEW_W = 1000;

export default function LineChart({
  data,
  height = 220,
  color = "#00D4FF",
  markers = [],
  baseline,
}: LineChartProps) {
  if (!data.length) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-border bg-surface text-sm text-slate-500"
        style={{ height }}
      >
        No data
      </div>
    );
  }

  const min = Math.min(...data, baseline ?? Infinity);
  const max = Math.max(...data, baseline ?? -Infinity);
  const range = max - min || 1;
  const pad = 6;
  const innerH = height - pad * 2;

  const x = (i: number) => (data.length === 1 ? 0 : (i / (data.length - 1)) * VIEW_W);
  const y = (v: number) => pad + innerH - ((v - min) / range) * innerH;

  const points = data.map((v, i) => `${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(" ");
  const areaPath = `M0,${y(data[0]).toFixed(2)} L${points.replaceAll(" ", " L")} L${VIEW_W},${height} L0,${height} Z`;

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${height}`}
      preserveAspectRatio="none"
      className="w-full"
      style={{ height }}
      role="img"
    >
      <defs>
        <linearGradient id="lc-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {baseline != null && (
        <line
          x1="0"
          x2={VIEW_W}
          y1={y(baseline)}
          y2={y(baseline)}
          stroke="#26324D"
          strokeWidth="1"
          strokeDasharray="6 6"
        />
      )}

      <path d={areaPath} fill="url(#lc-fill)" stroke="none" />
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />

      {markers.map((m, k) =>
        m.index >= 0 && m.index < data.length ? (
          <circle
            key={k}
            cx={x(m.index)}
            cy={y(data[m.index])}
            r="4"
            fill={m.kind === "buy" ? "#10B981" : "#EF4444"}
            stroke="#0B1020"
            strokeWidth="1"
          />
        ) : null,
      )}
    </svg>
  );
}
