// pages/api/series.js
// 백테스트용: 한 종목의 일별 종가 시계열을 그대로 반환합니다.
// 사용법: /api/series?symbol=NVDA&start=2025-06-23&end=2026-06-15
// 반환: { ok, symbol, values: [{date, close}, ...] }  (날짜 오름차순)

export default async function handler(req, res) {
  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "API 키 미설정 (TWELVE_DATA_API_KEY)" });

  const symbol = (req.query.symbol || "").toString().trim().toUpperCase();
  const start = (req.query.start || "").toString().trim();
  const end = (req.query.end || "").toString().trim();
  if (!symbol) return res.status(400).json({ error: "symbol 파라미터가 필요합니다." });

  try {
    // 기간이 주어지면 그 구간, 아니면 최근 400개
    let url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=1day&apikey=${apiKey}`;
    if (start && end) {
      url += `&start_date=${start}&end_date=${end}&outputsize=5000`;
    } else {
      url += `&outputsize=400`;
    }
    const resp = await fetch(url);
    const data = await resp.json();
    if (data.status === "error" || !data.values) {
      return res.status(200).json({ ok: false, symbol, error: data.message || "데이터 없음" });
    }
    // Twelve Data는 최신순 → 오름차순으로 뒤집기
    const values = data.values
      .map((v) => ({ date: v.datetime, close: parseFloat(v.close) }))
      .filter((v) => !isNaN(v.close))
      .reverse();
    res.status(200).json({ ok: true, symbol, values });
  } catch (e) {
    res.status(500).json({ error: "서버 오류: " + (e.message || String(e)) });
  }
}
