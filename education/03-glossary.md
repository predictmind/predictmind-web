# 3. Glossary (the dictionary)

Words used in the web app's notes. Trading words (RSI, drawdown, profit factor,
etc.) are explained in more depth in the **backtest service** education folder; this
list focuses on the **website** words.

| Word | Simple meaning |
| --- | --- |
| **Next.js** | The framework that turns our React components into web pages and routes. |
| **React** | The library for building screens out of reusable components. |
| **Component** | A reusable piece of screen (a button, a form, a chart). |
| **Props** | The inputs you pass into a component (like function arguments). |
| **State** | Data that can change while you use the page (the coin you picked). |
| **Hook** | A special React function (name starts with `use…`) like `useState`/`useEffect`. |
| **useEffect** | Runs code *after* the screen renders (e.g. fetch data on load). |
| **useState** | Remembers a changing value and re-renders when it changes. |
| **useMemo** | Remembers a computed value so it isn't recalculated every render. |
| **App Router** | Next.js's system where a folder + `page.tsx` becomes a URL. |
| **Client component** | A component that runs in the browser (needs `"use client"`); required for interactivity. |
| **Tailwind CSS** | Styling by adding small class names (e.g. `text-white`, `rounded-lg`). |
| **TypeScript** | JavaScript with types, so mistakes are caught before running. |
| **Type** | The declared shape of a value (e.g. a Coin has `symbol` and `name`). |
| **API** | The way one program asks another for data or actions, over HTTP. |
| **API gateway** | The single front door that checks your token and routes calls to the right service. |
| **Endpoint** | One specific API address, e.g. `GET /api/v1/coins`. |
| **HTTP request** | A message to a server: GET (fetch) or POST (send/do). |
| **fetch** | The browser function that makes an HTTP request. |
| **JSON** | The text format APIs use to send data (`{ "symbol": "BTC" }`). |
| **Token (JWT)** | A signed pass proving you're logged in; sent as `Authorization: Bearer <token>`. |
| **Bearer** | The scheme name that comes before the token in the header. |
| **401 Unauthorized** | The server's "you're not allowed / not signed in" reply. |
| **localStorage** | A small browser store that survives refreshes (we keep the API URL + token there). |
| **SVG** | Scalable Vector Graphics — shapes drawn with maths; we use it for charts. |
| **Backtest** | Replaying a strategy over past prices to see how it would have done. |
| **Paper trading** | Trading with fake money at real live prices — a risk-free forward test. |
| **Timeframe** | How long each candle covers (15m, 1h, 4h, 1d, 1w). |
| **Candle** | One period's open/high/low/close price (and volume). |
| **Strategy preset** | One of our finished, ready-to-run strategies (DAILY, SWING). |
| **Rule spec** | The JSON describing a custom strategy's entry/exit conditions. |
| **Condition** | One buy/sell test, e.g. "RSI < 30" or "price breaks a 100-day high". |
| **Entry / Exit** | The rules for when to buy / when to sell. |
| **Equity curve** | Your account value plotted over time (we start it at 100). |
| **Order (Market/Limit/Stop)** | An instruction to trade now / at a set price / when a price is hit. |
| **Portfolio** | Your cash + positions, valued at current prices. |
| **Position** | A coin you currently hold in the account. |
| **Candlestick** | A bar showing a period's open/high/low/close; green = up, red = down. |
| **OHLC** | Open, High, Low, Close — the four prices of a candle. |
| **Volume** | How much traded in a period; shown as bars under the price. |
| **Overlay** | An indicator line drawn on top of the price (SMA, EMA, Bollinger, VWAP). |
| **Pane / sub-chart** | A separate strip below the price (e.g. the RSI pane). |
| **Crosshair** | The cross that follows your mouse and reads off the value under it. |
| **lightweight-charts** | TradingView's free, plain-JS charting library that we use. |
| **Watchlist** | A saved list of coins you switch between quickly. |
| **SMA / EMA** | Simple / Exponential moving average — a smoothed average price line. |
| **Bollinger Bands** | A moving average with bands 2 std-devs above/below it. |
| **VWAP** | Volume-Weighted Average Price — the average price weighted by volume. |
| **Timeframe switcher** | Buttons to change each candle's length (15m…1w). |

Back to the [index](README.md).
