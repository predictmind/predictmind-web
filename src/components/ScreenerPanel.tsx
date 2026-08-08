"use client";

/**
 * SCREENER tab: scan every coin/stock for a timeframe and show a sortable,
 * filterable table of key metrics (price, change%, RSI, vs SMA50/200, trend,
 * distance from the 20-bar high, volume). Quick presets filter to common setups.
 * Click a row to open that symbol on the Charts tab.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { getScreener } from "@/lib/api";
import type { ScreenerRow } from "@/lib/types";
import { num, pct, signColor } from "@/lib/format";
import { TIMEFRAMES } from "@/lib/strategies";

type Preset = "none" | "oversold" | "overbought" | "uptrend" | "nearHigh" | "downtrend";
type SortKey = "symbol" | "price" | "changePct" | "rsi" | "distFromHigh20Pct" | "volume";

const chip = (active: boolean) =>
  `rounded-md px-2.5 py-1 text-xs font-medium transition ${
    active ? "bg-primary text-white" : "bg-elevated text-slate-300 hover:bg-border"
  }`;

function passesPreset(r: ScreenerRow, preset: Preset): boolean {
  switch (preset) {
    case "oversold":
      return r.rsi != null && r.rsi < 30;
    case "overbought":
      return r.rsi != null && r.rsi > 70;
    case "uptrend":
      return r.aboveSma200 === true && r.trendUp === true;
    case "downtrend":
      return r.aboveSma200 === false && r.trendUp === false;
    case "nearHigh":
      return r.distFromHigh20Pct != null && r.distFromHigh20Pct >= -2;
    default:
      return true;
  }
}

export default function ScreenerPanel({
  connected,
  onOpenChart,
}: {
  connected: boolean;
  onOpenChart: (symbol: string) => void;
}) {
  const [assetClass, setAssetClass] = useState<"all" | "CRYPTO" | "STOCK">("all");
  const [timeframe, setTimeframe] = useState("1d");
  const [rows, setRows] = useState<ScreenerRow[]>([]);
  const [preset, setPreset] = useState<Preset>("none");
  const [sortKey, setSortKey] = useState<SortKey>("changePct");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    if (!connected) return;
    setLoading(true);
    setError("");
    getScreener(assetClass === "all" ? undefined : assetClass, timeframe)
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : "Screener failed"))
      .finally(() => setLoading(false));
  }, [connected, assetClass, timeframe]);

  useEffect(() => {
    load();
  }, [load]);

  const view = useMemo(() => {
    const filtered = rows.filter((r) => passesPreset(r, preset));
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortKey === "symbol") return a.symbol.localeCompare(b.symbol) * dir;
      const av = (a[sortKey] as number | null) ?? -Infinity;
      const bv = (b[sortKey] as number | null) ?? -Infinity;
      return (av - bv) * dir;
    });
  }, [rows, preset, sortKey, sortDir]);

  const sort = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "symbol" ? "asc" : "desc");
    }
  };

  const th = (key: SortKey, label: string, align: "left" | "right" = "right") => (
    <th
      className={`cursor-pointer select-none px-3 py-2 font-medium hover:text-white ${align === "right" ? "text-right" : "text-left"}`}
      onClick={() => sort(key)}
    >
      {label}
      {sortKey === key ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
    </th>
  );

  if (!connected) {
    return <p className="text-sm text-warning">Connect (above) to use the screener.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface p-4">
        <div className="flex gap-1">
          {(["all", "CRYPTO", "STOCK"] as const).map((a) => (
            <button key={a} type="button" onClick={() => setAssetClass(a)} className={chip(assetClass === a)}>
              {a === "all" ? "All" : a === "CRYPTO" ? "Crypto" : "Stocks"}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {TIMEFRAMES.map((tf) => (
            <button key={tf} type="button" onClick={() => setTimeframe(tf)} className={chip(timeframe === tf)}>
              {tf}
            </button>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap gap-1">
          <span className="mr-1 self-center text-xs text-slate-500">Preset:</span>
          <button type="button" className={chip(preset === "none")} onClick={() => setPreset("none")}>All</button>
          <button type="button" className={chip(preset === "oversold")} onClick={() => setPreset("oversold")}>Oversold RSI&lt;30</button>
          <button type="button" className={chip(preset === "overbought")} onClick={() => setPreset("overbought")}>Overbought RSI&gt;70</button>
          <button type="button" className={chip(preset === "uptrend")} onClick={() => setPreset("uptrend")}>Uptrend</button>
          <button type="button" className={chip(preset === "downtrend")} onClick={() => setPreset("downtrend")}>Downtrend</button>
          <button type="button" className={chip(preset === "nearHigh")} onClick={() => setPreset("nearHigh")}>Near 20-bar high</button>
        </div>
        <button
          type="button"
          onClick={load}
          className="rounded-md border border-border px-3 py-1.5 text-sm text-slate-300 hover:bg-elevated"
        >
          Refresh
        </button>
      </div>

      <div className="rounded-xl border border-border bg-surface p-2">
        {loading && <p className="p-3 text-sm text-slate-500">Scanning…</p>}
        {error && <p className="p-3 text-sm text-error">{error}</p>}
        {!loading && !error && (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-slate-400">
                <tr className="border-b border-border">
                  {th("symbol", "Symbol", "left")}
                  {th("price", "Price")}
                  {th("changePct", "Chg %")}
                  {th("rsi", "RSI")}
                  <th className="px-3 py-2 text-right font-medium">vs SMA50</th>
                  <th className="px-3 py-2 text-right font-medium">vs SMA200</th>
                  <th className="px-3 py-2 text-right font-medium">Trend</th>
                  {th("distFromHigh20Pct", "% from 20-hi")}
                  {th("volume", "Volume")}
                </tr>
              </thead>
              <tbody>
                {view.map((r) => (
                  <tr
                    key={r.symbol}
                    className="cursor-pointer border-b border-border/50 hover:bg-elevated"
                    onClick={() => onOpenChart(r.symbol)}
                  >
                    <td className="px-3 py-2">
                      <span className="font-medium text-slate-100">{r.symbol}</span>
                      <span className="ml-2 text-xs text-slate-500">{r.assetClass === "STOCK" ? "stock" : "crypto"}</span>
                    </td>
                    <td className="px-3 py-2 text-right text-slate-200">{num(r.price, 4)}</td>
                    <td className={`px-3 py-2 text-right ${signColor(r.changePct)}`}>{r.changePct != null ? pct(r.changePct, 2) : "—"}</td>
                    <td className={`px-3 py-2 text-right ${r.rsi != null && r.rsi < 30 ? "text-success" : r.rsi != null && r.rsi > 70 ? "text-error" : "text-slate-300"}`}>
                      {r.rsi != null ? num(r.rsi, 0) : "—"}
                    </td>
                    <td className={`px-3 py-2 text-right ${r.aboveSma50 ? "text-success" : "text-error"}`}>{r.aboveSma50 == null ? "—" : r.aboveSma50 ? "above" : "below"}</td>
                    <td className={`px-3 py-2 text-right ${r.aboveSma200 ? "text-success" : "text-error"}`}>{r.aboveSma200 == null ? "—" : r.aboveSma200 ? "above" : "below"}</td>
                    <td className={`px-3 py-2 text-right ${r.trendUp ? "text-success" : "text-error"}`}>{r.trendUp == null ? "—" : r.trendUp ? "up" : "down"}</td>
                    <td className="px-3 py-2 text-right text-slate-300">{r.distFromHigh20Pct != null ? num(r.distFromHigh20Pct, 1) + "%" : "—"}</td>
                    <td className="px-3 py-2 text-right text-slate-400">{r.volume != null ? num(r.volume, 0) : "—"}</td>
                  </tr>
                ))}
                {view.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-3 py-6 text-center text-sm text-slate-500">
                      No symbols match. Try a different preset, timeframe, or import more data.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="text-xs text-slate-500">
        Click any row to open it on the Charts tab. Metrics are computed from stored candles; import
        data for a symbol first if it shows no values.
      </p>
    </div>
  );
}
