"use client";

/**
 * CHARTS tab: a TradingView-style workspace — a candlestick chart with volume,
 * indicator overlays, an RSI pane, a coin watchlist, timeframe switcher, history
 * selector, and a live OHLC readout. Data comes from the market service.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { createAlert, deleteAlert, getCandles, listAlerts, listCoins, resetAlert } from "@/lib/api";
import type { Coin, PriceAlert } from "@/lib/types";
import type { OhlcvBar } from "@/lib/indicators";
import { num, toNum } from "@/lib/format";
import { TIMEFRAMES, historyPresets } from "@/lib/strategies";
import AlertsPanel from "./AlertsPanel";
import PriceChartPro, {
  type CrosshairInfo,
  type Drawing,
  type DrawTool,
  type Overlays,
  type PriceLinePro,
} from "./PriceChartPro";

const DEFAULT_OVERLAYS: Overlays = {
  sma20: false,
  sma50: true,
  sma200: true,
  ema20: false,
  bollinger: false,
  vwap: false,
};

/** Convert market candles (strings, newest-first) to ascending OHLCV bars. */
function toBars(candles: { openTime: string; open: string; high: string; low: string; close: string; volume: string }[]): OhlcvBar[] {
  const bars = candles.map((c) => ({
    time: Math.floor(new Date(c.openTime).getTime() / 1000),
    open: Number(c.open),
    high: Number(c.high),
    low: Number(c.low),
    close: Number(c.close),
    volume: Number(c.volume),
  }));
  bars.sort((a, b) => a.time - b.time);
  // de-duplicate identical timestamps (lightweight-charts requires unique, ascending)
  const out: OhlcvBar[] = [];
  let prev = -1;
  for (const b of bars) {
    if (b.time !== prev) out.push(b);
    prev = b.time;
  }
  return out;
}

