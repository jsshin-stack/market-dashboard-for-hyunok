// pages/api/macro.js
// 지수(NDX, SPX)와 확인지표(VIX, HYG)를 한 번에 갱신합니다.
// 사용법: /api/macro
// 반환: { ok, idx: { NDX:{close,prevDay,maVal,gapPct,...}, SPX:{...} }, confirm:{ vix, hyg20, ... } }
// 주의: 일부 무료 플랜은 지수(NDX 등) 접근이 제한될 수 있어, 실패 시 해당 항목만 null로 반환합니다.

async function fetchSeries(symbol, apiKey, size = 260) {
  const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=1day&outputsize=${size}&apikey=${apiKey}`;
  const r = await fetch(url);
  const d = await r.json();
  if (d.status === "error" || !d.values) return { error: d.message || "데이터 없음" };
  const closes = d.values.map((v) => parseFloat(v.close)).filter((n) => !isNaN(n));
  return { closes, values: d.values };
}

function avg(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null; }

export default async function handler(req, res) {
  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "API 키 미설정 (TWELVE_DATA_API_KEY)" });

  try {
    const out = { ok: true, idx: {}, confirm: {} };

    // --- 지수 2종 ---
    for (const [key, sym, maWin] of [["NDX", "NDX", 200], ["SPX", "GSPC", 200]]) {
      const s = await fetchSeries(sym, apiKey, 260);
      if (s.error) { out.idx[key] = { error: s.error }; continue; }
      const close = s.closes[0], prevDay = s.closes[1];
      const prevWeek = s.closes[5] || null, prevMonth = s.closes[21] || null;
      const maVal = avg(s.closes.slice(0, maWin));
      // slope: MA가 20일 전 대비 얼마나 올랐나
      const maOld = avg(s.closes.slice(20, 20 + maWin));
      const slopePct = maVal && maOld ? +(((maVal - maOld) / maOld) * 100).toFixed(2) : null;
      const gapPct = maVal ? +(((close - maVal) / maVal) * 100).toFixed(2) : null;
      out.idx[key] = {
        close: +close.toFixed(2),
        asOf: s.values[0] ? s.values[0].datetime : null,
        prevDay: prevDay != null ? +prevDay.toFixed(2) : null,
        prevWeek: prevWeek != null ? +prevWeek.toFixed(2) : null,
        prevMonth: prevMonth != null ? +prevMonth.toFixed(2) : null,
        maVal: maVal != null ? +maVal.toFixed(2) : null,
        gapPct, slopePct,
      };
    }

    // --- 확인지표: VIX, HYG ---
    const vix = await fetchSeries("VIX", apiKey, 5);
    if (!vix.error) {
      out.confirm.vix = +vix.closes[0].toFixed(2);
      out.confirm.vixPrev = vix.closes[5] != null ? +vix.closes[5].toFixed(2) : null;
    }
    const hyg = await fetchSeries("HYG", apiKey, 25);
    if (!hyg.error) {
      const cur = hyg.closes[0], ago20 = hyg.closes[20];
      out.confirm.hyg20 = ago20 ? +(((cur - ago20) / ago20) * 100).toFixed(2) : null;
    }

    res.status(200).json(out);
  } catch (e) {
    res.status(500).json({ error: "서버 오류: " + (e.message || String(e)) });
  }
}
