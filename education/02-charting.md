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

- a **watchlist** on the left (searchable, with an **All / Crypto / Stocks** filter —
  because the platform now serves stocks too, priced via Yahoo Finance),
- a **timeframe switcher** (15m / 1h / 4h / 1d / 1w) and a **history** selector,
- **indicator toggle chips** (SMA20/50/200, EMA20, Bollinger, VWAP, Volume, RSI),
- an **OHLC + % change readout** that follows your crosshair,
- a **Price alerts** panel (`AlertsPanel.tsx`): set "tell me when SYMBOL goes
  above/below PRICE"; active alerts are drawn on the chart as dashed lines, and
  because they're checked **server-side every minute**, they trigger even if the
  page is closed. The chart draws these levels via `createPriceLine`.

One important detail: the market service returns candles **newest-first**, but
`lightweight-charts` requires them **oldest-first and unique**. So `toBars()` sorts
ascending and drops any duplicate timestamps before handing them to the chart —
otherwise the library throws.

## Drawing tools (added later)

Traders mark up charts with **support/resistance lines** and **trendlines**. We added
a small drawing toolbar (Cursor / Horizontal / Trendline / Clear):

- **Horizontal line** — one click places a line at that price. This uses
  lightweight-charts' built-in `createPriceLine`, which always stays perfectly
  horizontal across the whole chart. Easy and exact.
- **Trendline** — two clicks draw a diagonal line between two points. lightweight-
  charts (v4) has **no built-in diagonal drawing**, so we draw it ourselves on a
  transparent **SVG layer on top of the chart**. The trick is coordinates: we store
  each end as a **(time, price)** pair (not pixels), then on every pan/zoom/resize we
  convert them back to pixels with `timeScale().timeToCoordinate(time)` and
  `series.priceToCoordinate(price)` and redraw the line. That way the trendline
  "sticks" to the same candles as you scroll — just like TradingView.
- **Pointer-events trick:** when a drawing tool is active the SVG captures clicks;
  in Cursor mode the SVG ignores clicks (`pointer-events: none`) so normal pan/zoom
  still works through it.
- **Persistence:** drawings are saved in the browser (`localStorage`) **per symbol +
  timeframe**, so your lines are still there when you come back. **Clear** removes
  them for the current chart.

Why store (time, price) instead of pixels? Pixels change the moment you zoom or the
window resizes; the (time, price) of a level never changes — so that's the honest
source of truth, and pixels are recomputed from it.

## Bar-replay practice mode (added later)

**Replay** lets you re-live the market bar by bar to practise reading setups without
seeing the future — like a flight simulator for chart-reading.

How it works (all in `ChartsPanel.tsx`, no backend needed):

- We keep a **`replayIdx`** = how many candles are revealed. The chart is fed
  `bars.slice(0, replayIdx)` instead of the full history.
- **Step +1 / −1** move the index; **Play/Pause** auto-advances it on a timer (with a
  0.5x–5x speed selector); **Exit** shows everything again.
- Because the chart only receives the revealed slice, the **indicators and overlays
  recompute on exactly what you can see** — no peeking ahead. RSI, SMAs, Bollinger,
  etc. are honest to the replay point.
- We **don't** re-fit the view on each step, so the chart stays put and the next
  candle simply appears at the right edge — exactly the feel you want.
- Loading new data (changing symbol/timeframe/history) automatically exits replay.

Why this is the right design: the *only* state we need is "how many bars are
revealed." Everything else (candles, indicators, drawings) already derives from the
bars we pass in, so slicing the bars is enough to turn the whole chart into a replay.

## The Screener tab (added later)

Next to Charts there's a **Screener** tab (`ScreenerPanel.tsx`). It calls the market
service's `/market/screener` once to get a snapshot of *every* symbol (price, change%,
RSI, vs SMA50/200, trend, distance from the 20-bar high, volume), then lets you:

- filter by **All / Crypto / Stocks** and pick a **timeframe**,
- apply **presets** (Oversold RSI&lt;30, Overbought, Uptrend, Downtrend, Near 20-bar
  high) — these are simple client-side filters over the fetched rows,
- **sort** any column by clicking its header,
- **click a row** to jump straight to that symbol on the Charts tab (the page lifts
  the chosen symbol up and switches tabs).

The heavy work (reading candles + computing indicators for all symbols) happens once
on the server; the filtering/sorting is instant in the browser.

## The Info tab (added later)

Traders want *context*, not just price. The **Info** tab (`InfoPanel.tsx`) gathers it
for a symbol in one place — and importantly, **it invents no new data**: every number
already exists in our services, so this is purely a view layer.

- **Fear & Greed** — the market-wide mood index (0 = extreme fear, 100 = extreme
  greed), from the market service's `/market/fng`.
- **Funding rate / Open interest / Long-Short ratio** — crypto perpetual-futures
  context (`/market/funding`, `/market/oi`, `/market/lsr`). These are blank for
  stocks (stocks have no perps), and the cards say so instead of showing a wrong 0.
- **News sentiment** — a bullish/neutral/bearish bar for the symbol from the news
  service (`/sentiment/:symbol`).
- **News feed** — recent headlines mentioning the symbol (`/news/:symbol`), each
  tagged bull/bear/neutral, linking to the source.

Two design choices worth noting:

- **Best-effort loading:** each card fetches independently, and a failure just shows
  "—" for that one card rather than blanking the whole panel. Context signals are
  "nice to have", so one missing feed shouldn't break the page.
- **Reuse, don't recompute:** we deliberately call the existing endpoints instead of
  re-deriving sentiment or funding in the browser — one source of truth, and the
  heavy lifting stays server-side.

## Multi-chart layouts (added later)

A **Layout** selector (Single / 2 / 4) sits above the chart. Pick 2 or 4 and the
single-chart view is replaced by a grid of compact charts (`MultiChart.tsx`), each an
independent **cell** with its own symbol + timeframe that fetches its own candles.
This lets you watch several markets at once, like a TradingView multi-chart layout.

Design notes:

- **Cells are lean on purpose** — candles + volume + SMA50/200, no drawings/alerts/
  replay. Those power tools live in the Single view; the grid is for *monitoring*.
- **Reuse:** each cell just renders the same `PriceChartPro`, so all the charting
  work (candles, overlays, cleanup, responsiveness) is shared — the cell only adds a
  symbol dropdown and timeframe buttons.
- **Saved layout template:** the chosen layout and each pane's symbol/timeframe are
  stored in `localStorage` (`pm.chartLayout`, `pm.chartPanes`), so your grid is
  exactly as you left it next time.
- Every `PriceChartPro` cleans up its chart on unmount, so switching between Single
  and multi layouts doesn't leak charts.

## Honest scope (Phase 1)

This is the first slice of a bigger "TradingView-parity" plan. It covers charting,
indicators, multi-timeframe, and a watchlist. Still to come: **drawing tools**
(trendlines), **price alerts**, a **screener**, **bar-replay** practice mode, and
richer **info panels** (funding, fear/greed, news). Some things TradingView offers —
tick-by-tick real-time feeds, second-level bars, their paid indicator marketplace —
depend on **paid data licenses** we don't have, so we build the equivalent value on
the crypto data we own rather than claiming a 1:1 clone.

Next: the [glossary](03-glossary.md).
