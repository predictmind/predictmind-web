"use client";

/**
 * Professional candlestick chart built on TradingView's own free
 * `lightweight-charts` library (no React peer dependency, so it's safe with
 * React 19). It renders candles + a volume histogram + optional indicator
 * overlays (SMA/EMA/Bollinger/VWAP), an optional synced RSI pane, a crosshair
 * OHLC readout, and buy/sell trade markers. The chart is created once on mount
 * and updated in place, so zoom/pan is preserved as data/overlays change.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ColorType,
  CrosshairMode,
  createChart,
  LineStyle,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type LineData,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import { bollinger, ema, rsi, sma, vwap, type OhlcvBar } from "@/lib/indicators";

export interface Overlays {
  sma20: boolean;
  sma50: boolean;
  sma200: boolean;
  ema20: boolean;
  bollinger: boolean;
  vwap: boolean;
}

export interface ChartMarkerPro {
  time: number; // UTC seconds
  kind: "buy" | "sell";
}

export interface CrosshairInfo {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface PriceLinePro {
  price: number;
  color: string;
  title: string;
}

export type DrawTool = "cursor" | "hline" | "trend";

export interface HLineDrawing {
  id: string;
  type: "hline";
  price: number;
}
export interface TrendDrawing {
  id: string;
  type: "trend";
  t1: number; // UTC seconds
  p1: number; // price
  t2: number;
  p2: number;
}
export type Drawing = HLineDrawing | TrendDrawing;

interface Props {
  bars: OhlcvBar[];
  overlays: Overlays;
  showVolume: boolean;
  showRsi: boolean;
  markers?: ChartMarkerPro[];
  priceLines?: PriceLinePro[];
  tool?: DrawTool;
  drawings?: Drawing[];
  onAddDrawing?: (d: Drawing) => void;
  height?: number;
  onCrosshair?: (info: CrosshairInfo | null) => void;
}

const BG = "#0B1020";
const GRID = "#1A243B";
const TEXT = "#94A3B8";

/** Turn an aligned (number|null)[] into lightweight-charts LineData (skips nulls). */
function toLine(bars: OhlcvBar[], series: (number | null)[]): LineData[] {
  const out: LineData[] = [];
  for (let i = 0; i < bars.length; i++) {
    const v = series[i];
    if (v !== null && Number.isFinite(v)) out.push({ time: bars[i].time as UTCTimestamp, value: v });
  }
  return out;
}

