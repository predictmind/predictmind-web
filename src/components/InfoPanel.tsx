"use client";

/**
 * INFO tab: market context for a symbol in one place —
 *  - Fear & Greed (market-wide sentiment gauge),
 *  - Funding rate, Open interest, Long/Short ratio (crypto futures context),
 *  - News-derived sentiment (bullish/bearish/neutral),
 *  - a live news feed with per-article sentiment.
 * All data already exists in the market + news services; this is the view layer.
 */

import { useCallback, useEffect, useState } from "react";
import {
  getFearGreed,
  getFunding,
  getLongShort,
  getNews,
  getOpenInterest,
  getSentiment,
  listCoins,
} from "@/lib/api";
import type {
  Coin,
  FearGreedPoint,
  FundingPoint,
  LsrPoint,
  NewsItem,
  OiPoint,
  SentimentAgg,
} from "@/lib/types";
import { dateLabel, num, pct, signColor, toNum } from "@/lib/format";

function Card({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-white">{children}</div>
      {hint ? <div className="mt-1 text-xs text-slate-500">{hint}</div> : null}
    </div>
  );
}

function fgColor(v: number): string {
  if (v >= 75) return "text-success";
  if (v >= 55) return "text-success/80";
  if (v >= 45) return "text-slate-300";
  if (v >= 25) return "text-warning";
  return "text-error";
}

function sentimentBadge(s?: string): string {
  if (s === "POSITIVE") return "bg-success/20 text-success";
  if (s === "NEGATIVE") return "bg-error/20 text-error";
  return "bg-elevated text-slate-300";
}

