"use client";

/**
 * A visual builder for a custom entry/exit rule (a `RuleSpec`). The user adds
 * condition rows (RSI, moving-average cross, MACD, Bollinger, breakout, ADX,
 * Supertrend, BTC-trend); each row edits one `Condition` in the union. The whole
 * spec is lifted to the parent via `onChange`.
 */

import type { Condition, ConditionGroup, RuleSpec } from "@/lib/types";

type CondType = Condition["type"];

const TYPE_LABELS: { type: CondType; label: string }[] = [
  { type: "indicator", label: "RSI / Stochastic" },
  { type: "ma", label: "Moving-average cross" },
  { type: "macd", label: "MACD" },
  { type: "bollinger", label: "Bollinger band" },
  { type: "keltner", label: "Keltner channel" },
  { type: "vwap", label: "VWAP" },
  { type: "breakout", label: "Breakout (Donchian)" },
  { type: "roc", label: "Momentum (ROC)" },
  { type: "supertrend", label: "Supertrend" },
  { type: "adx", label: "ADX (trend strength)" },
  { type: "btc_trend", label: "Bitcoin trend (regime)" },
];

function defaultCondition(type: CondType): Condition {
  switch (type) {
    case "indicator":
      return { type: "indicator", name: "rsi", period: 14, op: "lt", value: 30 };
    case "ma":
      return { type: "ma", kind: "ema", fast: 20, slow: 50, op: "gt" };
    case "macd":
      return { type: "macd", op: "gt" };
    case "bollinger":
      return { type: "bollinger", period: 20, mult: 2, side: "below_lower" };
    case "keltner":
      return { type: "keltner", period: 20, mult: 2, side: "below_lower" };
    case "vwap":
      return { type: "vwap", period: 20, op: "gt" };
    case "breakout":
      return { type: "breakout", period: 20, dir: "up" };
    case "roc":
      return { type: "roc", period: 10, op: "gt", value: 3 };
    case "supertrend":
      return { type: "supertrend", period: 10, mult: 3, dir: "up" };
    case "adx":
      return { type: "adx", period: 14, op: "gt", value: 22 };
    case "btc_trend":
      return { type: "btc_trend", period: 100, dir: "above" };
  }
}

const inputCls =
  "rounded-md border border-border bg-background px-2 py-1 text-sm text-white focus:border-primary focus:outline-none";

function NumberField({
  value,
  onChange,
  width = "w-20",
}: {
  value: number | undefined;
  onChange: (n: number) => void;
  width?: string;
}) {
  return (
    <input
      type="number"
      className={`${inputCls} ${width}`}
      value={value ?? 0}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  );
}

function Select<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <select className={inputCls} value={value} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

const OP_OPTIONS = [
  { value: "lt" as const, label: "<" },
  { value: "lte" as const, label: "≤" },
  { value: "gt" as const, label: ">" },
  { value: "gte" as const, label: "≥" },
];

