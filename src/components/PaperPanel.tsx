"use client";

/**
 * PAPER / LIVE tab: forward-test on the LIVE market with virtual money. Open a
 * virtual account, watch a live-priced portfolio (equity + PnL), and place
 * buy/sell orders that fill at current market prices — exactly like real trading
 * but risk-free. An optional auto-refresh polls the portfolio so it updates live.
 */

import { useCallback, useEffect, useState } from "react";
import {
  cancelPaperOrder,
  createPaperAccount,
  getPaperPortfolio,
  listCoins,
  listPaperOrders,
  listPaperTrades,
  placePaperOrder,
  type PlaceOrderBody,
} from "@/lib/api";
import type { Coin, PaperOrder, PaperPortfolio, PaperTrade } from "@/lib/types";
import { money, num, pct, signColor } from "@/lib/format";

const ACC_KEY = "pm.paperAccountId";
const inputCls =
  "rounded-md border border-border bg-background px-3 py-2 text-sm text-white focus:border-primary focus:outline-none";
const labelCls = "mb-1 block text-xs uppercase tracking-wide text-slate-400";

export default function PaperPanel({ connected }: { connected: boolean }) {
  const [accountId, setAccountId] = useState("");
  const [startBal, setStartBal] = useState(10000);
  const [coins, setCoins] = useState<Coin[]>([]);
  const [portfolio, setPortfolio] = useState<PaperPortfolio | null>(null);
  const [orders, setOrders] = useState<PaperOrder[]>([]);
  const [trades, setTrades] = useState<PaperTrade[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // order form
  const [symbol, setSymbol] = useState("BTC");
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [otype, setOtype] = useState<"MARKET" | "LIMIT" | "STOP">("MARKET");
  const [qty, setQty] = useState(0.01);
  const [limitPrice, setLimitPrice] = useState(0);
  const [stopPrice, setStopPrice] = useState(0);

  useEffect(() => {
    setAccountId(localStorage.getItem(ACC_KEY) ?? "");
  }, []);

  useEffect(() => {
    if (connected) listCoins().then((c) => setCoins(c)).catch(() => setCoins([]));
  }, [connected]);

  const refresh = useCallback(async () => {
    if (!accountId) return;
    setError("");
    try {
      const [p, o, t] = await Promise.all([
        getPaperPortfolio(accountId),
        listPaperOrders(accountId).catch(() => [] as PaperOrder[]),
        listPaperTrades(accountId).catch(() => [] as PaperTrade[]),
      ]);
      setPortfolio(p);
      setOrders(o);
      setTrades(t);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load account");
    }
  }, [accountId]);

  useEffect(() => {
    if (accountId && connected) refresh();
  }, [accountId, connected, refresh]);

  // Live auto-refresh loop.
  useEffect(() => {
    if (!autoRefresh || !accountId || !connected) return;
    const id = setInterval(refresh, 8000);
    return () => clearInterval(id);
  }, [autoRefresh, accountId, connected, refresh]);

  const openAccount = async () => {
    setBusy(true);
    setError("");
    try {
      const acc = await createPaperAccount(startBal);
      localStorage.setItem(ACC_KEY, acc.id);
      setAccountId(acc.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open account");
    } finally {
      setBusy(false);
    }
  };

  const selectAccount = (id: string) => {
    localStorage.setItem(ACC_KEY, id.trim());
    setAccountId(id.trim());
  };

  const submitOrder = async () => {
    if (!accountId) return;
    setBusy(true);
    setError("");
    try {
      const body: PlaceOrderBody = { symbol, side, type: otype, quantity: qty };
      if (otype === "LIMIT") body.limitPrice = limitPrice;
      if (otype === "STOP") body.stopPrice = stopPrice;
      await placePaperOrder(accountId, body);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Order failed");
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (orderId: string) => {
    try {
      await cancelPaperOrder(orderId);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cancel failed");
    }
  };

  if (!connected) {
    return <p className="text-sm text-warning">Connect (above) to use paper trading.</p>;
  }

  // No account yet → onboarding.
  if (!accountId) {
    return (
      <div className="rounded-xl border border-border bg-surface p-5">
        <h3 className="mb-3 font-medium text-white">Start paper trading</h3>
        <p className="mb-4 text-sm text-slate-400">
          Open a virtual account with fake money and trade the live market risk-free. Orders fill at
          real current prices.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className={labelCls}>Starting balance (USD)</label>
            <input
              type="number"
              className={inputCls}
              value={startBal}
              onChange={(e) => setStartBal(Number(e.target.value))}
            />
          </div>
          <button
            type="button"
            onClick={openAccount}
            disabled={busy}
            className="rounded-md bg-primary px-5 py-2.5 font-medium text-white disabled:opacity-50"
          >
            {busy ? "Opening…" : "Open account"}
          </button>
        </div>
        <div className="mt-4 border-t border-border/60 pt-4">
          <label className={labelCls}>…or use an existing account id</label>
          <input
            className={`${inputCls} w-full max-w-md`}
            placeholder="account id"
            onKeyDown={(e) => {
              if (e.key === "Enter") selectAccount((e.target as HTMLInputElement).value);
            }}
          />
        </div>
        {error ? <p className="mt-3 text-sm text-error">{error}</p> : null}
      </div>
    );
  }

  const positions = portfolio?.positions ?? [];

  return (
    <div className="space-y-6">
      {/* header / account */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4">
        <div className="text-sm text-slate-400">
          Account <span className="font-mono text-slate-300">{accountId.slice(0, 8)}…</span>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-400">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Live auto-refresh (8s)
          </label>
          <button
            type="button"
            onClick={refresh}
            className="rounded-md border border-border px-3 py-2 text-sm text-slate-300 hover:bg-elevated"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={() => selectAccount("")}
            className="rounded-md border border-border px-3 py-2 text-sm text-slate-300 hover:bg-elevated"
          >
            Switch account
          </button>
        </div>
      </div>

      {/* portfolio snapshot */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="text-xs uppercase tracking-wide text-slate-400">Equity</div>
          <div className="mt-1 text-2xl font-semibold text-white">
            {money(portfolio?.equity ?? portfolio?.startingBalance, 2)}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="text-xs uppercase tracking-wide text-slate-400">Cash</div>
          <div className="mt-1 text-2xl font-semibold text-white">{money(portfolio?.cash, 2)}</div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="text-xs uppercase tracking-wide text-slate-400">PnL</div>
          <div className={`mt-1 text-2xl font-semibold ${signColor(portfolio?.pnl)}`}>
            {money(portfolio?.pnl, 2)}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="text-xs uppercase tracking-wide text-slate-400">Return</div>
          <div className={`mt-1 text-2xl font-semibold ${signColor(portfolio?.pnlPct)}`}>
            {pct(portfolio?.pnlPct)}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* order form */}
        <div className="rounded-xl border border-border bg-surface p-5">
          <h3 className="mb-4 font-medium text-white">Place order (fills at live price)</h3>
          <div className="grid grid-cols-2 gap-3">
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
              <label className={labelCls}>Side</label>
              <select
                className={`${inputCls} w-full`}
                value={side}
                onChange={(e) => setSide(e.target.value as "BUY" | "SELL")}
              >
                <option value="BUY">BUY</option>
                <option value="SELL">SELL</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Type</label>
              <select
                className={`${inputCls} w-full`}
                value={otype}
                onChange={(e) => setOtype(e.target.value as "MARKET" | "LIMIT" | "STOP")}
              >
                <option value="MARKET">MARKET</option>
                <option value="LIMIT">LIMIT</option>
                <option value="STOP">STOP</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Quantity</label>
              <input
                type="number"
                className={`${inputCls} w-full`}
                value={qty}
                onChange={(e) => setQty(Number(e.target.value))}
              />
            </div>
            {otype === "LIMIT" && (
              <div>
                <label className={labelCls}>Limit price</label>
                <input
                  type="number"
                  className={`${inputCls} w-full`}
                  value={limitPrice}
                  onChange={(e) => setLimitPrice(Number(e.target.value))}
                />
              </div>
            )}
            {otype === "STOP" && (
              <div>
                <label className={labelCls}>Stop price</label>
                <input
                  type="number"
                  className={`${inputCls} w-full`}
                  value={stopPrice}
                  onChange={(e) => setStopPrice(Number(e.target.value))}
                />
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={submitOrder}
            disabled={busy || qty <= 0}
            className={`mt-4 rounded-md px-5 py-2.5 font-medium text-white disabled:opacity-50 ${
              side === "BUY" ? "bg-success" : "bg-error"
            }`}
          >
            {busy ? "Submitting…" : `${side} ${symbol}`}
          </button>
          {error ? <p className="mt-3 text-sm text-error">{error}</p> : null}
        </div>

        {/* positions */}
        <div className="rounded-xl border border-border bg-surface p-5">
          <h3 className="mb-4 font-medium text-white">Positions</h3>
          {positions.length === 0 ? (
            <p className="text-sm text-slate-400">No open positions.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-slate-400">
                <tr>
                  <th className="py-1">Coin</th>
                  <th className="py-1 text-right">Qty</th>
                  <th className="py-1 text-right">Value</th>
                  <th className="py-1 text-right">PnL</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((p) => (
                  <tr key={p.symbol} className="border-t border-border/60">
                    <td className="py-1 text-slate-200">{p.symbol}</td>
                    <td className="py-1 text-right text-slate-300">{num(p.quantity, 4)}</td>
                    <td className="py-1 text-right text-slate-300">{money(p.value, 2)}</td>
                    <td className={`py-1 text-right ${signColor(p.pnl)}`}>{pct(p.pnlPct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* open orders */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <h3 className="mb-3 font-medium text-white">Orders</h3>
        {orders.length === 0 ? (
          <p className="text-sm text-slate-400">No orders yet.</p>
        ) : (
          <div className="max-h-72 overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-slate-400">
                <tr>
                  <th className="py-1">Coin</th>
                  <th className="py-1">Side</th>
                  <th className="py-1">Type</th>
                  <th className="py-1 text-right">Qty</th>
                  <th className="py-1">Status</th>
                  <th className="py-1"></th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-t border-border/60">
                    <td className="py-1 text-slate-200">{o.symbol}</td>
                    <td className={`py-1 ${o.side === "BUY" ? "text-success" : "text-error"}`}>
                      {o.side}
                    </td>
                    <td className="py-1 text-slate-300">{o.type}</td>
                    <td className="py-1 text-right text-slate-300">{num(o.quantity, 4)}</td>
                    <td className="py-1 text-slate-400">{o.status}</td>
                    <td className="py-1 text-right">
                      {o.status === "OPEN" && (
                        <button
                          type="button"
                          onClick={() => cancel(o.id)}
                          className="text-xs text-error hover:underline"
                        >
                          cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-slate-500">
        {trades.length} executed trade{trades.length === 1 ? "" : "s"} on this account. Paper trading
        uses virtual money at live market prices — a safe way to forward-test before risking real
        funds.
      </p>
    </div>
  );
}
