"use client";

/**
 * Price alerts UI (presentational). The parent (ChartsPanel) owns the alert list
 * and the create/delete/reset handlers; this just renders the form + list.
 * Alerts are evaluated server-side, so they trigger even if this page is closed.
 */

import { useState } from "react";
import type { PriceAlert } from "@/lib/types";
import { num, dateLabel } from "@/lib/format";

const inputCls =
  "rounded-md border border-border bg-background px-2 py-1.5 text-sm text-white focus:border-primary focus:outline-none";

export default function AlertsPanel({
  symbol,
  suggestedPrice,
  alerts,
  onAdd,
  onDelete,
  onReset,
}: {
  symbol: string;
  suggestedPrice: number;
  alerts: PriceAlert[];
  onAdd: (condition: "above" | "below", price: number, note: string) => void;
  onDelete: (id: string) => void;
  onReset: (id: string) => void;
}) {
  const [condition, setCondition] = useState<"above" | "below">("above");
  const [price, setPrice] = useState<number>(0);
  const [note, setNote] = useState("");

  const triggered = alerts.filter((a) => a.status === "TRIGGERED");

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-medium text-white">Price alerts</h3>
        {triggered.length > 0 && (
          <span className="rounded-full bg-error/20 px-2 py-0.5 text-xs font-medium text-error">
            {triggered.length} triggered
          </span>
        )}
      </div>

      {/* create */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-sm text-slate-400">Alert me when</span>
        <span className="font-medium text-white">{symbol}</span>
        <select
          className={inputCls}
          value={condition}
          onChange={(e) => setCondition(e.target.value as "above" | "below")}
        >
          <option value="above">rises above</option>
          <option value="below">falls below</option>
        </select>
        <input
          type="number"
          className={`${inputCls} w-32`}
          value={price || suggestedPrice || 0}
          onChange={(e) => setPrice(Number(e.target.value))}
          placeholder="price"
        />
        <input
          className={`${inputCls} w-40`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="note (optional)"
        />
        <button
          type="button"
          onClick={() => {
            const p = price || suggestedPrice;
            if (p > 0) onAdd(condition, p, note);
            setNote("");
            setPrice(0);
          }}
          className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-white"
        >
          Add alert
        </button>
      </div>

      {/* list */}
      {alerts.length === 0 ? (
        <p className="text-sm text-slate-400">No alerts yet.</p>
      ) : (
        <div className="max-h-64 overflow-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-400">
              <tr>
                <th className="py-1">Symbol</th>
                <th className="py-1">Condition</th>
                <th className="py-1 text-right">Price</th>
                <th className="py-1">Status</th>
                <th className="py-1"></th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((a) => (
                <tr key={a.id} className="border-t border-border/60">
                  <td className="py-1.5 text-slate-200">{a.symbol}</td>
                  <td className="py-1.5 text-slate-300">
                    {a.condition === "above" ? "≥" : "≤"} {num(a.price, 4)}
                  </td>
                  <td className="py-1.5 text-right text-slate-300">{num(a.price, 4)}</td>
                  <td className="py-1.5">
                    {a.status === "TRIGGERED" ? (
                      <span className="text-error" title={a.triggeredAt ? dateLabel(a.triggeredAt) : ""}>
                        triggered
                      </span>
                    ) : (
                      <span className="text-success">active</span>
                    )}
                  </td>
                  <td className="py-1.5 text-right">
                    <div className="flex justify-end gap-2">
                      {a.status === "TRIGGERED" && (
                        <button type="button" onClick={() => onReset(a.id)} className="text-xs text-secondary hover:underline">
                          re-arm
                        </button>
                      )}
                      <button type="button" onClick={() => onDelete(a.id)} className="text-xs text-error hover:underline">
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
      <p className="mt-3 text-xs text-slate-500">
        Alerts are checked on the server every minute, so they trigger even when this page is closed.
      </p>
    </div>
  );
}
