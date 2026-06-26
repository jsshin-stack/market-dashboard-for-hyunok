// pages/api/quote.js
// 서버 전용. 종목 일별 시계열을 받아 C1~C7(공통 모듈)을 계산해 돌려줍니다.
// 추가: PER/PBR(Finnhub), 종목명, 최근 30일 차트용 시계열.
// 사용법: /api/quote?symbols=NVDA   (검색용은 보통 1개), &chart=1 이면 차트 포함

const { scoreUniverse, trendChannel, combineScore, multiTrend } = require("../../lib/score");

async function fetchTSTwelve(sym, apiKey) {
  if (!apiKey) return null;
  const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(sym)}&interval=1day&outputsize=260&timezone=America/New_York&apikey=${apiKey}`;
  const r = await fetch(url);
  const d = await r.json();
  if (d.status === "error" || !d.values) return null;
  return d.values;
}

// Yahoo Finance 시세(키 불필요, 장중 15~20분 지연). Twelve Data와 같은 형식(values 최신순) 반환.
async function fetchTSYahoo(sym) {
  try {
    const ySym = sym.replace(/\./g, "-");   // BRK.B → BRK-B
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ySym)}?range=2y&interval=1d`;
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; market-dashboard/1.0)" } });
    if (!r.ok) return null;
    const d = await r.json();
    const result = d && d.chart && d.chart.result && d.chart.result[0];
    if (!result || !result.timestamp || !result.indicators) return null;
    const ts = result.timestamp;
    const q = result.indicators.quote && result.indicators.quote[0];
    if (!q || !q.close) return null;
    const out = [];
    for (let i = 0; i < ts.length; i++) {
      const c = q.close[i];
      if (c == null) continue;
      out.push({
        datetime: new Date(ts[i] * 1000).toISOString().slice(0, 10),
        open: q.open && q.open[i] != null ? String(q.open[i]) : String(c),
        high: q.high && q.high[i] != null ? String(q.high[i]) : String(c),
        low: q.low && q.low[i] != null ? String(q.low[i]) : String(c),
        close: String(c),
        volume: q.volume && q.volume[i] != null ? String(q.volume[i]) : "0",
      });
    }
    if (out.length < 60) return null;
    out.reverse();   // 최신순
    return out.slice(0, 260);
  } catch (e) { return null; }
}

// 통합: Yahoo 우선 + Twelve Data 폴백
async function fetchTS(sym, apiKey) {
  const y = await fetchTSYahoo(sym);
  if (y) return y;
  return await fetchTSTwelve(sym, apiKey);
}

async function fetchFundamentals(sym, finnhubKey) {
  if (!finnhubKey) return {};
  try {
    const [mResp, pResp] = await Promise.all([
      fetch(`https://finnhub.io/api/v1/stock/metric?symbol=${encodeURIComponent(sym)}&metric=all&token=${finnhubKey}`),
      fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(sym)}&token=${finnhubKey}`),
    ]);
    const m = await mResp.json();
    const p = await pResp.json();
    const met = m && m.metric ? m.metric : {};
    return {
      name: p && p.name ? p.name : null,
      per: met.peTTM != null ? +Number(met.peTTM).toFixed(1) : (met.peBasicExclExtraTTM != null ? +Number(met.peBasicExclExtraTTM).toFixed(1) : null),
      pbr: met.pbQuarterly != null ? +Number(met.pbQuarterly).toFixed(2) : (met.pb != null ? +Number(met.pb).toFixed(2) : null),
    };
  } catch (e) { return {}; }
}

export default async function handler(req, res) {
  const apiKey = process.env.TWELVE_DATA_API_KEY || null;   // 없어도 Yahoo로 동작(폴백용)
  const finnhubKey = process.env.FINNHUB_API_KEY;

  const symbolsParam = (req.query.symbols || "").toString().trim();
  if (!symbolsParam) return res.status(400).json({ error: "symbols 파라미터가 필요합니다." });
  const symbols = symbolsParam.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean).slice(0, 8);
  const withChart = req.query.chart === "1";

  try {
    let idxRef = null;
    try {
      const iv = await fetchTS("QQQ", apiKey);
      if (iv) {
        const closes = iv.map((v) => parseFloat(v.close)).filter((n) => !isNaN(n));
        idxRef = { close: closes[0], ma50: closes.slice(0, 50).reduce((a, b) => a + b, 0) / Math.min(50, closes.length), ret20: closes[20] ? closes[0] / closes[20] - 1 : null };
      }
    } catch (e) { /* C7 지수조건 생략 */ }

    const valuesBySym = {};
    for (const sym of symbols) {
      const v = await fetchTS(sym, apiKey);
      if (v) valuesBySym[sym] = v;
    }

    const scored = scoreUniverse(valuesBySym, idxRef);

    const results = {};
    for (const sym of symbols) {
      if (!scored[sym]) { results[sym] = { error: "데이터를 가져오지 못했습니다." }; continue; }
      const fund = await fetchFundamentals(sym, finnhubKey);
      const vals = valuesBySym[sym];
      results[sym] = {
        ...scored[sym],
        asOf: vals[0] ? vals[0].datetime : null,
        name: fund.name || null,
        per: fund.per != null ? fund.per : null,
        pbr: fund.pbr != null ? fund.pbr : null,
        updatedAt: new Date().toISOString(),
      };
      if (withChart && vals) {
        results[sym].chart = vals.slice(0, 30).reverse().map((v) => ({ date: v.datetime, close: +parseFloat(v.close).toFixed(2) }));
      }
      // 추세채널(C8 추세구조·C9 채널위치·C10 오버슈팅) — 최근 90일
      try {
        const tc = trendChannel(vals, 90);
        if (tc) results[sym].channel = tc;
        // 10팩터 통합 점수 + 가중 강도(%)
        const combined = combineScore(scored[sym], tc || null);
        results[sym].combined = combined;
        // 다기간 추세(장기/단기 분리 + 국면)
        const mt = multiTrend(vals);
        if (mt) results[sym].multiTrend = mt;
      } catch (e) { /* 채널/통합 계산 실패 시 생략 */ }
    }

    res.status(200).json({ ok: true, data: results });
  } catch (e) {
    res.status(500).json({ error: "서버 오류: " + (e.message || String(e)) });
  }
}