export default function InfoPanel({
  connected,
  initialSymbol,
}: {
  connected: boolean;
  initialSymbol?: string;
}) {
  const [coins, setCoins] = useState<Coin[]>([]);
  const [symbol, setSymbol] = useState(initialSymbol || "BTC");
  const [fng, setFng] = useState<FearGreedPoint | null>(null);
  const [funding, setFunding] = useState<FundingPoint | null>(null);
  const [oi, setOi] = useState<OiPoint | null>(null);
  const [lsr, setLsr] = useState<LsrPoint | null>(null);
  const [sentiment, setSentiment] = useState<SentimentAgg | null>(null);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (connected) listCoins().then(setCoins).catch(() => setCoins([]));
  }, [connected]);

  useEffect(() => {
    if (initialSymbol) setSymbol(initialSymbol);
  }, [initialSymbol]);

  const load = useCallback(() => {
    if (!connected) return;
    setLoading(true);
    // Each call is best-effort — a missing signal shouldn't blank the whole panel.
    getFearGreed(1).then((r) => setFng(r[0] ?? null)).catch(() => setFng(null));
    getFunding(symbol, 1).then((r) => setFunding(r[0] ?? null)).catch(() => setFunding(null));
    getOpenInterest(symbol, "1h", 1).then((r) => setOi(r[0] ?? null)).catch(() => setOi(null));
    getLongShort(symbol, "1h", 1).then((r) => setLsr(r[0] ?? null)).catch(() => setLsr(null));
    getSentiment(symbol).then(setSentiment).catch(() => setSentiment(null));
    getNews(symbol)
      .then((n) => setNews(n))
      .catch(() => setNews([]))
      .finally(() => setLoading(false));
  }, [connected, symbol]);

  useEffect(() => {
    load();
  }, [load]);

  if (!connected) {
    return <p className="text-sm text-warning">Connect (above) to view market info.</p>;
  }

  const fundingPct = funding ? toNum(funding.fundingRate) * 100 : null;
  const lsrVal = lsr ? toNum(lsr.longShortRatio) : null;

  return (
    <div className="space-y-5">
      {/* selector */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface p-4">
        <label className="text-sm text-slate-400">Symbol</label>
        <select
          className="rounded-md border border-border bg-background px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
        >
          {coins.length === 0 && <option value={symbol}>{symbol}</option>}
          {coins.map((c) => (
            <option key={c.id} value={c.symbol}>
              {c.symbol} — {c.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={load}
          className="rounded-md border border-border px-3 py-2 text-sm text-slate-300 hover:bg-elevated"
        >
          Refresh
        </button>
        {loading && <span className="text-xs text-slate-500">loading…</span>}
      </div>

      {/* context cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card
          label="Fear & Greed"
          hint={fng ? `${fng.classification} · ${dateLabel(fng.timestamp)}` : "market-wide"}
        >
          <span className={fng ? fgColor(fng.value) : "text-slate-500"}>{fng ? fng.value : "—"}</span>
        </Card>
        <Card label="Funding rate" hint={funding ? dateLabel(funding.fundingTime) : "crypto perps only"}>
          <span className={fundingPct != null ? signColor(fundingPct) : "text-slate-500"}>
            {fundingPct != null ? pct(fundingPct, 4) : "—"}
          </span>
        </Card>
        <Card label="Open interest" hint={oi ? dateLabel(oi.timestamp) : "crypto perps only"}>
          {oi ? num(oi.openInterest, 0) : "—"}
        </Card>
        <Card label="Long/Short ratio" hint={lsrVal != null ? (lsrVal > 1 ? "more longs" : "more shorts") : "crypto perps only"}>
          <span className={lsrVal != null ? (lsrVal >= 1 ? "text-success" : "text-error") : "text-slate-500"}>
            {lsrVal != null ? num(lsrVal, 2) : "—"}
          </span>
        </Card>
      </div>

      {/* news-derived sentiment */}
      {sentiment && (
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-medium text-white">News sentiment · {symbol}</h3>
            <span className="text-xs text-slate-500">confidence {num(sentiment.confidence, 0)}%</span>
          </div>
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-elevated">
            <div className="bg-success" style={{ width: `${sentiment.bullish}%` }} title={`bullish ${num(sentiment.bullish, 0)}%`} />
            <div className="bg-slate-500" style={{ width: `${sentiment.neutral}%` }} title={`neutral ${num(sentiment.neutral, 0)}%`} />
            <div className="bg-error" style={{ width: `${sentiment.bearish}%` }} title={`bearish ${num(sentiment.bearish, 0)}%`} />
          </div>
          <div className="mt-2 flex gap-4 text-xs">
            <span className="text-success">Bullish {num(sentiment.bullish, 0)}%</span>
            <span className="text-slate-400">Neutral {num(sentiment.neutral, 0)}%</span>
            <span className="text-error">Bearish {num(sentiment.bearish, 0)}%</span>
          </div>
        </div>
      )}

      {/* news feed */}
      <div className="rounded-xl border border-border bg-surface p-4">
        <h3 className="mb-3 font-medium text-white">Latest news{news.length ? "" : ""}</h3>
        {news.length === 0 ? (
          <p className="text-sm text-slate-400">No news for {symbol} yet (the collector fills this over time).</p>
        ) : (
          <ul className="max-h-[420px] space-y-2 overflow-auto">
            {news.map((n) => (
              <li key={n.id} className="rounded-md border border-border/60 p-3">
                <div className="flex items-start justify-between gap-3">
                  <a href={n.url} target="_blank" rel="noreferrer" className="text-sm text-slate-100 hover:text-primary">
                    {n.title}
                  </a>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${sentimentBadge(n.sentiment)}`}>
                    {n.sentiment === "POSITIVE" ? "bull" : n.sentiment === "NEGATIVE" ? "bear" : "neutral"}
                  </span>
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {n.source ? `${n.source} · ` : ""}
                  {dateLabel(n.publishedAt)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-xs text-slate-500">
        Funding, open interest, and long/short are crypto-perpetuals context (blank for stocks).
        Fear &amp; Greed is market-wide. News + sentiment come from the news service.
      </p>
    </div>
  );
}
