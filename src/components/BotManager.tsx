"use client";

/**
 * Strategy Bots: create an automated bot that trades a chosen strategy on this
 * paper account, on the live market. The bot runs server-side on a timer; here
 * we create/list/enable/disable/delete bots and can "Run now" to tick instantly.
 */

import { useCallback, useEffect, useState } from "react";
import { createBot, deleteBot, listBots, setBotEnabled, tickBot } from "@/lib/api";
import type { Coin, CreateBotRequest, StrategyBot } from "@/lib/types";
import { num } from "@/lib/format";
import { STRATEGIES, TIMEFRAMES } from "@/lib/strategies";

const inputCls =
  "rounded-md border border-border bg-background px-3 py-2 text-sm text-white focus:border-primary focus:outline-none";
const labelCls = "mb-1 block text-xs uppercase tracking-wide text-slate-400";

// Bots can use presets and prebuilt strategies (custom rule building is on the
// Backtest tab); everything except the "custom" placeholder is offered here.
const BOT_STRATEGIES = STRATEGIES.filter((s) => s.kind !== "custom");

export default function BotManager({
  accountId,
  coins,
  onAction,
}: {
  accountId: string;
  coins: Coin[];
  onAction: () => void;
}) {
  const [bots, setBots] = useState<StrategyBot[]>([]);
  const [strategyId, setStrategyId] = useState(BOT_STRATEGIES[0].id);
  const [symbol, setSymbol] = useState("SOL");
  const [timeframe, setTimeframe] = useState(BOT_STRATEGIES[0].timeframeHint ?? "1d");
  const [allocationPct, setAllocationPct] = useState(20);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    listBots(accountId)
      .then(setBots)
      .catch(() => setBots([]));
  }, [accountId]);

  useEffect(() => {
    load();
  }, [load]);

  const onStrategyChange = (id: string) => {
    setStrategyId(id);
    const def = BOT_STRATEGIES.find((s) => s.id === id);
    if (def?.timeframeHint) setTimeframe(def.timeframeHint);
  };

  const create = async () => {
    setBusy(true);
    setError("");
    try {
      const def = BOT_STRATEGIES.find((s) => s.id === strategyId);
      if (!def) throw new Error("Pick a strategy");
      const params: Record<string, number> = {};
      for (const f of def.paramFields ?? []) params[f.key] = f.default;
      const built = def.build(params);
      const body: CreateBotRequest = {
        accountId,
        name: `${def.label} · ${symbol}`,
        symbol,
        timeframe,
        strategyName: built.strategy,
        params: built.params,
        rules: built.rules,
        allocationPct: allocationPct / 100,
      };
      await createBot(body);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create bot");
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (b: StrategyBot) => {
    await setBotEnabled(b.id, !b.enabled).catch(() => undefined);
    load();
  };

  const remove = async (id: string) => {
    await deleteBot(id).catch(() => undefined);
    load();
  };

  const runNow = async (id: string) => {
    setBusy(true);
    try {
      await tickBot(id);
      load();
      onAction();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tick failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <h3 className="mb-1 font-medium text-white">Strategy bots (automated live trading)</h3>
      <p className="mb-4 text-sm text-slate-400">
        A bot checks its strategy on live prices every minute and buys/sells for you on this account.
        Forward-testing, hands-free.
      </p>

      {/* create form */}
      <div className="grid gap-3 md:grid-cols-5">
        <div className="md:col-span-2">
          <label className={labelCls}>Strategy</label>
          <select className={`${inputCls} w-full`} value={strategyId} onChange={(e) => onStrategyChange(e.target.value)}>
            {BOT_STRATEGIES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Coin</label>
          <select className={`${inputCls} w-full`} value={symbol} onChange={(e) => setSymbol(e.target.value)}>
            {coins.length === 0 && <option value={symbol}>{symbol}</option>}
            {coins.map((c) => (
              <option key={c.id} value={c.symbol}>
                {c.symbol}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Timeframe</label>
          <select className={`${inputCls} w-full`} value={timeframe} onChange={(e) => setTimeframe(e.target.value)}>
            {TIMEFRAMES.map((tf) => (
              <option key={tf} value={tf}>
                {tf}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Alloc % / trade</label>
          <input
            type="number"
            className={`${inputCls} w-full`}
            value={allocationPct}
            min={2}
            max={100}
            onChange={(e) => setAllocationPct(Number(e.target.value))}
          />
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={create}
          disabled={busy}
          className="rounded-md bg-primary px-5 py-2 font-medium text-white disabled:opacity-50"
        >
          {busy ? "Working…" : "Create bot"}
        </button>
        {error ? <span className="text-sm text-error">{error}</span> : null}
      </div>

      {/* bot list */}
      <div className="mt-5">
        {bots.length === 0 ? (
          <p className="text-sm text-slate-400">No bots yet.</p>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-slate-400">
                <tr>
                  <th className="py-1">Bot</th>
                  <th className="py-1">Coin/TF</th>
                  <th className="py-1 text-right">Alloc</th>
                  <th className="py-1">Last signal</th>
                  <th className="py-1">Last action</th>
                  <th className="py-1">State</th>
                  <th className="py-1"></th>
                </tr>
              </thead>
              <tbody>
                {bots.map((b) => (
                  <tr key={b.id} className="border-t border-border/60 align-top">
                    <td className="py-2 text-slate-200">{b.name}</td>
                    <td className="py-2 text-slate-300">
                      {b.symbol} {b.timeframe}
                    </td>
                    <td className="py-2 text-right text-slate-300">{num(Number(b.allocationPct) * 100, 0)}%</td>
                    <td className="py-2 text-slate-300">{b.lastSignal ?? "—"}</td>
                    <td className="py-2 text-slate-400">
                      {b.lastError ? <span className="text-error">{b.lastError}</span> : b.lastAction ?? "—"}
                    </td>
                    <td className={`py-2 ${b.enabled ? "text-success" : "text-slate-500"}`}>
                      {b.enabled ? "running" : "paused"}
                    </td>
                    <td className="py-2 text-right">
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => runNow(b.id)} className="text-xs text-secondary hover:underline">
                          run now
                        </button>
                        <button type="button" onClick={() => toggle(b)} className="text-xs text-slate-300 hover:underline">
                          {b.enabled ? "pause" : "resume"}
                        </button>
                        <button type="button" onClick={() => remove(b.id)} className="text-xs text-error hover:underline">
                          delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
