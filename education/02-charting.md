# 2. Charts — A TradingView-Style Workspace

The **Charts** tab is where you *see* the market: a real candlestick chart with
volume, indicator overlays, an RSI pane, a coin watchlist, and a live price readout.
It's the foundation the rest of the platform builds on (drawing tools, alerts,
screeners come later).

## Why a charting library — and which one

Drawing smooth, zoomable candlesticks by hand (like our earlier simple SVG line) is a
huge amount of work. So we use **`lightweight-charts`** — a small, fast charting
library that is **made and open-sourced by TradingView themselves**. Two reasons it's
the right pick:

1. It gives us professional candles, volume, crosshair, zoom/pan for free.
2. It's **plain JavaScript** (no React dependency), so it works cleanly with our
   React 19 app — no version clashes.

> A "candlestick" shows four prices for a period: **open, high, low, close**. Green =
> price rose that period, red = it fell. The thin lines (wicks) show the high/low.

## How the chart is built (`PriceChartPro.tsx`)

`lightweight-charts` is not React — you create a chart into a plain `<div>` and talk
to it with method calls. We bridge the two worlds with React **refs** and
**effects**:

- **Create once (mount effect):** `createChart(div, options)`, then add a
  **candlestick series**, a **volume histogram** (pinned to the bottom 18% via a
  separate price scale), and a small **RSI chart** underneath. We also wire:
  - a **crosshair** subscription that reports the OHLC under the mouse (the readout
    at the top of the chart),
  - a **two-way time sync** so the RSI pane scrolls/zooms with the price chart
    (guarded by a flag so the two don't bounce updates back and forth forever),
  - a **ResizeObserver** so the chart follows the window width,
  - a **cleanup** that calls `chart.remove()` when the component unmounts (so we
    don't leak charts every time you navigate away).
- **Update on change (data effect):** whenever the candles, overlay toggles, volume,
  or markers change, we `setData(...)` on each series. For overlays we keep a small
  **map of line series** and add/remove them to match exactly which indicators are
  toggled on — so flipping "SMA50" on/off adds/removes just that one line without
  rebuilding the whole chart (which would lose your zoom).

## The indicators (`src/lib/indicators.ts`)

The overlay lines are computed **in the browser** so they appear instantly. We
re-implement the same formulas the backend uses: **SMA** (simple moving average),
**EMA** (exponential, reacts faster), **RSI** (0-100 momentum meter), **Bollinger
Bands** (SMA ± 2 standard deviations), and a rolling **VWAP** (volume-weighted price).
Each returns an array the same length as the candles, with `null` until there's
enough history — and we skip those nulls when drawing, so a line simply starts a
little later.

## The workspace (`ChartsPanel.tsx`)

This lays out the tools around the chart:

- a **watchlist** on the left (searchable list of coins; click to switch),
- a **timeframe switcher** (15m / 1h / 4h / 1d / 1w) and a **history** selector,
- **indicator toggle chips** (SMA20/50/200, EMA20, Bollinger, VWAP, Volume, RSI),
- an **OHLC + % change readout** that follows your crosshair.

One important detail: the market service returns candles **newest-first**, but
`lightweight-charts` requires them **oldest-first and unique**. So `toBars()` sorts
ascending and drops any duplicate timestamps before handing them to the chart —
otherwise the library throws.

## Honest scope (Phase 1)

This is the first slice of a bigger "TradingView-parity" plan. It covers charting,
indicators, multi-timeframe, and a watchlist. Still to come: **drawing tools**
(trendlines), **price alerts**, a **screener**, **bar-replay** practice mode, and
richer **info panels** (funding, fear/greed, news). Some things TradingView offers —
tick-by-tick real-time feeds, second-level bars, their paid indicator marketplace —
depend on **paid data licenses** we don't have, so we build the equivalent value on
the crypto data we own rather than claiming a 1:1 clone.

Next: the [glossary](03-glossary.md).
