# 1. The Strategy Testing Hub

This is the big feature of the website: a page where **anyone can test a trading
strategy themselves** — no coding. You pick a coin, a timeframe, how much history,
and a strategy (one of ours, or your own), press **Run**, and see the results:
profit %, win rate, number of trades, and charts. Then you can switch to **Paper /
Live** mode and forward-test on the real live market with pretend money.

Think of it like a **flight simulator for trading**: try your idea safely on the
past and on the live market before risking real money.

## The two modes

```text
                 ┌─────────────────────────────────────────┐
                 │            Strategy Testing              │
                 │  ┌───────────────┐   ┌────────────────┐  │
                 │  │  Backtest      │   │  Paper / Live  │  │
                 │  │  (on history)  │   │  (live prices) │  │
                 │  └───────────────┘   └────────────────┘  │
                 └─────────────────────────────────────────┘
```

- **Backtest** = replay a strategy over *past* prices and measure how it would have
  done. Fast, and you see the whole outcome instantly.
- **Paper / Live** = trade the *live* market with fake money, in real time. Slow
  (real life speed), but it's the honest forward-test.

## How the website talks to the brain (the API)

The website itself has no trading logic — that lives in our back-end **services**
(separate programs). The website phones them through one front door called the
**API gateway**. The gateway checks you're allowed in (a login **token**) and then
forwards your request to the right service.

```text
 Browser (this website)  ──HTTP──▶  API gateway (:3001)  ──▶  market service (coins, prices)
                                                        ──▶  backtest service (run strategies)
                                                        ──▶  paper service (virtual trading)
```

Because every request needs a token, the page has a **Connection bar** at the top to
sign in first.

## The files, and what each one does

### `src/lib/` — the "plumbing" (no screen, just logic)

- **`types.ts`** — the *shapes* of data we send and receive (a Coin has a symbol and
  name; a backtest result has metrics; a trade has entry/exit, etc.). Writing these
  down lets TypeScript catch mistakes, like using a field that doesn't exist.
- **`format.ts`** — tiny helpers to show numbers nicely: `pct(0.5)` → `"+0.5%"`,
  `money(35660)` → `"35,660"`, and `signColor()` picks green for gains, red for
  losses. Databases send numbers as text ("12.34"), so `toNum()` safely turns them
  into real numbers.
- **`api.ts`** — the phone line to the gateway. It:
  - remembers the **API URL** and your **token** in the browser's `localStorage`
    (so a refresh doesn't log you out),
  - adds `Authorization: Bearer <token>` to every call,
  - has one function per thing we need: `listCoins()`, `getCandles()`,
    `runBacktest()`, `getBacktestTrades()`, plus the paper-trading calls
    (`createPaperAccount`, `getPaperPortfolio`, `placePaperOrder`, …).
  - **Why one file?** So every network call is in one place with the same error
    handling (e.g. a friendly "Not authorised — sign in" message on a 401).
- **`strategies.ts`** — the **menu of strategies** the user can choose:
  - **Presets** — our finished strategies, ready to run:
    - *PredictMind DAILY* (SOL 15-minute dip-buying),
    - *PredictMind SWING* (100-day breakout + Bitcoin-healthy + 25% trailing stop).
  - **Prebuilt** — classic textbook strategies with a couple of numbers you can tweak
    (Buy & Hold, SMA crossover, EMA crossover, RSI reversion).
  - **Custom** — you build your own rule (see the rule builder below).
  - Each menu item knows how to turn your choices into the exact request the backtest
    service expects (`strategy`, `params`, `rules`, `risk`). It also suggests a good
    timeframe and history length (e.g. SWING → 1-day, ~2000 candles).

### `src/components/` — the pieces of screen

- **`ConnectionBar.tsx`** — the sign-in strip. Set the API URL, then either **sign
  in** with email/password (it fetches a token) or **paste a token**. A green dot
  means "connected". Everything else is disabled until you're connected, because the
  API refuses un-authenticated calls.
- **`LineChart.tsx`** — a hand-made chart drawn with plain **SVG** (shapes in HTML).
  We deliberately did *not* add a chart library: it keeps the app light and avoids
  version clashes. It scales any list of numbers to fit, draws the line, and can
  place green **buy** / red **sell** dots. We use it twice: once for the price, once
  for the equity (money-over-time) curve.
- **`MetricCard.tsx`** — one little tile showing a labelled number (e.g. "Win rate —
  64.6%").
- **`TradesTable.tsx`** — the list of every trade the backtest made, with its result
  coloured green/red.
- **`RuleBuilder.tsx`** — the **build-your-own-strategy** tool. You add "conditions"
  for when to **buy** (entry) and when to **sell** (exit). Each condition is an
  indicator with a comparison, e.g. *RSI(14) < 30* or *EMA(20) > EMA(50)* or
  *price breaks a 100-day high*. You choose whether **ALL** conditions must be true
  or **ANY** of them. This produces the same "rule spec" our own strategies use — so
  a client can express essentially any rule-based idea.
- **`BacktestPanel.tsx`** — the whole Backtest tab. It:
  1. loads the coin list,
  2. shows the form (coin, timeframe, history, strategy + its settings),
  3. on **Run**, builds the request and calls `runBacktest()`, then also fetches the
     trade list and the price candles,
  4. shows the metric tiles, the price chart with buy/sell dots, the equity curve,
     and the trades table.
  - The equity curve is built by starting at 100 and multiplying by each trade's
    result — so you *see* how the account grew or shrank trade by trade.
- **`PaperPanel.tsx`** — the whole Paper/Live tab. Open a virtual account (fake
  starting cash), see a **live-priced** portfolio (equity, cash, profit), and place
  **BUY/SELL** orders (Market fills now; Limit/Stop wait). A "Live auto-refresh"
  checkbox re-checks the portfolio every 8 seconds so you watch it move in real time.

### `src/app/backtesting/page.tsx` — the page itself

This ties it together: the Connection bar on top, two tab buttons, and it shows the
Backtest panel or the Paper panel depending on the tab. In Next.js, a file at
`src/app/backtesting/page.tsx` automatically becomes the URL `/backtesting`. The
landing page (`src/app/page.tsx`) now has a button linking here.

## A couple of "why we did it this way" notes

- **Why keep the API URL and token in `localStorage`?** So you stay signed in across
  page refreshes, and so the same build can point at local dev *or* production just by
  changing the URL field — no rebuild needed.
- **Why a hand-drawn SVG chart instead of a chart library?** Fewer dependencies = a
  smaller, faster app and no risk of a library not supporting our React version. For
  a simple line + markers, SVG is plenty. (If we later need candlesticks and zoom,
  a library like `lightweight-charts` would be the upgrade.)
- **Why one `api.ts` with a token, instead of each component fetching directly?**
  One place to add the token, handle errors, and change the base URL. If auth
  changes, we edit one file.

## A real bug we hit (and the lesson)

When we first built the Paper panel, we named a helper `useAccount`. The build
**failed**: our linter's *rules-of-hooks* treats any function starting with `use…`
as a **React Hook**, and hooks can't be called inside event handlers. The fix was to
rename it `selectAccount`. **Lesson:** in React, don't start a normal function's name
with `use` unless it really is a hook.

## What's next (honest limits)

- Right now Paper mode is **manual** (you place the orders). Making a chosen strategy
  place orders **automatically** on live prices needs a small always-running back-end
  worker — a good next step.
- The charts are simple line charts. Full candlestick charts with zoom would need a
  charting library.

Next: the [glossary](02-glossary.md).
