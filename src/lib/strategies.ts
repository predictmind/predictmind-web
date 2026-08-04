/**
 * The catalogue of strategies a user can pick in the Testing hub:
 *  - PRESET: our finalised PredictMind strategies (DAILY, SWING) as ready rule specs.
 *  - PREBUILT: the engine's classic strategies with a few numeric params.
 *  - CUSTOM: the user builds their own entry/exit rule in the rule builder.
 *
 * Each definition knows how to turn the chosen params into the `strategy` /
 * `params` / `rules` / `risk` fields of a backtest request.
 */

import type { RiskOptions, RuleSpec } from "./types";

export type StrategyKind = "preset" | "prebuilt" | "custom";

export interface ParamField {
  key: string;
  label: string;
  default: number;
  min?: number;
  max?: number;
  step?: number;
}

export interface StrategyBuild {
  strategy: string; // engine strategy name ("rule", "sma_crossover", ...)
  params?: Record<string, number>;
  rules?: RuleSpec;
  risk?: RiskOptions;
}

export interface StrategyDef {
  id: string;
  label: string;
  kind: StrategyKind;
  description: string;
  /** Suggested timeframe (the UI pre-selects it, user can still change). */
  timeframeHint?: string;
  /** Suggested history length in candles. */
  limitHint?: number;
  /** Editable numeric params (prebuilt strategies only). */
  paramFields?: ParamField[];
  /** Build the request fields from the chosen params. */
  build: (params: Record<string, number>) => StrategyBuild;
}

/** Our finalised DAILY strategy (SOL 15m dip-buy in an uptrend). */
const DAILY_RULES: RuleSpec = {
  entry: {
    mode: "all",
    conditions: [
      { type: "ma", kind: "ema", fast: 50, slow: 200, op: "gt" },
      { type: "indicator", name: "rsi", period: 14, op: "lt", value: 50 },
      { type: "ma", kind: "sma", fast: 1, slow: 672, op: "gt" },
    ],
  },
  exit: {
    mode: "any",
    conditions: [{ type: "indicator", name: "rsi", period: 14, op: "gt", value: 65 }],
  },
};

/** Our finalised SWING strategy (100-day breakout + BTC regime + 25% trail). */
const SWING_RULES: RuleSpec = {
  entry: {
    mode: "all",
    conditions: [
      { type: "breakout", period: 100, dir: "up" },
      { type: "btc_trend", period: 100, dir: "above" },
    ],
  },
  exit: {
    mode: "any",
    conditions: [{ type: "breakout", period: 50, dir: "down" }],
  },
};

export const STRATEGIES: StrategyDef[] = [
  {
    id: "preset_daily",
    label: "PredictMind DAILY (short-term)",
    kind: "preset",
    description:
      "Buys small dips inside an uptrend on the 15-minute chart and takes quick profits. Best on SOL, and only in calm/rising markets.",
    timeframeHint: "15m",
    limitHint: 5000,
    build: () => ({
      strategy: "rule",
      rules: DAILY_RULES,
      risk: { stopLossPct: 0.02, trailingStopPct: 0.03 },
    }),
  },
  {
    id: "preset_swing",
    label: "PredictMind SWING (big runs)",
    kind: "preset",
    description:
      "Buys a fresh 100-day high while Bitcoin is healthy and rides it with a 25% trailing stop for weeks/months. Works on 8 coins (SOL, NEAR, ADA, AVAX, ICP, BTC, BNB, XLM).",
    timeframeHint: "1d",
    limitHint: 2000,
    build: () => ({
      strategy: "rule",
      rules: SWING_RULES,
      risk: { trailingStopPct: 0.25 },
    }),
  },
  {
    id: "buy_and_hold",
    label: "Buy & Hold (baseline)",
    kind: "prebuilt",
    description: "Buy on day one and hold to the end — the benchmark every strategy must beat.",
    timeframeHint: "1d",
    limitHint: 1000,
    build: () => ({ strategy: "buy_and_hold" }),
  },
  {
    id: "sma_crossover",
    label: "SMA Crossover (trend)",
    kind: "prebuilt",
    description: "Go long when a fast simple moving average crosses above a slow one.",
    timeframeHint: "1d",
    limitHint: 1000,
    paramFields: [
      { key: "fast", label: "Fast SMA", default: 20, min: 2, max: 200 },
      { key: "slow", label: "Slow SMA", default: 50, min: 5, max: 400 },
    ],
    build: (p) => ({ strategy: "sma_crossover", params: { fast: p.fast, slow: p.slow } }),
  },
  {
    id: "ema_crossover",
    label: "EMA Crossover (trend)",
    kind: "prebuilt",
    description: "Like SMA crossover but with exponential moving averages (react faster).",
    timeframeHint: "1d",
    limitHint: 1000,
    paramFields: [
      { key: "fast", label: "Fast EMA", default: 12, min: 2, max: 200 },
      { key: "slow", label: "Slow EMA", default: 26, min: 5, max: 400 },
    ],
    build: (p) => ({ strategy: "ema_crossover", params: { fast: p.fast, slow: p.slow } }),
  },
  {
    id: "rsi_reversion",
    label: "RSI Reversion (mean-reversion)",
    kind: "prebuilt",
    description: "Buy when RSI is oversold (low) and sell when it is overbought (high).",
    timeframeHint: "1d",
    limitHint: 1000,
    paramFields: [
      { key: "period", label: "RSI period", default: 14, min: 2, max: 50 },
      { key: "low", label: "Oversold (buy) <", default: 30, min: 5, max: 50 },
      { key: "high", label: "Overbought (sell) >", default: 70, min: 50, max: 95 },
    ],
    build: (p) => ({
      strategy: "rsi_reversion",
      params: { period: p.period, low: p.low, high: p.high },
    }),
  },
  {
    id: "custom",
    label: "Custom rule (build your own)",
    kind: "custom",
    description:
      "Define your own entry and exit conditions from indicators (RSI, moving averages, MACD, Bollinger, breakout, ADX, and more).",
    timeframeHint: "1d",
    limitHint: 1000,
    build: () => ({ strategy: "rule" }), // rules are supplied by the rule builder
  },
];

export const TIMEFRAMES = ["15m", "1h", "4h", "1d", "1w"] as const;

/** History presets: label -> number of candles, per timeframe family. */
export interface HistoryPreset {
  label: string;
  candles: number;
}

/** Rough candle counts for "how much history" by timeframe. */
export function historyPresets(timeframe: string): HistoryPreset[] {
  const perDay: Record<string, number> = {
    "15m": 96,
    "1h": 24,
    "4h": 6,
    "1d": 1,
    "1w": 1 / 7,
  };
  const cpd = perDay[timeframe] ?? 1;
  const clamp = (n: number) => Math.max(50, Math.min(15000, Math.round(n)));
  if (timeframe === "1d" || timeframe === "1w") {
    return [
      { label: "1 year", candles: clamp(365 * cpd) },
      { label: "2 years", candles: clamp(365 * 2 * cpd) },
      { label: "3 years", candles: clamp(365 * 3 * cpd) },
      { label: "Max (~5-6y)", candles: timeframe === "1d" ? 2000 : 400 },
    ];
  }
  return [
    { label: "1 month", candles: clamp(30 * cpd) },
    { label: "2 months", candles: clamp(60 * cpd) },
    { label: "3 months", candles: clamp(90 * cpd) },
    { label: "Max available", candles: 8000 },
  ];
}