/** Render the editable fields for one condition. */
function ConditionFields({
  cond,
  onChange,
}: {
  cond: Condition;
  onChange: (c: Condition) => void;
}) {
  switch (cond.type) {
    case "indicator":
      return (
        <>
          <Select
            value={cond.name}
            options={[
              { value: "rsi", label: "RSI" },
              { value: "stoch_k", label: "Stochastic %K" },
            ]}
            onChange={(name) => onChange({ ...cond, name })}
          />
          <span className="text-slate-400">period</span>
          <NumberField value={cond.period} onChange={(period) => onChange({ ...cond, period })} />
          <Select value={cond.op} options={OP_OPTIONS} onChange={(op) => onChange({ ...cond, op })} />
          <NumberField value={cond.value} onChange={(value) => onChange({ ...cond, value })} />
        </>
      );
    case "ma":
      return (
        <>
          <Select
            value={cond.kind}
            options={[
              { value: "ema", label: "EMA" },
              { value: "sma", label: "SMA" },
            ]}
            onChange={(kind) => onChange({ ...cond, kind })}
          />
          <span className="text-slate-400">fast</span>
          <NumberField value={cond.fast} onChange={(fast) => onChange({ ...cond, fast })} />
          <span className="text-slate-400">slow</span>
          <NumberField value={cond.slow} onChange={(slow) => onChange({ ...cond, slow })} />
          <Select
            value={cond.op}
            options={[
              { value: "gt", label: "fast > slow (up)" },
              { value: "lt", label: "fast < slow (down)" },
            ]}
            onChange={(op) => onChange({ ...cond, op })}
          />
        </>
      );
    case "macd":
      return (
        <Select
          value={cond.op}
          options={[
            { value: "gt", label: "MACD > signal (bullish)" },
            { value: "lt", label: "MACD < signal (bearish)" },
          ]}
          onChange={(op) => onChange({ ...cond, op })}
        />
      );
    case "bollinger":
    case "keltner":
      return (
        <>
          <span className="text-slate-400">period</span>
          <NumberField value={cond.period} onChange={(period) => onChange({ ...cond, period })} />
          <span className="text-slate-400">mult</span>
          <NumberField value={cond.mult} onChange={(mult) => onChange({ ...cond, mult })} />
          <Select
            value={cond.side}
            options={[
              { value: "below_lower", label: "price below lower band" },
              { value: "above_upper", label: "price above upper band" },
            ]}
            onChange={(side) => onChange({ ...cond, side })}
          />
        </>
      );
    case "vwap":
      return (
        <>
          <span className="text-slate-400">period</span>
          <NumberField value={cond.period} onChange={(period) => onChange({ ...cond, period })} />
          <Select
            value={cond.op}
            options={[
              { value: "gt", label: "price above VWAP" },
              { value: "lt", label: "price below VWAP" },
            ]}
            onChange={(op) => onChange({ ...cond, op })}
          />
        </>
      );
    case "breakout":
      return (
        <>
          <span className="text-slate-400">period</span>
          <NumberField value={cond.period} onChange={(period) => onChange({ ...cond, period })} />
          <Select
            value={cond.dir}
            options={[
              { value: "up", label: "new high (breakout up)" },
              { value: "down", label: "new low (breakdown)" },
            ]}
            onChange={(dir) => onChange({ ...cond, dir })}
          />
        </>
      );
    case "roc":
      return (
        <>
          <span className="text-slate-400">period</span>
          <NumberField value={cond.period} onChange={(period) => onChange({ ...cond, period })} />
          <Select value={cond.op} options={OP_OPTIONS} onChange={(op) => onChange({ ...cond, op })} />
          <NumberField value={cond.value} onChange={(value) => onChange({ ...cond, value })} />
          <span className="text-slate-400">%</span>
        </>
      );
    case "supertrend":
      return (
        <>
          <span className="text-slate-400">period</span>
          <NumberField value={cond.period} onChange={(period) => onChange({ ...cond, period })} />
          <span className="text-slate-400">mult</span>
          <NumberField value={cond.mult} onChange={(mult) => onChange({ ...cond, mult })} />
          <Select
            value={cond.dir}
            options={[
              { value: "up", label: "uptrend" },
              { value: "down", label: "downtrend" },
            ]}
            onChange={(dir) => onChange({ ...cond, dir })}
          />
        </>
      );
    case "adx":
      return (
        <>
          <span className="text-slate-400">period</span>
          <NumberField value={cond.period} onChange={(period) => onChange({ ...cond, period })} />
          <Select value={cond.op} options={OP_OPTIONS} onChange={(op) => onChange({ ...cond, op })} />
          <NumberField value={cond.value} onChange={(value) => onChange({ ...cond, value })} />
        </>
      );
    case "btc_trend":
      return (
        <>
          <span className="text-slate-400">period</span>
          <NumberField value={cond.period} onChange={(period) => onChange({ ...cond, period })} />
          <Select
            value={cond.dir}
            options={[
              { value: "above", label: "BTC above its average (healthy)" },
              { value: "below", label: "BTC below its average (weak)" },
            ]}
            onChange={(dir) => onChange({ ...cond, dir })}
          />
        </>
      );
  }
}

function GroupEditor({
  title,
  group,
  onChange,
}: {
  title: string;
  group: ConditionGroup;
  onChange: (g: ConditionGroup) => void;
}) {
  const update = (i: number, c: Condition) => {
    const conditions = group.conditions.map((x, k) => (k === i ? c : x));
    onChange({ ...group, conditions });
  };
  const remove = (i: number) =>
    onChange({ ...group, conditions: group.conditions.filter((_, k) => k !== i) });
  const add = () =>
    onChange({ ...group, conditions: [...group.conditions, defaultCondition("indicator")] });

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="font-medium text-white">{title}</h4>
        <label className="flex items-center gap-2 text-xs text-slate-400">
          match
          <Select
            value={group.mode}
            options={[
              { value: "all", label: "ALL of" },
              { value: "any", label: "ANY of" },
            ]}
            onChange={(mode) => onChange({ ...group, mode })}
          />
        </label>
      </div>

      <div className="space-y-2">
        {group.conditions.map((cond, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2 rounded-md bg-background/60 p-2">
            <Select
              value={cond.type}
              options={TYPE_LABELS.map((t) => ({ value: t.type, label: t.label }))}
              onChange={(type) => update(i, defaultCondition(type))}
            />
            <ConditionFields cond={cond} onChange={(c) => update(i, c)} />
            <button
              type="button"
              onClick={() => remove(i)}
              className="ml-auto rounded-md px-2 py-1 text-xs text-error hover:bg-error/10"
            >
              Remove
            </button>
          </div>
        ))}
        {group.conditions.length === 0 && (
          <p className="text-sm text-slate-500">No conditions yet — add one below.</p>
        )}
      </div>

      <button
        type="button"
        onClick={add}
        className="mt-3 rounded-md border border-primary/50 px-3 py-1 text-sm text-primary hover:bg-primary/10"
      >
        + Add condition
      </button>
    </div>
  );
}

export default function RuleBuilder({
  spec,
  onChange,
}: {
  spec: RuleSpec;
  onChange: (s: RuleSpec) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <GroupEditor
        title="Entry (buy when…)"
        group={spec.entry}
        onChange={(entry) => onChange({ ...spec, entry })}
      />
      <GroupEditor
        title="Exit (sell when…)"
        group={spec.exit}
        onChange={(exit) => onChange({ ...spec, exit })}
      />
    </div>
  );
}
