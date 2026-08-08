"use client";

/**
 * Professional candlestick chart built on TradingView's own free
 * `lightweight-charts` library (no React peer dependency, so it's safe with
 * React 19). It renders candles + a volume histogram + optional indicator
 * overlays (SMA/EMA/Bollinger/VWAP), an optional synced RSI pane, a crosshair
 * OHLC readout, and buy/sell trade markers. The chart is created once on mount
 * and updated in place, so zoom/pan is preserved as data/overlays change.
 */

import { useEffect, useRef } from "react";
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

interface Props {
  bars: OhlcvBar[];
  overlays: Overlays;
  showVolume: boolean;
  showRsi: boolean;
  markers?: ChartMarkerPro[];
  priceLines?: PriceLinePro[];
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
  const priceLineRefs = useRef<IPriceLine[]>([]);

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

  return (
    <div>
      <div ref={priceRef} className="w-full" />
      <div ref={rsiRef} className="w-full" style={{ display: showRsi ? "block" : "none" }} />
    </div>
  );
}
