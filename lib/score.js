// lib/score.js
// C1~C7 베이스 스캔 점수 공통 계산 모듈. quote/cron/백테스트가 동일 로직을 쓰도록 한 곳에 모음.
// 입력 values: Twelve Data time_series 형식의 일별 배열(최신순). 각 항목 { close, high, low, volume, datetime }
// idxRef: { close, ma50, ret20 } (C7 지수환경/RS용) — 없으면 C7 지수조건은 생략
// rsScore, rsPercentile: C7 상대강도(종목군 내 백분위) — 외부에서 주입(없으면 0 처리)

function avg(a) { return a.length ? a.reduce((x, y) => x + y, 0) / a.length : null; }

// ATR(14): 평균 True Range. values는 최신순.
function atr14(values, n = 14) {
  if (values.length < n + 1) return null;
  const trs = [];
  for (let i = 0; i < n; i++) {
    const cur = values[i], prev = values[i + 1];
    const h = parseFloat(cur.high), l = parseFloat(cur.low), pc = parseFloat(prev.close);
    if ([h, l, pc].some((x) => isNaN(x))) continue;
    trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  return trs.length ? avg(trs) : null;
}

// 종목 원천 지표 계산 (점수 매기기 전 단계). RS 비교용 ret도 같이 반환.
function computeMetrics(values) {
  const closes = values.map((v) => parseFloat(v.close)).filter((n) => !isNaN(n));
  const highs = values.map((v) => parseFloat(v.high)).filter((n) => !isNaN(n));
  const lows = values.map((v) => parseFloat(v.low)).filter((n) => !isNaN(n));
  const vols = values.map((v) => parseFloat(v.volume)).filter((n) => !isNaN(n));
  if (closes.length < 30) return null;
  const close = closes[0], prevClose = closes[1];
  const ma20 = avg(closes.slice(0, 20));
  const ma50 = avg(closes.slice(0, 50));
  const ma150 = avg(closes.slice(0, 150));
  const ma200 = avg(closes.slice(0, 200));
  const ma200_20ago = closes.length >= 220 ? avg(closes.slice(20, 220)) : avg(closes.slice(20));
  const high52 = Math.max(...highs.slice(0, 252));
  const high30 = Math.max(...highs.slice(0, 30));
  const high30_prev = highs.length > 30 ? Math.max(...highs.slice(1, 31)) : high30; // 전일 기준 30일 고점
  const atr = atr14(values, 14);
  const pull = high52 ? ((close - high52) / high52) * 100 : null;
  const dayChg = prevClose ? ((close - prevClose) / prevClose) * 100 : null;
  // RS 원시값: 분기(63일)·반기(126일) 가중 수익률 (없으면 가능한 만큼)
  const r63 = closes[63] ? close / closes[63] - 1 : (closes[closes.length - 1] ? close / closes[closes.length - 1] - 1 : 0);
  const r126 = closes[126] ? close / closes[126] - 1 : r63;
  const rsRaw = 0.6 * r63 + 0.4 * r126;
  return { closes, highs, lows, vols, close, prevClose, ma20, ma50, ma150, ma200, ma200_20ago, high52, high30, high30_prev, atr, pull, dayChg, rsRaw };
}

// 점수 계산. m=computeMetrics 결과, idxRef·rsPercentile 주입.
function scoreFromMetrics(m, idxRef, rsPercentile) {
  const { closes, vols, close, ma20, ma50, ma150, ma200, ma200_20ago, high30, high30_prev, atr } = m;

  // C1 추세: 완전 정배열 + 200일선 우상향
  const c1 = (ma50 != null && ma150 != null && ma200 != null &&
    close > ma50 && ma50 > ma150 && ma150 > ma200 && ma200 > ma200_20ago) ? 1 : 0;

  // C2 풀백 하한선 방어: 종가 ≥ 최근30일 고점 - 3*ATR
  let c2 = 0;
  if (atr != null && m.high30 != null) {
    if (close >= m.high30 - 3 * atr) c2 = 1;
  }

  // C3 베이스(기존 유지): 추세(과거 정의: 200일 위) + 적정 조정 -3~-15%
  const aboveMA200 = ma200 != null && close > ma200;
  const c3 = (aboveMA200 && m.pull != null && m.pull <= -3 && m.pull >= -15) ? 1 : 0;

  // C4 변동성 수축: 최근 10일 고저폭 ≤ 1.5*ATR (MA20 정규화 동일하므로 폭 비교로 환원)
  let c4 = 0;
  if (atr != null && closes.length >= 10) {
    const win = m.highs.slice(0, 10), winL = m.lows.slice(0, 10);
    const range10 = Math.max(...win) - Math.min(...winL);
    if (range10 <= 1.5 * atr * 1) {
      // 위 식은 (range/MA20) ≤ 1.5*(ATR/MA20) 와 동치 → range ≤ 1.5*ATR... 단 ATR은 1일 평균이라 10일폭과 스케일 보정
      c4 = range10 <= 1.5 * atr * 3 ? 1 : 0; // 스케일 보정계수 3 (10일 누적 변동 ≈ ATR의 수 배)
    }
  }

  // C5 돌파: 종가 ≥ 전일까지의 최근30일 고점
  const c5 = (high30_prev != null && close >= high30_prev) ? 1 : 0;

  // C6 거래량: 돌파일 폭발(20일평균 1.5배↑) AND 직전 3일 거래량 고갈(50일평균 0.5배 미만)
  let c6 = 0;
  if (vols.length >= 51) {
    const today = vols[0];
    const ma20v = avg(vols.slice(1, 21));
    const ma50v = avg(vols.slice(1, 51));
    const prev3 = avg(vols.slice(1, 4));
    const burst = ma20v > 0 && today >= 1.5 * ma20v;
    const dryUp = ma50v > 0 && prev3 < 0.5 * ma50v;
    if (burst && dryUp) c6 = 1;
  }

  // C7 시장 주도주: 지수 50일선 위 AND 종목군 내 RS 백분위 ≥ 80
  let c7 = 0;
  const idxAbove = idxRef && idxRef.ma50 != null && idxRef.close != null ? idxRef.close > idxRef.ma50 : false;
  if (idxAbove && rsPercentile != null && rsPercentile >= 80) c7 = 1;

  const c = [c1, c2, c3, c4, c5, c6, c7];
  return {
    c, score: c.reduce((a, b) => a + b, 0),
    close: +close.toFixed(2),
    prevClose: m.prevClose != null ? +m.prevClose.toFixed(2) : null,
    dayChg: m.dayChg != null ? +m.dayChg.toFixed(2) : null,
    ma20: ma20 != null ? +ma20.toFixed(2) : null,
    ma50: ma50 != null ? +ma50.toFixed(2) : null,
    ma200: ma200 != null ? +ma200.toFixed(2) : null,
    high52: m.high52 != null ? +m.high52.toFixed(2) : null,
    pull: m.pull != null ? +m.pull.toFixed(1) : null,
    atr: atr != null ? +atr.toFixed(2) : null,
    rsPercentile: rsPercentile != null ? Math.round(rsPercentile) : null,
    // 돌파 임박: C1·C2·C4 통과 + 직전 거래량 고갈
    imminent: (c1 && c2 && c4) ? 1 : 0,
  };
}

// 여러 종목을 한꺼번에 점수화 (RS 백분위를 종목군 내에서 계산)
// input: { SYM: values[] }, idxRef
function scoreUniverse(valuesBySym, idxRef) {
  const metrics = {};
  const rsList = [];
  for (const [sym, values] of Object.entries(valuesBySym)) {
    const m = computeMetrics(values);
    if (m) { metrics[sym] = m; rsList.push({ sym, rs: m.rsRaw }); }
  }
  // RS 백분위 계산 (종목군 내)
  rsList.sort((a, b) => a.rs - b.rs);
  const pct = {};
  rsList.forEach((x, i) => { pct[x.sym] = rsList.length > 1 ? (i / (rsList.length - 1)) * 100 : 100; });
  const out = {};
  for (const [sym, m] of Object.entries(metrics)) {
    out[sym] = scoreFromMetrics(m, idxRef, pct[sym]);
  }
  return out;
}

// ── 추세채널 분석 (C8~C10) ──────────────────────────────
// 일별 values(최신순)로 스윙 고/저점 → 추세구조·평행채널·오버슈팅 계산.
// 기본 lookback 90일.

// 단순 선형회귀: 점 [{x,y}] → {slope, intercept}
function linreg(points) {
  const n = points.length;
  if (n < 2) return null;
  let sx = 0, sy = 0, sxy = 0, sxx = 0;
  for (const p of points) { sx += p.x; sy += p.y; sxy += p.x * p.y; sxx += p.x * p.x; }
  const denom = n * sxx - sx * sx;
  if (denom === 0) return null;
  const slope = (n * sxy - sx * sy) / denom;
  const intercept = (sy - slope * sx) / n;
  return { slope, intercept };
}

// 국소 고점/저점(피벗) 탐지: 좌우 w일보다 높으면 고점, 낮으면 저점
function pivots(arr, w = 3) {
  const highs = [], lows = [];
  for (let i = w; i < arr.length - w; i++) {
    let isHigh = true, isLow = true;
    for (let k = 1; k <= w; k++) {
      if (arr[i].high <= arr[i - k].high || arr[i].high <= arr[i + k].high) isHigh = false;
      if (arr[i].low >= arr[i - k].low || arr[i].low >= arr[i + k].low) isLow = false;
    }
    if (isHigh) highs.push({ x: i, y: arr[i].high });
    if (isLow) lows.push({ x: i, y: arr[i].low });
  }
  return { highs, lows };
}

// values: 최신순 OHLCV. lookback 구간을 과거→현재(오름차순)로 정렬해 분석.
function trendChannel(values, lookback = 90) {
  const slice = values.slice(0, lookback).reverse(); // 오름차순(과거→현재)
  if (slice.length < 20) return null;
  const closes = slice.map((v) => v.close);
  const last = closes[closes.length - 1];

  const { highs, lows } = pivots(slice, 3);
  // 피벗이 너무 적으면 전체 회귀로 대체
  const lowFit = lows.length >= 2 ? linreg(lows) : linreg(slice.map((v, i) => ({ x: i, y: v.low })));
  const highFit = highs.length >= 2 ? linreg(highs) : linreg(slice.map((v, i) => ({ x: i, y: v.high })));
  if (!lowFit || !highFit) return null;

  const xN = slice.length - 1;
  // C8 추세구조: 저점·고점 회귀 기울기가 모두 양수 = 우상향 구조
  const lowsRising = lowFit.slope > 0;
  const highsRising = highFit.slope > 0;
  const c8 = (lowsRising && highsRising) ? 1 : 0;

  // 평행 채널: 하단=저점 회귀선. 상단=같은 기울기를 고점들 중 최대 절편으로.
  const slope = lowFit.slope;
  // 상단 절편: 각 고점에서 (y - slope*x) 의 최대값
  let upperB = -Infinity, lowerB = Infinity;
  (highs.length ? highs : slice.map((v, i) => ({ x: i, y: v.high }))).forEach((p) => { upperB = Math.max(upperB, p.y - slope * p.x); });
  (lows.length ? lows : slice.map((v, i) => ({ x: i, y: v.low }))).forEach((p) => { lowerB = Math.min(lowerB, p.y - slope * p.x); });
  const upperNow = slope * xN + upperB;   // 현재 시점 채널 상단
  const lowerNow = slope * xN + lowerB;   // 현재 시점 채널 하단
  const width = upperNow - lowerNow;

  // C9 채널 위치%: 0=하단(저평가), 100=상단(고평가)
  let posPct = width > 0 ? ((last - lowerNow) / width) * 100 : 50;
  // C9 신호: 하단권(≤35%) = 저가매수 유리
  const c9 = posPct <= 35 ? 1 : 0;

  // C10 오버슈팅: 채널 상단 돌파(>100%) = 과열, 익절/주의
  const c10 = posPct > 100 ? 1 : 0;

  // 채널 방향 라벨
  const dir = slope > 0 ? "상승" : slope < 0 ? "하락" : "횡보";

  return {
    c8, c9, c10,
    lowsRising, highsRising,
    posPct: Math.round(Math.max(-20, Math.min(140, posPct))),
    upperNow: +upperNow.toFixed(2), lowerNow: +lowerNow.toFixed(2),
    dir, slope: +slope.toFixed(4),
    pivotHighs: highs.length, pivotLows: lows.length,
  };
}

// ── 10팩터 통합 점수/강도 ────────────────────────────────
// C1~C10을 합산. 단순 개수(count/10)와 가중 강도(%)를 함께 산출.
// C10(오버슈팅)은 감점 요소: 충족 시 강도에서 차감.
const FACTOR_WEIGHTS = {
  c1: 18,  // 추세(정배열) — 추세매매 1순위 전제
  c8: 16,  // 추세구조(저점·고점 동시 상승)
  c7: 12,  // 주도주(RS 상위)
  c9: 12,  // 채널 하단(저가 매수 유리)
  c5: 10,  // 돌파
  c2: 9,   // 풀백(ATR)
  c6: 8,   // 거래량
  c3: 8,   // 베이스
  c4: 7,   // 변동성 수축
  // 합계 100 (c10 제외)
};
const C10_PENALTY = 15;   // 오버슈팅 충족 시 강도 차감

// base: scoreFromMetrics 결과(c[0..6]), channel: trendChannel 결과(c8,c9,c10) 또는 null
function combineScore(base, channel) {
  const c = [...base.c];                       // C1~C7
  const c8 = channel ? channel.c8 : 0;
  const c9 = channel ? channel.c9 : 0;
  const c10 = channel ? channel.c10 : 0;
  const all = [...c, c8, c9, c10];             // C1~C10 (길이 10)
  // 단순 개수: 플러스 팩터 9개 중 충족 수 (C10은 경고라 개수에서 제외하되 분모는 10 유지 표시용)
  const plusCount = c.reduce((a, b) => a + b, 0) + c8 + c9;   // C1~C9 중 충족
  // 가중 강도(%)
  let weighted = 0;
  weighted += c[0] * FACTOR_WEIGHTS.c1;
  weighted += c[1] * FACTOR_WEIGHTS.c2;
  weighted += c[2] * FACTOR_WEIGHTS.c3;
  weighted += c[3] * FACTOR_WEIGHTS.c4;
  weighted += c[4] * FACTOR_WEIGHTS.c5;
  weighted += c[5] * FACTOR_WEIGHTS.c6;
  weighted += c[6] * FACTOR_WEIGHTS.c7;
  weighted += c8 * FACTOR_WEIGHTS.c8;
  weighted += c9 * FACTOR_WEIGHTS.c9;
  if (c10) weighted -= C10_PENALTY;            // 오버슈팅 감점
  const strength = Math.max(0, Math.min(100, Math.round(weighted)));
  return {
    c10all: all,                 // [c1..c10]
    plusCount,                   // C1~C9 충족 개수 (0~9)
    totalFactors: 10,            // 표시용 분모
    strength,                    // 가중 강도 0~100%
    c8, c9, c10,
  };
}

// ── 다기간 추세 분석 (장기/단기 분리) ───────────────────
// 5·15·30·60·90일 각 구간의 추세 방향을 계산하고, 장기/단기로 묶어 국면 판정.
// values: 최신순 OHLCV.
function multiTrend(values) {
  const closesDesc = values.map((v) => v.close).filter((n) => !isNaN(n));
  if (closesDesc.length < 30) return null;
  const closes = closesDesc.slice().reverse();   // 오름차순(과거→현재)
  const slopePctOver = (win) => {
    let w = Math.min(win, closes.length);
    const seg = closes.slice(closes.length - w);
    const n = seg.length;
    let sx = 0, sy = 0, sxy = 0, sxx = 0;
    for (let i = 0; i < n; i++) { sx += i; sy += seg[i]; sxy += i * seg[i]; sxx += i * i; }
    const d = n * sxx - sx * sx;
    const slope = d ? (n * sxy - sx * sy) / d : 0;
    const mid = sy / n;
    return mid ? (slope * (n - 1)) / mid * 100 : 0;   // 기간 동안 추세선 변화율%
  };
  const periods = { d5: slopePctOver(5), d15: slopePctOver(15), d30: slopePctOver(30), d60: slopePctOver(60), d90: slopePctOver(90) };
  const long120 = slopePctOver(120), long200 = slopePctOver(200);
  const dirOf = (p) => (p > 0.3 ? 1 : p < -0.3 ? -1 : 0);

  // 장기 추세: 더 긴 기간(200·120·90·60) 가중 — 단기 조정이 큰 추세를 못 뒤집게
  const longRaw = long200 * 0.4 + long120 * 0.3 + periods.d90 * 0.2 + periods.d60 * 0.1;
  const shortRaw = periods.d15 * 0.6 + periods.d5 * 0.4;
  const longDir = dirOf(longRaw), shortDir = dirOf(shortRaw);

  // 강도(%): 5개 기간 방향을 장기가중(5/10/15/25/45)으로 — 참고용 단일 점수
  const W = [0.05, 0.10, 0.15, 0.25, 0.45];
  const dirs = [dirOf(periods.d5), dirOf(periods.d15), dirOf(periods.d30), dirOf(periods.d60), dirOf(periods.d90)];
  let sc = 0; dirs.forEach((dd, i) => sc += dd * W[i]);
  const strength = Math.round((sc + 1) / 2 * 100);

  // 국면 판정
  let phase, phaseColor, phaseDesc;
  if (longDir >= 0 && shortDir < 0) { phase = "저가매수 기회"; phaseColor = "up"; phaseDesc = "장기 상승 추세 속 단기 조정 — 분할 매수 유리 구간."; }
  else if (longDir > 0 && shortDir >= 0) { phase = "추세 진행"; phaseColor = "up"; phaseDesc = "장·단기 모두 상승 — 추세 지속 중."; }
  else if (longDir < 0 && shortDir > 0) { phase = "반짝 반등 주의"; phaseColor = "down"; phaseDesc = "장기 하락 중 단기 반등 — 추격매수 주의(함정 가능)."; }
  else if (longDir < 0 && shortDir <= 0) { phase = "하락 추세"; phaseColor = "down"; phaseDesc = "장·단기 모두 하락 — 신규 진입 회피."; }
  else { phase = "중립/횡보"; phaseColor = "dim"; phaseDesc = "뚜렷한 추세 없음 — 관망."; }

  const r1 = (x) => +x.toFixed(1);
  return {
    periods: { d5: r1(periods.d5), d15: r1(periods.d15), d30: r1(periods.d30), d60: r1(periods.d60), d90: r1(periods.d90) },
    longDir, shortDir, longPct: r1(longRaw), shortPct: r1(shortRaw),
    strength, phase, phaseColor, phaseDesc,
  };
}

module.exports = { computeMetrics, scoreFromMetrics, scoreUniverse, atr14, avg, trendChannel, combineScore, FACTOR_WEIGHTS, multiTrend };
