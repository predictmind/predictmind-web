/**
 * Client-side indicator maths for chart overlays. These mirror the backend engine
 * (same formulas) but run in the browser so we can draw indicator lines on the
 * chart instantly without another API round-trip. Each returns an array aligned
 * 1:1 with the input closes/candles; entries are `null` until there's enough data.
 */

export interface OhlcvBar {
  time: number; // UTC seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/** Simple moving average. */
export function sma(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    out.push(i >= period - 1 ? sum / period : null);
  }
  return out;
}

/** Exponential moving average (seeded with the first SMA). */
export function ema(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = [];
  const k = 2 / (period + 1);
  let prev: number | null = null;
  let seed = 0;
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      seed += values[i];
      out.push(null);
      continue;
    }
    if (i === period - 1) {
      seed += values[i];
      prev = seed / period;
      out.push(prev);
      continue;
    }
    prev = values[i] * k + (prev as number) * (1 - k);
    out.push(prev);
  }
  return out;
}

/** Wilder's RSI (0-100). */
export function rsi(values: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length <= period) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1];
    if (d >= 0) gain += d;
    else loss -= d;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  out[period] = 100 - 100 / (1 + (avgLoss === 0 ? Infinity : avgGain / avgLoss));
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    const g = d >= 0 ? d : 0;
    const l = d < 0 ? -d : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
    out[i] = 100 - 100 / (1 + (avgLoss === 0 ? Infinity : avgGain / avgLoss));
  }
  return out;
}

/** Bollinger Bands (middle SMA ± mult × standard deviation). */
export function bollinger(
  values: number[],
  period = 20,
  mult = 2,
): { middle: (number | null)[]; upper: (number | null)[]; lower: (number | null)[] } {
  const middle = sma(values, period);
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];
  for (let i = 0; i < values.length; i++) {
    const m = middle[i];
    if (m === null) {
      upper.push(null);
      lower.push(null);
      continue;
    }
    let variance = 0;
    for (let j = i - period + 1; j <= i; j++) variance += (values[j] - m) ** 2;
    const sd = Math.sqrt(variance / period);
    upper.push(m + mult * sd);
    lower.push(m - mult * sd);
  }
  return { middle, upper, lower };
}

/** Rolling VWAP over `period` bars (typical price × volume). */
export function vwap(bars: OhlcvBar[], period = 20): (number | null)[] {
  const out: (number | null)[] = [];
  let pvSum = 0;
  let volSum = 0;
  const pv: number[] = [];
  const vol: number[] = [];
  for (let i = 0; i < bars.length; i++) {
    const typical = (bars[i].high + bars[i].low + bars[i].close) / 3;
    const v = bars[i].volume > 0 ? bars[i].volume : 0;
    pv.push(typical * v);
    vol.push(v);
    pvSum += pv[i];
    volSum += vol[i];
    if (i >= period) {
      pvSum -= pv[i - period];
      volSum -= vol[i - period];
    }
    out.push(i >= period - 1 && volSum > 0 ? pvSum / volSum : null);
  }
  return out;
}
