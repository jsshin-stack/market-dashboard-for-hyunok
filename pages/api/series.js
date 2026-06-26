// pages/api/series.js
// 백테스트용: 한 종목의 일별 OHLCV 시계열을 반환합니다.
// 사용법: /api/series?symbol=NVDA&start=2025-06-23&end=2026-06-15
// 반환: { ok, symbol, values: [{date, open, high, low, close, volume}, ...] }  (날짜 오름차순)
// 데이터 소스: Yahoo 우선(키 불필요) + Twelve Data 폴백.

// Yahoo Finance에서 OHLCV를 받아 오름차순으로 반환. start/end로 범위 필터.
async function fetchYahoo(symbol, start, end) {
  try {
    const ySym = symbol.replace(/\./g, "-");   // BRK.B -> BRK-B
    // 범위가 길 수 있으니 넉넉히 받음(start가 있으면 그로부터 충분히 과거까지)
    let range = "2y";
    if (start) {
      const days = Math.round((Date.now() - new Date(start).getTime()) / 86400000);
      range = days > 1800 ? "10y" : days > 700 ? "5y" : days > 350 ? "2y" : "1y";
    }
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ySym)}?range=${range}&interval=1d`;
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; market-dashboard/1.0)" } });
    if (!r.ok) return null;
    const d = await r.json();
    const result = d && d.chart && d.chart.result && d.chart.result[0];
    if (!result || !result.timestamp || !result.indicators) return null;
    const ts = result.timestamp;
    const q = result.indicators.quote && result.indicators.quote[0];
    if (!q || !q.close) return null;
    let values = [];
    for (let i = 0; i < ts.length; i++) {
      const c = q.close[i];
      if (c == null) continue;
      const date = new Date(ts[i] * 1000).toISOString().slice(0, 10);
      values.push({
        date,
        open: q.open && q.open[i] != null ? q.open[i] : c,
        high: q.high && q.high[i] != null ? q.high[i] : c,
        low: q.low && q.low[i] != null ? q.low[i] : c,
        close: c,
        volume: q.volume && q.volume[i] != null ? q.volume[i] : null,
      });
    }
    // 날짜 범위 필터(오름차순 상태)
    if (start) values = values.filter((v) => v.date >= start);
    if (end) values = values.filter((v) => v.date <= end);
    return values.length >= 2 ? values : null;
  } catch (e) { return null; }
}

// Twelve Data 폴백
async function fetchTwelve(symbol, start, end, apiKey) {
  if (!apiKey) return null;
  let url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=1day&timezone=America/New_York&apikey=${apiKey}`;
  if (start && end) url += `&start_date=${start}&end_date=${end}&outputsize=5000`;
  else url += `&outputsize=400`;
  try {
    const resp = await fetch(url);
    const data = await resp.json();
    if (data.status === "error" || !data.values) return null;
    return data.values
      .map((v) => ({
        date: v.datetime,
        open: parseFloat(v.open), high: parseFloat(v.high), low: parseFloat(v.low),
        close: parseFloat(v.close), volume: v.volume != null ? parseFloat(v.volume) : null,
      }))
      .filter((v) => !isNaN(v.close))
      .reverse();
  } catch (e) { return null; }
}

export default async function handler(req, res) {
  const apiKey = process.env.TWELVE_DATA_API_KEY || null;   // 없어도 Yahoo로 동작
  const symbol = (req.query.symbol || "").toString().trim().toUpperCase();
  const start = (req.query.start || "").toString().trim();
  const end = (req.query.end || "").toString().trim();
  if (!symbol) return res.status(400).json({ error: "symbol 파라미터가 필요합니다." });

  try {
    // Yahoo 우선
    let values = await fetchYahoo(symbol, start, end);
    let src = "yahoo";
    // 실패 시 Twelve Data 폴백
    if (!values) { values = await fetchTwelve(symbol, start, end, apiKey); src = "twelve"; }
    if (!values || values.length < 2) {
      return res.status(200).json({ ok: false, symbol, error: "데이터 없음(Yahoo·Twelve 모두 실패)" });
    }
    res.status(200).json({ ok: true, symbol, source: src, values });
  } catch (e) {
    res.status(500).json({ error: "서버 오류: " + (e.message || String(e)) });
  }
}
