// pages/api/sectors.js
// 섹터별 대표 ETF를 Finnhub로 조회해 섹터 강약(등락률·52주 고점 대비 위치)을 반환합니다.
// Finnhub 무료: 분당 60회, 미국 실시간. quote(현재가)+metric(52주 고저) 사용.
// 환경변수: FINNHUB_API_KEY (Twelve Data와 별개의 키)
// 사용법: /api/sectors

// 대시보드 섹터 → 대표 ETF 매핑
const SECTOR_ETF = [
  { sector: "반도체", etf: "SOXX", color: "#5B9BF0" },
  { sector: "빅테크", etf: "XLK", color: "#9B8CF0" },
  { sector: "소프트웨어", etf: "IGV", color: "#E0A93C" },
  { sector: "금융&헬스케어", etf: "XLV", color: "#3DD68C" },
  { sector: "소비재", etf: "XLY", color: "#E0A93C" },
];

async function fnQuote(sym, key) {
  const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(sym)}&token=${key}`);
  return r.json();   // { c: 현재가, d: 변화, dp: 변화%, pc: 전일종가, h, l, o }
}
async function fnMetric(sym, key) {
  const r = await fetch(`https://finnhub.io/api/v1/stock/metric?symbol=${encodeURIComponent(sym)}&metric=all&token=${key}`);
  return r.json();   // { metric: { "52WeekHigh":..., "52WeekLow":..., ... } }
}

export default async function handler(req, res) {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) return res.status(500).json({ error: "FINNHUB_API_KEY 미설정 (Vercel 환경변수 확인)" });

  try {
    const out = [];
    for (const { sector, etf, color } of SECTOR_ETF) {
      try {
        const q = await fnQuote(etf, key);
        let pull = null, high52 = null;
        try {
          const m = await fnMetric(etf, key);
          high52 = m && m.metric ? m.metric["52WeekHigh"] : null;
          if (high52 && q.c) pull = +(((q.c - high52) / high52) * 100).toFixed(1);
        } catch (e) { /* metric 실패해도 등락률은 표시 */ }

        out.push({
          sector, etf, color,
          price: q.c ?? null,
          dayChg: q.dp != null ? +q.dp.toFixed(2) : null,   // 당일 등락률%
          prevClose: q.pc ?? null,
          high52: high52 != null ? +high52.toFixed(2) : null,
          pull,                                              // 52주 고점 대비 %
          ok: q.c != null,
        });
      } catch (e) {
        out.push({ sector, etf, color, ok: false, error: String(e) });
      }
    }
    res.status(200).json({ ok: true, asOf: new Date().toISOString(), sectors: out });
  } catch (e) {
    res.status(500).json({ error: "서버 오류: " + (e.message || String(e)) });
  }
}