export default function PriceChartPro({
  bars,
  overlays,
  showVolume,
  showRsi,
  markers = [],
  priceLines = [],
  tool = "cursor",
  drawings = [],
  onAddDrawing,
  height = 460,
  onCrosshair,
}: Props) {
  const priceRef = useRef<HTMLDivElement | null>(null);
  const rsiRef = useRef<HTMLDivElement | null>(null);

  const priceChart = useRef<IChartApi | null>(null);
  const rsiChart = useRef<IChartApi | null>(null);
  const candleSeries = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeries = useRef<ISeriesApi<"Histogram"> | null>(null);
  const overlaySeries = useRef<Map<string, ISeriesApi<"Line">>>(new Map());
  const rsiSeries = useRef<ISeriesApi<"Line"> | null>(null);
  const priceLineRefs = useRef<IPriceLine[]>([]); // alert lines
  const drawingLineRefs = useRef<IPriceLine[]>([]); // horizontal drawings

  // Drawing state (trendlines are rendered on an SVG overlay in pixel space).
  const drawingsRef = useRef<Drawing[]>(drawings);
  drawingsRef.current = drawings;
  const [trendSegs, setTrendSegs] = useState<{ id: string; x1: number; y1: number; x2: number; y2: number }[]>([]);
  const [pending, setPending] = useState<{ x: number; y: number } | null>(null);
  const pendingPoint = useRef<{ t: number; p: number } | null>(null);

  /** Recompute trendline pixel coordinates from stored (time, price) endpoints. */
  const recompute = useCallback(() => {
    const chart = priceChart.current;
    const series = candleSeries.current;
    if (!chart || !series) return;
    const segs: { id: string; x1: number; y1: number; x2: number; y2: number }[] = [];
    for (const d of drawingsRef.current) {
      if (d.type !== "trend") continue;
      const x1 = chart.timeScale().timeToCoordinate(d.t1 as UTCTimestamp);
      const x2 = chart.timeScale().timeToCoordinate(d.t2 as UTCTimestamp);
      const y1 = series.priceToCoordinate(d.p1);
      const y2 = series.priceToCoordinate(d.p2);
      if (x1 == null || x2 == null || y1 == null || y2 == null) continue;
      segs.push({ id: d.id, x1, y1, x2, y2 });
    }
    setTrendSegs(segs);
  }, []);

  // ---- create charts once ----
  useEffect(() => {
    if (!priceRef.current) return;
    const chart = createChart(priceRef.current, {
      layout: { background: { type: ColorType.Solid, color: BG }, textColor: TEXT },
      grid: { vertLines: { color: GRID }, horzLines: { color: GRID } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: GRID },
      timeScale: { borderColor: GRID, timeVisible: true, secondsVisible: false },
      autoSize: false,
      height,
      width: priceRef.current.clientWidth,
    });
    priceChart.current = chart;
    candleSeries.current = chart.addCandlestickSeries({
      upColor: "#10B981",
      downColor: "#EF4444",
      wickUpColor: "#10B981",
      wickDownColor: "#EF4444",
      borderVisible: false,
    });
    volumeSeries.current = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "vol",
    });
    chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });

    // RSI pane (separate small chart, time-synced to the price chart).
    const rchart = createChart(rsiRef.current as HTMLDivElement, {
      layout: { background: { type: ColorType.Solid, color: BG }, textColor: TEXT },
      grid: { vertLines: { color: GRID }, horzLines: { color: GRID } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: GRID },
      timeScale: { borderColor: GRID, timeVisible: true, secondsVisible: false },
      height: 130,
      width: (rsiRef.current as HTMLDivElement).clientWidth,
    });
    rsiChart.current = rchart;
    rsiSeries.current = rchart.addLineSeries({ color: "#F59E0B", lineWidth: 2, priceLineVisible: false });
    // 70/30 guide lines.
    rsiSeries.current.createPriceLine({ price: 70, color: "#EF4444", lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: true, title: "" });
    rsiSeries.current.createPriceLine({ price: 30, color: "#10B981", lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: true, title: "" });

    // Two-way time-scale sync (guarded to avoid feedback loops).
    let syncing = false;
    const sync = (from: IChartApi, to: IChartApi) => {
      from.timeScale().subscribeVisibleLogicalRangeChange((range) => {
        if (syncing || !range) return;
        syncing = true;
        to.timeScale().setVisibleLogicalRange(range);
        syncing = false;
      });
    };
    sync(chart, rchart);
    sync(rchart, chart);

    // Redraw trendline overlay whenever the visible time range moves (pan/zoom).
    chart.timeScale().subscribeVisibleTimeRangeChange(() => recompute());

    // Crosshair OHLC readout (from the price chart).
    if (onCrosshair) {
      chart.subscribeCrosshairMove((param) => {
        const c = candleSeries.current;
        if (!param.time || !c) {
          onCrosshair(null);
          return;
        }
        const d = param.seriesData.get(c) as
          | { open: number; high: number; low: number; close: number }
          | undefined;
        if (d) onCrosshair({ time: Number(param.time), ...d });
        else onCrosshair(null);
      });
    }

    // Responsive width.
    const ro = new ResizeObserver(() => {
      if (priceRef.current) chart.applyOptions({ width: priceRef.current.clientWidth });
      if (rsiRef.current) rchart.applyOptions({ width: rsiRef.current.clientWidth });
      recompute();
    });
    ro.observe(priceRef.current);
    if (rsiRef.current) ro.observe(rsiRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      rchart.remove();
      priceChart.current = null;
      rsiChart.current = null;
      candleSeries.current = null;
      volumeSeries.current = null;
      rsiSeries.current = null;
      overlaySeries.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- push data + overlays whenever inputs change ----
  useEffect(() => {
    const chart = priceChart.current;
    const candle = candleSeries.current;
    if (!chart || !candle) return;

    candle.setData(
      bars.map((b) => ({ time: b.time as UTCTimestamp, open: b.open, high: b.high, low: b.low, close: b.close })),
    );

    // markers
    const mk: SeriesMarker<Time>[] = markers.map((m) => ({
      time: m.time as UTCTimestamp,
      position: m.kind === "buy" ? "belowBar" : "aboveBar",
      color: m.kind === "buy" ? "#10B981" : "#EF4444",
      shape: m.kind === "buy" ? "arrowUp" : "arrowDown",
      text: m.kind === "buy" ? "B" : "S",
    }));
    candle.setMarkers(mk);

    // volume
    if (volumeSeries.current) {
      volumeSeries.current.applyOptions({ visible: showVolume });
      volumeSeries.current.setData(
        bars.map((b) => ({
          time: b.time as UTCTimestamp,
          value: b.volume,
          color: b.close >= b.open ? "rgba(16,185,129,0.4)" : "rgba(239,68,68,0.4)",
        })),
      );
    }

    // overlays: create/remove/update line series to match the toggle state
    const closes = bars.map((b) => b.close);
    const want: { key: string; color: string; data: LineData[] }[] = [];
    if (overlays.sma20) want.push({ key: "sma20", color: "#00D4FF", data: toLine(bars, sma(closes, 20)) });
    if (overlays.sma50) want.push({ key: "sma50", color: "#7B61FF", data: toLine(bars, sma(closes, 50)) });
    if (overlays.sma200) want.push({ key: "sma200", color: "#F59E0B", data: toLine(bars, sma(closes, 200)) });
    if (overlays.ema20) want.push({ key: "ema20", color: "#10B981", data: toLine(bars, ema(closes, 20)) });
    if (overlays.vwap) want.push({ key: "vwap", color: "#EC4899", data: toLine(bars, vwap(bars, 20)) });
    if (overlays.bollinger) {
      const bb = bollinger(closes, 20, 2);
      want.push({ key: "bb_up", color: "#64748B", data: toLine(bars, bb.upper) });
      want.push({ key: "bb_lo", color: "#64748B", data: toLine(bars, bb.lower) });
    }

    const wantKeys = new Set(want.map((w) => w.key));
    // remove series no longer wanted
    for (const [key, series] of overlaySeries.current.entries()) {
      if (!wantKeys.has(key)) {
        chart.removeSeries(series);
        overlaySeries.current.delete(key);
      }
    }
    // add/update wanted series
    for (const w of want) {
      let s = overlaySeries.current.get(w.key);
      if (!s) {
        s = chart.addLineSeries({ color: w.color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
        overlaySeries.current.set(w.key, s);
      }
      s.setData(w.data);
    }

    // RSI
    if (rsiSeries.current) {
      rsiSeries.current.setData(toLine(bars, rsi(closes, 14)));
    }
  }, [bars, overlays, showVolume, markers]);

  // ---- horizontal price lines (e.g. alert levels) ----
  useEffect(() => {
    const candle = candleSeries.current;
    if (!candle) return;
    for (const line of priceLineRefs.current) candle.removePriceLine(line);
    priceLineRefs.current = priceLines.map((pl) =>
      candle.createPriceLine({
        price: pl.price,
        color: pl.color,
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: pl.title,
      }),
    );
  }, [priceLines]);

  // ---- horizontal DRAWING lines (support/resistance the user drew) ----
  useEffect(() => {
    const candle = candleSeries.current;
    if (!candle) return;
    for (const line of drawingLineRefs.current) candle.removePriceLine(line);
    drawingLineRefs.current = drawings
      .filter((d): d is HLineDrawing => d.type === "hline")
      .map((d) =>
        candle.createPriceLine({
          price: d.price,
          color: "#3B82F6",
          lineWidth: 1,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title: "line",
        }),
      );
  }, [drawings]);

  // Recompute trendline pixels when the drawings or the data change.
  useEffect(() => {
    recompute();
  }, [drawings, bars, recompute]);

  /** Click on the overlay to place a horizontal line or a trendline point. */
  const handleOverlayClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const chart = priceChart.current;
    const series = candleSeries.current;
    if (!chart || !series || !onAddDrawing || tool === "cursor") return;
    const rect = (e.target as SVGSVGElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const price = series.coordinateToPrice(y);
    if (price == null) return;

    if (tool === "hline") {
      onAddDrawing({ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, type: "hline", price });
      return;
    }
    // trendline: needs two clicks
    const t = chart.timeScale().coordinateToTime(x);
    if (t == null || typeof t !== "number") return;
    if (!pendingPoint.current) {
      pendingPoint.current = { t, p: price };
      setPending({ x, y });
    } else {
      const p1 = pendingPoint.current;
      onAddDrawing({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        type: "trend",
        t1: p1.t,
        p1: p1.p,
        t2: t,
        p2: price,
      });
      pendingPoint.current = null;
      setPending(null);
    }
  };

  const drawingMode = tool !== "cursor";

  return (
    <div>
      <div style={{ position: "relative" }}>
        <div ref={priceRef} className="w-full" />
        <svg
          className="absolute left-0 top-0"
          width="100%"
          height={height}
          style={{ pointerEvents: drawingMode ? "auto" : "none", cursor: drawingMode ? "crosshair" : "default" }}
          onClick={handleOverlayClick}
        >
          {trendSegs.map((s) => (
            <line key={s.id} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke="#00D4FF" strokeWidth={1.5} />
          ))}
          {pending && <circle cx={pending.x} cy={pending.y} r={4} fill="#00D4FF" />}
        </svg>
      </div>
      <div ref={rsiRef} className="w-full" style={{ display: showRsi ? "block" : "none" }} />
    </div>
  );
}
