"use client";

/**
 * MULTI-CHART layout: a grid of compact, self-contained charts so you can watch
 * several markets at once. Each cell has its own symbol + timeframe and fetches
 * its own candles; the parent (ChartsPanel) persists the pane list so a layout is
 * remembered between visits. Cells are intentionally lean (candles + volume + a
 * couple of moving averages) — the full toolbox lives in the single-chart view.
 */

import { useCallback, useEffect, useState } from "react";
import { getCandles } from "@/lib/api";
import type { Candle, Coin } from "@/lib/types";
import type { OhlcvBar } from "@/lib/indicators";
import { TIMEFRAMES } from "@/lib/strategies";
import PriceChartPro, { type Overlays } from "./PriceChartPro";

export interface Pane {
  symbol: string;
  timeframe: string;
}

const CELL_OVERLAYS: Overlays = {
  sma20: false,
  sma50: true,
  sma200: true,
  ema20: false,
  bollinger: false,
  vwap: false,
};

/** Market candles (strings, newest-first) → ascending unique OHLCV bars. */
function toBars(candles: Candle[]): OhlcvBar[] {
  const bars = candles.map((c) => ({
    time: Math.floor(new Date(c.openTime).getTime() / 1000),
    open: Number(c.open),
    high: Number(c.high),
    low: Number(c.low),
    close: Number(c.close),
    volume: Number(c.volume),
  }));
  bars.sort((a, b) => a.time - b.time);
  const out: OhlcvBar[] = [];
  let prev = -1;
  for (const b of bars) {
    if (b.time !== prev) out.push(b);
    prev = b.time;
  }
  return out;
}

function ChartCell({
  pane,
  coins,
  onChange,
}: {
  pane: Pane;
  coins: Coin[];
  onChange: (p: Pane) => void;
}) {
  const [bars, setBars] = useState<OhlcvBar[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    getCandles(pane.symbol, pane.timeframe, 400)
      .then((c) => setBars(toBars(c)))
      .catch(() => setBars([]))
      .finally(() => setLoading(false));
  }, [pane.symbol, pane.timeframe]);

  useEffect(() => {
    load();
  }, [load]);

  const chip = (active: boolean) =>
    `rounded px-1.5 py-0.5 text-[11px] font-medium transition ${
      active ? "bg-primary text-white" : "bg-elevated text-slate-300 hover:bg-border"
    }`;

  return (
    <div className="rounded-lg border border-border bg-surface p-2">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <select
          className="rounded-md border border-border bg-background px-2 py-1 text-sm text-white focus:border-primary focus:outline-none"
          value={pane.symbol}
          onChange={(e) => onChange({ ...pane, symbol: e.target.value })}
        >
          {coins.length === 0 && <option value={pane.symbol}>{pane.symbol}</option>}
          {coins.map((c) => (
            <option key={c.id} value={c.symbol}>
              {c.symbol}
            </option>
          ))}
        </select>
        <div className="flex gap-1">
          {TIMEFRAMES.map((tf) => (
            <button key={tf} type="button" className={chip(tf === pane.timeframe)} onClick={() => onChange({ ...pane, timeframe: tf })}>
              {tf}
            </button>
          ))}
        </div>
        {loading && <span className="text-[11px] text-slate-500">…</span>}
      </div>
      {bars.length > 0 ? (
        <PriceChartPro bars={bars} overlays={CELL_OVERLAYS} showVolume showRsi={false} height={280} />
      ) : (
        <div className="flex h-[280px] items-center justify-center text-xs text-slate-500">
          {loading ? "Loading…" : "No data — import candles for this symbol."}
        </div>
      )}
    </div>
  );
}

export default function MultiChart({
  count,
  panes,
  coins,
  onPanesChange,
}: {
  count: 2 | 4;
  panes: Pane[];
  coins: Coin[];
  onPanesChange: (panes: Pane[]) => void;
}) {
  const setPane = (i: number, p: Pane) => {
    const next = panes.slice();
    next[i] = p;
    onPanesChange(next);
  };

  return (
    <div className={`grid gap-3 ${count === 2 ? "lg:grid-cols-2" : "grid-cols-1 md:grid-cols-2"}`}>
      {panes.slice(0, count).map((pane, i) => (
        <ChartCell key={i} pane={pane} coins={coins} onChange={(p) => setPane(i, p)} />
      ))}
    </div>
  );
}
