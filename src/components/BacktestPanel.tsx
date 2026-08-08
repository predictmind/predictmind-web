"use client";

/**
 * BACKTEST tab: pick a coin, timeframe, how much history, and a strategy
 * (preset, prebuilt, or a custom rule), run it on historical data, and show the
 * results — headline metrics, a price chart with buy/sell markers, an equity
 * curve, and the trade list.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getBacktestTrades,
  getCandles,
  listCoins,
  runBacktest,
} from "@/lib/api";
import type { BacktestResult, Candle, Coin, RuleSpec, Trade } from "@/lib/types";
import { pct, num, money, signColor, toNum } from "@/lib/format";
import { STRATEGIES, TIMEFRAMES, historyPresets, type StrategyDef } from "@/lib/strategies";
import LineChart, { type ChartMarker } from "./LineChart";
import MetricCard from "./MetricCard";
import RuleBuilder from "./RuleBuilder";
import TradesTable from "./TradesTable";

const EMPTY_RULE: RuleSpec = {
  entry: { mode: "all", conditions: [{ type: "indicator", name: "rsi", period: 14, op: "lt", value: 30 }] },
  exit: { mode: "any", conditions: [{ type: "indicator", name: "rsi", period: 14, op: "gt", value: 70 }] },
};

const inputCls =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-white focus:border-primary focus:outline-none";
const labelCls = "mb-1 block text-xs uppercase tracking-wide text-slate-400";

function initParams(def: StrategyDef): Record<string, number> {
  const p: Record<string, number> = {};
  for (const f of def.paramFields ?? []) p[f.key] = f.default;
  return p;
}

export default function BacktestPanel({ connected }: { connected: boolean }) {
  const [coins, setCoins] = useState<Coin[]>([]);
  const [symbol, setSymbol] = useState("SOL");
  const [timeframe, setTimeframe] = useState("1d");
  const [candlesN, setCandlesN] = useState(2000);
  const [strategyId, setStrategyId] = useState(STRATEGIES[0].id);
  const [params, setParams] = useState<Record<string, number>>({});
  const [rule, setRule] = useState<RuleSpec>(EMPTY_RULE);

  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [priceCandles, setPriceCandles] = useState<Candle[]>([]);

  const def = useMemo(
    () => STRATEGIES.find((s) => s.id === strategyId) ?? STRATEGIES[0],
    [strategyId],
  );

  const loadCoins = useCallback(() => {
    if (!connected) return;
    listCoins()
      .then((cs) => setCoins(cs.filter((c) => c.status !== "INACTIVE")))
      .catch(() => setCoins([]));
  }, [connected]);

  useEffect(() => {
    loadCoins();
  }, [loadCoins]);

  // When the strategy changes, apply its timeframe/history hints and default params.
  useEffect(() => {
    setParams(initParams(def));
    if (def.timeframeHint) setTimeframe(def.timeframeHint);
    if (def.limitHint) setCandlesN(def.limitHint);
  }, [def]);

  const presets = historyPresets(timeframe);

  const run = async () => {
    setRunning(true);
    setError("");
    setResult(null);
    setTrades([]);
    setPriceCandles([]);
    try {
      const built = def.build(params);
      const body = {
        symbol,
        timeframe,
        strategy: built.strategy,
        params: built.params,
        rules: def.kind === "custom" ? rule : built.rules,
        risk: built.risk,
        limit: candlesN,
      };
      const res = await runBacktest(body);
      setResult(res);
      // Best-effort extras for the charts/tables.
      const [tr, candles] = await Promise.all([
        getBacktestTrades(res.id).catch(() => [] as Trade[]),
        getCandles(symbol, timeframe, candlesN).catch(() => [] as Candle[]),
      ]);
      setTrades(tr);
      setPriceCandles(candles);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Backtest failed");
    } finally {
      setRunning(false);
    }
  };

  // --- derived chart data ---
  const priceSeries = useMemo(() => priceCandles.map((c) => toNum(c.close)), [priceCandles]);

  const priceMarkers = useMemo<ChartMarker[]>(() => {
    if (!priceCandles.length || !trades.length) return [];
    const idxByTime = new Map<number, number>();
    priceCandles.forEach((c, i) => idxByTime.set(new Date(c.openTime).getTime(), i));
    const nearest = (iso: string): number => {
      const t = new Date(iso).getTime();
      if (idxByTime.has(t)) return idxByTime.get(t) as number;
      let best = -1;
      let bestDiff = Infinity;
      priceCandles.forEach((c, i) => {
        const diff = Math.abs(new Date(c.openTime).getTime() - t);
        if (diff < bestDiff) {
          bestDiff = diff;
          best = i;
        }
      });
      return best;
    };
    const marks: ChartMarker[] = [];
    for (const tr of trades) {
      marks.push({ index: nearest(tr.entryTime), kind: "buy" });
      marks.push({ index: nearest(tr.exitTime), kind: "sell" });
    }
    return marks;
  }, [priceCandles, trades]);

  const equitySeries = useMemo(() => {
    if (!trades.length) return [];
    let eq = 100;
    const curve = [100];
    for (const tr of trades) {
      eq *= 1 + toNum(tr.pnlPct) / 100;
      curve.push(eq);
    }
    return curve;
  }, [trades]);

  const m = result?.metrics;

  return (
    <div className="space-y-6">
      {/* ---- form ---- */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <label className={labelCls}>Coin</label>
            <select className={inputCls} value={symbol} onChange={(e) => setSymbol(e.target.value)}>
              {coins.length === 0 && <option value={symbol}>{symbol}</option>}
              {coins.map((c) => (
                <option key={c.id} value={c.symbol}>
                  {c.symbol} — {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls}>Timeframe</label>
            <select
              className={inputCls}
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
            >
              {TIMEFRAMES.map((tf) => (
                <option key={tf} value={tf}>
                  {tf}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls}>History</label>
            <select
              className={inputCls}
              value={candlesN}
              onChange={(e) => setCandlesN(Number(e.target.value))}
            >
              {presets.map((p) => (
                <option key={p.label} value={p.candles}>
                  {p.label} (~{p.candles} candles)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls}>Strategy</label>
            <select
              className={inputCls}
              value={strategyId}
              onChange={(e) => setStrategyId(e.target.value)}
            >
              {STRATEGIES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <p className="mt-3 text-sm text-slate-400">{def.description}</p>

        {/* prebuilt params */}
        {def.paramFields && def.paramFields.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-4">
            {def.paramFields.map((f) => (
              <label key={f.key} className="text-sm text-slate-400">
                <span className="mr-2">{f.label}</span>
                <input
                  type="number"
                  className="w-24 rounded-md border border-border bg-background px-2 py-1 text-white focus:border-primary focus:outline-none"
                  value={params[f.key] ?? f.default}
                  min={f.min}
                  max={f.max}
                  onChange={(e) =>
                    setParams((prev) => ({ ...prev, [f.key]: Number(e.target.value) }))
                  }
                />
              </label>
            ))}
          </div>
        )}

        {/* custom rule builder */}
        {def.kind === "custom" && (
          <div className="mt-4">
            <RuleBuilder spec={rule} onChange={setRule} />
          </div>
        )}

        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            onClick={run}
            disabled={!connected || running}
            className="rounded-md bg-primary px-5 py-2.5 font-medium text-white disabled:opacity-50"
          >
            {running ? "Running backtest…" : "Run backtest"}
          </button>
          {!connected && (
            <span className="text-sm text-warning">Connect (above) to run backtests.</span>
          )}
          {error ? <span className="text-sm text-error">{error}</span> : null}
        </div>
      </div>

      {/* ---- results ---- */}
      {m && result && (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Net profit"
              value={pct(m.netProfitPct)}
              valueClass={signColor(m.netProfitPct)}
              hint={`Buy & hold: ${pct(m.buyHoldPct)}`}
            />
            <MetricCard label="Win rate" value={`${num(m.winRate, 1)}%`} hint={`${m.tradesCount} trades`} />
            <MetricCard
              label="Profit factor"
              value={num(m.profitFactor, 2)}
              valueClass={m.profitFactor >= 1 ? "text-success" : "text-error"}
              hint="Money won ÷ money lost"
            />
            <MetricCard
              label="Max drawdown"
              value={`${num(m.maxDrawdownPct, 1)}%`}
              valueClass="text-warning"
              hint="Worst peak-to-valley drop"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Final equity" value={money(m.finalEquity)} hint="From ₹10,000 start" />
            <MetricCard label="Sharpe" value={num(m.sharpe, 2)} hint="Risk-adjusted return" />
            <MetricCard label="Avg trade" value={pct(m.avgTradePct, 2)} valueClass={signColor(m.avgTradePct)} />
            <MetricCard
              label="PredictScore"
              value={`${num(result.predictScore.score, 0)} (${result.predictScore.grade})`}
              hint={`confidence ${num(result.predictScore.confidence, 0)}%`}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-surface p-4">
              <h3 className="mb-3 text-sm font-medium text-slate-300">
                Price ({symbol} {timeframe}) — buy/sell markers
              </h3>
              <LineChart data={priceSeries} color="#00D4FF" markers={priceMarkers} />
            </div>
            <div className="rounded-xl border border-border bg-surface p-4">
              <h3 className="mb-3 text-sm font-medium text-slate-300">
                Equity curve (compounded, start = 100)
              </h3>
              <LineChart data={equitySeries} color="#7B61FF" baseline={100} />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-surface p-4">
            <h3 className="mb-3 text-sm font-medium text-slate-300">Trades ({trades.length})</h3>
            <TradesTable trades={trades} />
          </div>
        </div>
      )}
    </div>
  );
}
