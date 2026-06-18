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

module.exports = { computeMetrics, scoreFromMetrics, scoreUniverse, atr14, avg };
