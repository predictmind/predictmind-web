/**
 * Shared types for the PredictMind Testing hub (backtest + paper trading).
 * These mirror the shapes returned by the backend microservices (via the API
 * gateway). Numeric database fields (Prisma Decimal) arrive as strings, so a few
 * fields are typed `string | number` and normalised with `toNum()` in format.ts.
 */

/** A tradeable coin from the market service (`GET /api/v1/coins`). */
export interface Coin {
  id: string;
  symbol: string;
  name: string;
  status?: string;
}

/** One OHLCV candle (`GET /api/v1/market/candles`). Prices arrive as strings. */
export interface Candle {
  openTime: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
}

/** Performance metrics computed by the backtest engine. */
export interface Metrics {
  netProfitPct: number;
  buyHoldPct: number;
  winRate: number;
  profitFactor: number;
  maxDrawdownPct: number;
  sharpe: number;
  sortino: number;
  expectancyPct: number;
  avgTradePct: number;
  tradesCount: number;
  finalEquity: number;
}

/** The single 0-100 quality score the engine assigns a backtest. */
export interface PredictScore {
  score: number;
  grade: string;
  confidence: number;
  factors: Record<string, number>;
}

/** Full response of `POST /api/v1/backtests`. */
export interface BacktestResult {
  id: string;
  symbol: string;
  timeframe: string;
  strategy: string;
  params: Record<string, unknown>;
  candleCount: number;
  metrics: Metrics;
  predictScore: PredictScore;
}

/** One completed trade from `GET /api/v1/backtests/:id/trades`. */
export interface Trade {
  entryTime: string;
  entryPrice: string | number;
  exitTime: string;
  exitPrice: string | number;
  pnlPct: string | number;
  bars: number;
}

// ---- Custom rule strategy (subset of the engine's Condition union) ----

export type Comparator = "lt" | "lte" | "gt" | "gte";

/** A single entry/exit condition a user can add in the custom-rule builder. */
export type Condition =
  | { type: "indicator"; name: "rsi" | "stoch_k"; period?: number; op: Comparator; value: number }
  | { type: "ma"; kind: "sma" | "ema"; fast: number; slow: number; op: "gt" | "lt" }
  | { type: "macd"; fast?: number; slow?: number; signal?: number; op: "gt" | "lt" }
  | { type: "bollinger"; period?: number; mult?: number; side: "below_lower" | "above_upper" }
  | { type: "keltner"; period?: number; mult?: number; side: "below_lower" | "above_upper" }
  | { type: "vwap"; period?: number; op: "gt" | "lt" }
  | { type: "breakout"; period?: number; dir: "up" | "down" }
  | { type: "roc"; period?: number; op: Comparator; value: number }
  | { type: "supertrend"; period?: number; mult?: number; dir: "up" | "down" }
  | { type: "adx"; period?: number; op: Comparator; value: number }
  | { type: "btc_trend"; period?: number; dir: "above" | "below" };

export interface ConditionGroup {
  mode: "all" | "any";
  conditions: Condition[];
}

export interface RuleSpec {
  entry: ConditionGroup;
  exit: ConditionGroup;
}

/** Risk controls passed to the engine with a backtest. */
export interface RiskOptions {
  stopLossPct?: number;
  takeProfitRR?: number;
  trailingStopPct?: number;
  maxHoldBars?: number;
}

/** Request body for `POST /api/v1/backtests`. */
export interface RunBacktestRequest {
  symbol: string;
  timeframe: string;
  strategy: string;
  params?: Record<string, number>;
  rules?: RuleSpec;
  risk?: RiskOptions;
  limit?: number;
}

// ---- Paper trading (paper service) ----

export type OrderSide = "BUY" | "SELL";
export type OrderType = "MARKET" | "LIMIT" | "STOP";

export interface PaperAccount {
  id: string;
  cashBalance?: string | number;
  startingBalance?: string | number;
  createdAt?: string;
}

/** Live-priced portfolio snapshot (`GET /paper/accounts/:id/portfolio`). */
export interface PaperPortfolio {
  accountId?: string;
  cash?: string | number;
  equity?: string | number;
  startingBalance?: string | number;
  pnl?: string | number;
  pnlPct?: string | number;
  positions?: PaperPosition[];
}

export interface PaperPosition {
  symbol: string;
  quantity: string | number;
  avgPrice?: string | number;
  price?: string | number;
  value?: string | number;
  pnl?: string | number;
  pnlPct?: string | number;
}

export interface PaperOrder {
  id: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: string | number;
  limitPrice?: string | number | null;
  stopPrice?: string | number | null;
  status: string;
  createdAt?: string;
}

export interface PaperTrade {
  id: string;
  symbol: string;
  side: OrderSide;
  quantity: string | number;
  price: string | number;
  createdAt?: string;
}

/** An automated strategy bot (paper service `paper_strategy_bots`). */
export interface StrategyBot {
  id: string;
  accountId: string;
  name: string;
  symbol: string;
  timeframe: string;
  strategyName: string;
  allocationPct: string | number;
  enabled: boolean;
  lastSignal?: string | null;
  lastAction?: string | null;
  lastError?: string | null;
  lastRunAt?: string | null;
  createdAt?: string;
}

/** Request body for creating a bot. */
export interface CreateBotRequest {
  accountId: string;
  name: string;
  symbol: string;
  timeframe: string;
  strategyName: string;
  params?: Record<string, number>;
  rules?: RuleSpec;
  allocationPct?: number;
}
