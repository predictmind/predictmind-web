/** A scrollable table of completed backtest trades. */

import type { Trade } from "@/lib/types";
import { dateLabel, num, pct, signColor, toNum } from "@/lib/format";

export default function TradesTable({ trades }: { trades: Trade[] }) {
  if (!trades.length) {
    return <p className="text-sm text-slate-400">This strategy took no trades on the chosen data.</p>;
  }

  return (
    <div className="max-h-96 overflow-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-elevated text-left text-slate-300">
          <tr>
            <th className="px-3 py-2 font-medium">#</th>
            <th className="px-3 py-2 font-medium">Entry</th>
            <th className="px-3 py-2 font-medium">Exit</th>
            <th className="px-3 py-2 font-medium text-right">Entry price</th>
            <th className="px-3 py-2 font-medium text-right">Exit price</th>
            <th className="px-3 py-2 font-medium text-right">Bars</th>
            <th className="px-3 py-2 font-medium text-right">Result</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((t, i) => (
            <tr key={i} className="border-t border-border/60">
              <td className="px-3 py-2 text-slate-400">{i + 1}</td>
              <td className="px-3 py-2 text-slate-300">{dateLabel(t.entryTime)}</td>
              <td className="px-3 py-2 text-slate-300">{dateLabel(t.exitTime)}</td>
              <td className="px-3 py-2 text-right text-slate-300">{num(t.entryPrice, 4)}</td>
              <td className="px-3 py-2 text-right text-slate-300">{num(t.exitPrice, 4)}</td>
              <td className="px-3 py-2 text-right text-slate-400">{t.bars}</td>
              <td className={`px-3 py-2 text-right font-medium ${signColor(toNum(t.pnlPct))}`}>
                {pct(t.pnlPct, 2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
