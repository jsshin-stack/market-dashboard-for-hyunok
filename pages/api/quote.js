// pages/api/quote.js
// 이 파일은 "서버"에서만 실행됩니다. API 키가 브라우저(사용자)에게 절대 노출되지 않습니다.
// 사용법: /api/quote?symbols=NVDA,AAPL,MSFT
// Twelve Data에서 각 종목의 현재가, 200일 이동평균, 52주 고저, 일별 시계열을 가져와
// 베이스 스캔에 필요한 값(가격, MA200, 52주 고점 대비 풀백%)을 계산해 돌려줍니다.

export default async function handler(req, res) {
  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "API 키가 설정되지 않았습니다. Vercel 환경변수 TWELVE_DATA_API_KEY를 확인하세요." });
  }

  const symbolsParam = (req.query.symbols || "").toString().trim();
  if (!symbolsParam) {
    return res.status(400).json({ error: "symbols 파라미터가 필요합니다. 예: /api/quote?symbols=NVDA,AAPL" });
  }
  // 너무 많은 종목을 한 번에 요청하면 무료 한도를 빠르게 소진하므로 최대 8개로 제한
  const symbols = symbolsParam.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean).slice(0, 8);

  try {
    const results = {};
    // 종목별로 순차 호출 (무료 플랜의 분당 호출 제한을 피하기 위함)
    for (const sym of symbols) {
      // 1) 일별 시계열 250개 (MA200 계산 + 52주 고점 산출용)
      const tsUrl = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(sym)}&interval=1day&outputsize=260&apikey=${apiKey}`;
      const tsResp = await fetch(tsUrl);
      const tsData = await tsResp.json();

      if (tsData.status === "error" || !tsData.values) {
        results[sym] = { error: tsData.message || "데이터를 가져오지 못했습니다." };
        continue;
      }

      // values는 최신순 배열. 종가만 숫자로 변환
      const closes = tsData.values.map((v) => parseFloat(v.close)).filter((n) => !isNaN(n));
      const highs = tsData.values.map((v) => parseFloat(v.high)).filter((n) => !isNaN(n));
      const close = closes[0];
      const prevClose = closes[1];

      // MA200 (종가 200개 평균)
      const ma200arr = closes.slice(0, 200);
      const ma200 = ma200arr.length ? ma200arr.reduce((a, b) => a + b, 0) / ma200arr.length : null;
      // MA20
      const ma20arr = closes.slice(0, 20);
      const ma20 = ma20arr.length ? ma20arr.reduce((a, b) => a + b, 0) / ma20arr.length : null;
      // 52주 고점
      const high52 = highs.length ? Math.max(...highs.slice(0, 252)) : null;
      // 30일 고점
      const high30 = highs.length ? Math.max(...highs.slice(0, 30)) : null;

      const pull = high52 ? ((close - high52) / high52) * 100 : null;       // 고점 대비 풀백%
      const fromMA20 = ma20 ? ((close - ma20) / ma20) * 100 : null;          // MA20 이격도%
      const dayChg = prevClose ? ((close - prevClose) / prevClose) * 100 : null;

      // 베이스 스캔 C1~C5 계산 (대시보드 규칙)
      const c1 = ma200 != null && close > ma200 ? 1 : 0;                      // 추세
      const c2 = pull != null && pull <= -5 && pull >= -18 ? 1 : 0;           // 풀백 -5~-18%
      const c3 = c1 && pull != null && pull <= -3 && pull >= -15 ? 1 : 0;     // 베이스(추세+적정조정)
      const c4 = fromMA20 != null && Math.abs(fromMA20) <= 4 ? 1 : 0;         // MA20 수렴(±4%)
      const c5 = high30 != null && close >= high30 * 0.98 ? 1 : 0;            // 30일 고점 돌파(근접)

      results[sym] = {
        close: +close.toFixed(2),
        prevClose: prevClose != null ? +prevClose.toFixed(2) : null,
        dayChg: dayChg != null ? +dayChg.toFixed(2) : null,
        ma200: ma200 != null ? +ma200.toFixed(2) : null,
        ma20: ma20 != null ? +ma20.toFixed(2) : null,
        high52: high52 != null ? +high52.toFixed(2) : null,
        pull: pull != null ? +pull.toFixed(1) : null,
        c: [c1, c2, c3, c4, c5],
        score: c1 + c2 + c3 + c4 + c5,
        updatedAt: new Date().toISOString(),
      };
    }

    res.status(200).json({ ok: true, data: results });
  } catch (e) {
    res.status(500).json({ error: "서버 오류: " + (e.message || String(e)) });
  }
}
