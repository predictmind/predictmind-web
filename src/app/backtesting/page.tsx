"use client";

/**
 * The Testing hub: one place to test strategies two ways —
 *  - BACKTEST: replay a strategy over historical data and see profit/win-rate.
 *  - PAPER / LIVE: forward-test on the live market with virtual money.
 * A connection bar at the top handles the API URL + sign-in (token).
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import BacktestPanel from "@/components/BacktestPanel";
import ChartsPanel from "@/components/ChartsPanel";
import ConnectionBar from "@/components/ConnectionBar";
import PaperPanel from "@/components/PaperPanel";
import { hasToken } from "@/lib/api";

type Tab = "charts" | "backtest" | "paper";

export default function TestingPage() {
  const [tab, setTab] = useState<Tab>("charts");
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    setConnected(hasToken());
  }, []);

  const tabBtn = (t: Tab) =>
    `rounded-lg px-4 py-2 text-sm font-medium transition ${
      tab === t ? "bg-primary text-white" : "text-slate-300 hover:bg-elevated"
    }`;

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-6">
        <Link href="/" className="text-sm text-slate-400 hover:text-slate-200">
          ← PredictMind
        </Link>
        <h1 className="mt-2 text-3xl font-bold text-white">Strategy Testing</h1>
        <p className="mt-1 text-slate-400">
          Test our strategies — or your own — on historical data, then forward-test them live with
          virtual money.
        </p>
      </header>

      <div className="mb-6">
        <ConnectionBar onChange={() => setConnected(hasToken())} />
      </div>

      <div className="mb-6 inline-flex gap-2 rounded-xl border border-border bg-surface p-1">
        <button type="button" className={tabBtn("charts")} onClick={() => setTab("charts")}>
          Charts
        </button>
        <button type="button" className={tabBtn("backtest")} onClick={() => setTab("backtest")}>
          Backtest (history)
        </button>
        <button type="button" className={tabBtn("paper")} onClick={() => setTab("paper")}>
          Paper / Live
        </button>
      </div>

      {tab === "charts" && <ChartsPanel connected={connected} />}
      {tab === "backtest" && <BacktestPanel connected={connected} />}
      {tab === "paper" && <PaperPanel connected={connected} />}
    </main>
  );
}