export default function ChartsPanel({
  connected,
  initialSymbol,
}: {
  connected: boolean;
  initialSymbol?: string;
}) {
  const [coins, setCoins] = useState<Coin[]>([]);
  const [symbol, setSymbol] = useState("SOL");
  const [timeframe, setTimeframe] = useState("1d");
  const [candlesN, setCandlesN] = useState(1000);
  const [overlays, setOverlays] = useState<Overlays>(DEFAULT_OVERLAYS);
  const [showVolume, setShowVolume] = useState(true);
  const [showRsi, setShowRsi] = useState(true);
  const [bars, setBars] = useState<OhlcvBar[]>([]);
  const [hover, setHover] = useState<CrosshairInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [assetFilter, setAssetFilter] = useState<"all" | "CRYPTO" | "STOCK">("all");
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [tool, setTool] = useState<DrawTool>("cursor");
  const [drawings, setDrawings] = useState<Drawing[]>([]);

  useEffect(() => {
    if (connected) listCoins().then(setCoins).catch(() => setCoins([]));
  }, [connected]);

  // Open a symbol chosen from the Screener tab.
  useEffect(() => {
    if (initialSymbol) setSymbol(initialSymbol);
  }, [initialSymbol]);

  const loadAlerts = useCallback(() => {
    if (!connected) return;
    listAlerts().then(setAlerts).catch(() => setAlerts([]));
  }, [connected]);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  const addAlert = async (condition: "above" | "below", price: number, note: string) => {
    await createAlert({ symbol, condition, price, note: note || undefined }).catch(() => undefined);
    loadAlerts();
  };
  const removeAlert = async (id: string) => {
    await deleteAlert(id).catch(() => undefined);
    loadAlerts();
  };
  const rearmAlert = async (id: string) => {
    await resetAlert(id).catch(() => undefined);
    loadAlerts();
  };

  // Drawings are saved per symbol+timeframe in the browser.
  const drawingsKey = `pm.drawings.${symbol}.${timeframe}`;
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`pm.drawings.${symbol}.${timeframe}`);
      setDrawings(raw ? (JSON.parse(raw) as Drawing[]) : []);
    } catch {
      setDrawings([]);
    }
  }, [symbol, timeframe]);

  const addDrawing = (d: Drawing) => {
    setDrawings((prev) => {
      const next = [...prev, d];
      try {
        localStorage.setItem(drawingsKey, JSON.stringify(next));
      } catch {
        /* ignore quota errors */
      }
      return next;
    });
  };
  const clearDrawings = () => {
    setDrawings([]);
    try {
      localStorage.removeItem(drawingsKey);
    } catch {
      /* ignore */
    }
  };

  const load = useCallback(() => {
    if (!connected) return;
    setLoading(true);
    setError("");
    getCandles(symbol, timeframe, candlesN)
      .then((c) => setBars(toBars(c)))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load candles"))
      .finally(() => setLoading(false));
  }, [connected, symbol, timeframe, candlesN]);

  useEffect(() => {
    load();
  }, [load]);

  const presets = historyPresets(timeframe);
  const last = bars.length ? bars[bars.length - 1] : null;
  const info = hover ?? (last ? { time: last.time, open: last.open, high: last.high, low: last.low, close: last.close } : null);
  const change = useMemo(() => {
    if (bars.length < 2) return 0;
    const first = bars[0].close;
    const lastC = bars[bars.length - 1].close;
    return first > 0 ? ((lastC - first) / first) * 100 : 0;
  }, [bars]);

  // Active alert levels for the charted symbol → dashed lines on the chart.
  const priceLines = useMemo<PriceLinePro[]>(
    () =>
      alerts
        .filter((a) => a.symbol === symbol && a.status === "ACTIVE")
        .map((a) => ({
          price: toNum(a.price),
          color: a.condition === "above" ? "#10B981" : "#EF4444",
          title: `alert ${a.condition === "above" ? "≥" : "≤"} ${num(a.price, 2)}`,
        })),
    [alerts, symbol],
  );

  const filteredCoins = coins.filter((c) => {
    const matchesText =
      !filter ||
      c.symbol.toLowerCase().includes(filter.toLowerCase()) ||
      c.name.toLowerCase().includes(filter.toLowerCase());
    const matchesAsset = assetFilter === "all" || (c.assetClass ?? "CRYPTO") === assetFilter;
    return matchesText && matchesAsset;
  });

  const toggle = (key: keyof Overlays) => setOverlays((o) => ({ ...o, [key]: !o[key] }));

  const chip = (active: boolean) =>
    `rounded-md px-2.5 py-1 text-xs font-medium transition ${
      active ? "bg-primary text-white" : "bg-elevated text-slate-300 hover:bg-border"
    }`;

  if (!connected) {
    return <p className="text-sm text-warning">Connect (above) to load charts.</p>;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
      {/* watchlist */}
      <aside className="rounded-xl border border-border bg-surface p-3">
        <div className="mb-2 flex gap-1">
          {(["all", "CRYPTO", "STOCK"] as const).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setAssetFilter(a)}
              className={`flex-1 rounded-md px-2 py-1 text-xs font-medium transition ${
                assetFilter === a ? "bg-primary text-white" : "bg-elevated text-slate-300 hover:bg-border"
              }`}
            >
              {a === "all" ? "All" : a === "CRYPTO" ? "Crypto" : "Stocks"}
            </button>
          ))}
        </div>
        <input
          className="mb-2 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none"
          placeholder="Search…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <div className="max-h-[520px] overflow-auto">
          {filteredCoins.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSymbol(c.symbol)}
              className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm ${
                c.symbol === symbol ? "bg-primary/20 text-white" : "text-slate-300 hover:bg-elevated"
              }`}
            >
              <span className="font-medium">{c.symbol}</span>
              <span className="truncate pl-2 text-xs text-slate-500">{c.name}</span>
            </button>
          ))}
          {filteredCoins.length === 0 && <p className="p-2 text-xs text-slate-500">No coins.</p>}
        </div>
      </aside>

      {/* chart area */}
      <section className="rounded-xl border border-border bg-surface p-4">
        {/* top bar */}
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <div className="text-xl font-semibold text-white">{symbol}</div>
          <div className="flex gap-1">
            {TIMEFRAMES.map((tf) => (
              <button key={tf} type="button" onClick={() => setTimeframe(tf)} className={chip(tf === timeframe)}>
                {tf}
              </button>
            ))}
          </div>
          <select
            className="rounded-md border border-border bg-background px-2 py-1 text-xs text-white focus:border-primary focus:outline-none"
            value={candlesN}
            onChange={(e) => setCandlesN(Number(e.target.value))}
          >
            {presets.map((p) => (
              <option key={p.label} value={p.candles}>
                {p.label}
              </option>
            ))}
          </select>
          {loading && <span className="text-xs text-slate-500">loading…</span>}
          {error && <span className="text-xs text-error">{error}</span>}
        </div>

        {/* OHLC legend */}
        {info && (
          <div className="mb-2 flex flex-wrap gap-4 text-xs text-slate-400">
            <span>O <span className="text-slate-200">{num(info.open, 4)}</span></span>
            <span>H <span className="text-slate-200">{num(info.high, 4)}</span></span>
            <span>L <span className="text-slate-200">{num(info.low, 4)}</span></span>
            <span>C <span className="text-slate-200">{num(info.close, 4)}</span></span>
            <span className={change >= 0 ? "text-success" : "text-error"}>
              {change >= 0 ? "+" : ""}
              {num(change, 2)}% over range
            </span>
          </div>
        )}

        {/* indicator toggles */}
        <div className="mb-3 flex flex-wrap gap-1.5">
          <button type="button" className={chip(overlays.sma20)} onClick={() => toggle("sma20")}>SMA20</button>
          <button type="button" className={chip(overlays.sma50)} onClick={() => toggle("sma50")}>SMA50</button>
          <button type="button" className={chip(overlays.sma200)} onClick={() => toggle("sma200")}>SMA200</button>
          <button type="button" className={chip(overlays.ema20)} onClick={() => toggle("ema20")}>EMA20</button>
          <button type="button" className={chip(overlays.bollinger)} onClick={() => toggle("bollinger")}>Bollinger</button>
          <button type="button" className={chip(overlays.vwap)} onClick={() => toggle("vwap")}>VWAP</button>
          <button type="button" className={chip(showVolume)} onClick={() => setShowVolume((v) => !v)}>Volume</button>
          <button type="button" className={chip(showRsi)} onClick={() => setShowRsi((v) => !v)}>RSI</button>
        </div>

        {/* drawing toolbar */}
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs text-slate-500">Draw:</span>
          <button type="button" className={chip(tool === "cursor")} onClick={() => setTool("cursor")} title="Cursor (pan/zoom)">
            ⤢ Cursor
          </button>
          <button type="button" className={chip(tool === "hline")} onClick={() => setTool("hline")} title="Click to place a horizontal line">
            — Horizontal
          </button>
          <button type="button" className={chip(tool === "trend")} onClick={() => setTool("trend")} title="Click two points to draw a trendline">
            ╱ Trendline
          </button>
          {drawings.length > 0 && (
            <button
              type="button"
              onClick={clearDrawings}
              className="rounded-md bg-elevated px-2.5 py-1 text-xs font-medium text-error hover:bg-border"
            >
              Clear ({drawings.length})
            </button>
          )}
          {tool === "trend" && (
            <span className="text-xs text-slate-500">click two points…</span>
          )}
        </div>

        {bars.length > 0 ? (
          <PriceChartPro
            bars={bars}
            overlays={overlays}
            showVolume={showVolume}
            showRsi={showRsi}
            priceLines={priceLines}
            tool={tool}
            drawings={drawings}
            onAddDrawing={addDrawing}
            onCrosshair={setHover}
          />
        ) : (
          <div className="flex h-[460px] items-center justify-center text-sm text-slate-500">
            {loading ? "Loading chart…" : "No candles for this coin/timeframe."}
          </div>
        )}

        <div className="mt-4">
          <AlertsPanel
            symbol={symbol}
            suggestedPrice={last ? last.close : 0}
            alerts={alerts}
            onAdd={addAlert}
            onDelete={removeAlert}
            onReset={rearmAlert}
          />
        </div>
      </section>
    </div>
  );
}
