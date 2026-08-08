/**
 * Thin API client for the PredictMind gateway (`/api/v1/*`).
 *
 * - Base URL comes from a runtime override in localStorage, else the
 *   `NEXT_PUBLIC_API_URL` build env, else the local gateway on :3001.
 * - Every protected call sends `Authorization: Bearer <token>` where the token
 *   is obtained via `login()` (or pasted by the user) and kept in localStorage.
 *
 * All functions are browser-only (they read localStorage); the Testing page is a
 * client component, so that is fine.
 */

import type {
  BacktestResult,
  Candle,
  Coin,
  CreateAlertRequest,
  CreateBotRequest,
  PaperAccount,
  PaperOrder,
  PaperPortfolio,
  PaperTrade,
  PriceAlert,
  RunBacktestRequest,
  ScreenerRow,
  StrategyBot,
  Trade,
} from "./types";

const BASE_KEY = "pm.apiBaseUrl";
const TOKEN_KEY = "pm.accessToken";

const DEFAULT_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:3001";

function ls(): Storage | null {
  return typeof window !== "undefined" ? window.localStorage : null;
}

export function getBaseUrl(): string {
  return ls()?.getItem(BASE_KEY)?.replace(/\/$/, "") || DEFAULT_BASE;
}

export function setBaseUrl(url: string): void {
  ls()?.setItem(BASE_KEY, url.replace(/\/$/, ""));
}

export function getToken(): string {
  return ls()?.getItem(TOKEN_KEY) ?? "";
}

export function setToken(token: string): void {
  if (token) ls()?.setItem(TOKEN_KEY, token);
  else ls()?.removeItem(TOKEN_KEY);
}

export function hasToken(): boolean {
  return getToken().length > 0;
}

/** Core request helper: prefixes the base URL, attaches auth, parses JSON, and
 *  surfaces a readable error message on failure. */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${getBaseUrl()}${path}`, { ...init, headers });
  } catch {
    throw new Error(
      "Cannot reach the API. Check the API URL and that the gateway/services are running.",
    );
  }

  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const body = (await res.json()) as { message?: string; error?: { message?: string } };
      detail = body?.error?.message || body?.message || detail;
    } catch {
      /* keep status-line detail */
    }
    if (res.status === 401) {
      throw new Error("Not authorised (401). Sign in or paste a valid access token.");
    }
    throw new Error(detail);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Extract an access token from the various shapes an auth service may return. */
function extractToken(body: unknown): string {
  const b = body as Record<string, unknown> | null;
  const data = (b?.data ?? b) as Record<string, unknown> | undefined;
  const tokens = (data?.tokens ?? data) as Record<string, unknown> | undefined;
  const token = tokens?.accessToken ?? tokens?.access_token ?? tokens?.token;
  return typeof token === "string" ? token : "";
}

/** Log in against the auth service and store the access token. */
export async function login(email: string, password: string): Promise<void> {
  const body = await request<unknown>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  const token = extractToken(body);
  if (!token) throw new Error("Login succeeded but no access token was returned.");
  setToken(token);
}

// ---- Market ----

export function listCoins(): Promise<Coin[]> {
  return request<Coin[]>("/api/v1/coins");
}

export function getCandles(symbol: string, timeframe: string, limit: number): Promise<Candle[]> {
  const q = new URLSearchParams({ symbol, timeframe, limit: String(limit) });
  return request<Candle[]>(`/api/v1/market/candles?${q.toString()}`);
}

export function getScreener(assetClass: string | undefined, timeframe: string): Promise<ScreenerRow[]> {
  const q = new URLSearchParams({ timeframe });
  if (assetClass) q.set("assetClass", assetClass);
  return request<ScreenerRow[]>(`/api/v1/market/screener?${q.toString()}`);
}

// ---- Backtest ----

export function runBacktest(body: RunBacktestRequest): Promise<BacktestResult> {
  return request<BacktestResult>("/api/v1/backtests", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function getBacktestTrades(id: string): Promise<Trade[]> {
  return request<Trade[]>(`/api/v1/backtests/${id}/trades`);
}

// ---- Paper trading ----

export function createPaperAccount(startingBalance: number): Promise<PaperAccount> {
  return request<PaperAccount>("/api/v1/paper/accounts", {
    method: "POST",
    body: JSON.stringify({ startingBalance }),
  });
}

export function getPaperPortfolio(accountId: string): Promise<PaperPortfolio> {
  return request<PaperPortfolio>(`/api/v1/paper/accounts/${accountId}/portfolio`);
}

export interface PlaceOrderBody {
  symbol: string;
  side: "BUY" | "SELL";
  type: "MARKET" | "LIMIT" | "STOP";
  quantity: number;
  limitPrice?: number;
  stopPrice?: number;
}

export function placePaperOrder(accountId: string, body: PlaceOrderBody): Promise<PaperOrder> {
  return request<PaperOrder>(`/api/v1/paper/accounts/${accountId}/orders`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function listPaperOrders(accountId: string): Promise<PaperOrder[]> {
  return request<PaperOrder[]>(`/api/v1/paper/accounts/${accountId}/orders`);
}

export function listPaperTrades(accountId: string): Promise<PaperTrade[]> {
  return request<PaperTrade[]>(`/api/v1/paper/accounts/${accountId}/trades`);
}

export function cancelPaperOrder(orderId: string): Promise<PaperOrder> {
  return request<PaperOrder>(`/api/v1/paper/orders/${orderId}/cancel`, { method: "POST" });
}

// ---- Strategy bots (automated live trading) ----

export function createBot(body: CreateBotRequest): Promise<StrategyBot> {
  return request<StrategyBot>("/api/v1/paper/bots", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function listBots(accountId: string): Promise<StrategyBot[]> {
  const q = new URLSearchParams({ accountId });
  return request<StrategyBot[]>(`/api/v1/paper/bots?${q.toString()}`);
}

export function setBotEnabled(id: string, enabled: boolean): Promise<StrategyBot> {
  return request<StrategyBot>(`/api/v1/paper/bots/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ enabled }),
  });
}

export function deleteBot(id: string): Promise<{ deleted: boolean }> {
  return request<{ deleted: boolean }>(`/api/v1/paper/bots/${id}`, { method: "DELETE" });
}

export interface BotTickResult {
  botId: string;
  symbol: string;
  signal: string;
  action: string;
  price?: number;
  error?: string;
}

export function tickBot(id: string): Promise<BotTickResult> {
  return request<BotTickResult>(`/api/v1/paper/bots/${id}/tick`, { method: "POST" });
}

// ---- Price alerts ----

export function createAlert(body: CreateAlertRequest): Promise<PriceAlert> {
  return request<PriceAlert>("/api/v1/market/alerts", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function listAlerts(): Promise<PriceAlert[]> {
  return request<PriceAlert[]>("/api/v1/market/alerts");
}

export function deleteAlert(id: string): Promise<{ deleted: boolean }> {
  return request<{ deleted: boolean }>(`/api/v1/market/alerts/${id}`, { method: "DELETE" });
}

export function resetAlert(id: string): Promise<PriceAlert> {
  return request<PriceAlert>(`/api/v1/market/alerts/${id}/reset`, { method: "POST" });
}
