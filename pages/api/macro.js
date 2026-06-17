// pages/api/macro.js
// 지수(NDX, SPX)와 확인지표(VIX, HYG)를 한 번에 갱신합니다.
// 사용법: /api/macro
// 반환: { ok, idx: { NDX:{close,prevDay,maVal,gapPct,...}, SPX:{...} }, confirm:{ vix, hyg20, ... } }
// 주의: 일부 무료 플랜은 지수(NDX 등) 접근이 제한될 수 있어, 실패 시 해당 항목만 null로 반환합니다.

async function fetchSeries(symbol, apiKey, size = 260) {
  const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=1day&outputsize=${size}&timezone=America/New_York&apikey=${apiKey}`;
  const r = await fetch(url);
  const d = await r.json();
  if (d.status === "error" || !d.values) return { error: d.message || "데이터 없음" };
  const closes = d.values.map((v) => parseFloat(v.close)).filter((n) => !isNaN(n));
  return { closes, values: d.values };
}
// 실시간 최신가(/quote): 일봉 확정 전에도 최신 종가를 반환
async function fetchLatest(symbol, apiKey) {
  try {
    const r = await fetch(`https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbol)}&timezone=America/New_York&apikey=${apiKey}`);
    const q = await r.json();
    if (q && q.close && q.datetime) {
      const c = parseFloat(q.close);
      if (!isNaN(c)) return { close: c, datetime: q.datetime };
    }
  } catch (e) { /* noop */ }
  return null;
}

function avg(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null; }

export default async function handler(req, res) {
  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "API 키 미설정 (TWELVE_DATA_API_KEY)" });

  try {
    const out = { ok: true, idx: {}, confirm: {} };

    // --- 지수 2종: 인덱스 심볼 우선, 실패 시 ETF 프록시로 폴백 ---
    // 무료 플랜에서 인덱스(NDX/SPX) 접근이 막히면 QQQ(나스닥100)·SPY(S&P500)로 대체.
    // 단, 프록시 사용 시 지수 카드의 기존 종가 스케일과 달라지므로 gap%/slope%만 의미가 있음.
    const idxPlan = [
      { key: "NDX", syms: ["NDX", "QQQ"], maWin: 200 },
      { key: "SPX", syms: ["SPX", "GSPC", "SPY"], maWin: 200 },
    ];
    for (const { key, syms, maWin } of idxPlan) {
      let s = null, usedSym = null;
      for (const sym of syms) {
        const r = await fetchSeries(sym, apiKey, 280);   // 252일 ROC 계산 위해 여유있게
        if (!r.error && r.closes && r.closes.length > maWin / 2) { s = r; usedSym = sym; break; }
      }
      if (!s) { out.idx[key] = { error: "지수/프록시 모두 접근 불가" }; continue; }
      let close = s.closes[0];
      let asOf = s.values[0] ? s.values[0].datetime : null;
      // 실시간 최신가 보정: 일봉이 /quote보다 과거면 최신가로 갱신
      const latest = await fetchLatest(usedSym, apiKey);
      if (latest && (!asOf || latest.datetime >= asOf)) {
        if (latest.datetime > asOf) s.closes.unshift(latest.close);
        else s.closes[0] = latest.close;
        close = latest.close; asOf = latest.datetime;
      }
      const prevDay = s.closes[1];
      const prevWeek = s.closes[5] || null, prevMonth = s.closes[21] || null;
      const maVal = avg(s.closes.slice(0, maWin));
      const maOld = avg(s.closes.slice(20, 20 + maWin));
      const slopePct = maVal && maOld ? +(((maVal - maOld) / maOld) * 100).toFixed(2) : null;
      const gapPct = maVal ? +(((close - maVal) / maVal) * 100).toFixed(2) : null;
      const idx252 = Math.min(251, s.closes.length - 1);
      const ago = s.closes[idx252];
      const roc12m = ago ? +(((close - ago) / ago) * 100).toFixed(1) : null;
      if (roc12m != null) { if (key === "NDX") out.confirm.rocNDX = roc12m; else out.confirm.rocSPX = roc12m; }
      out.idx[key] = {
        close: +close.toFixed(2),
        asOf,
        source: usedSym,
        isProxy: usedSym !== key && usedSym !== "GSPC",
        prevDay: prevDay != null ? +prevDay.toFixed(2) : null,
        prevWeek: prevWeek != null ? +prevWeek.toFixed(2) : null,
        prevMonth: prevMonth != null ? +prevMonth.toFixed(2) : null,
        maVal: maVal != null ? +maVal.toFixed(2) : null,
        gapPct, slopePct, roc12m,
      };
    }

    // --- 확인지표: VIX (지수 → 프록시 폴백), HYG (일반 ETF) ---
    let vixData = null, vixSym = null;
    for (const sym of ["VIX", "VIXY"]) {   // VIXY는 VIX와 스케일이 비교적 근접
      const r = await fetchSeries(sym, apiKey, 10);
      if (!r.error && r.closes && r.closes.length >= 6) { vixData = r; vixSym = sym; break; }
    }
    if (vixData) {
      out.confirm.vix = +vixData.closes[0].toFixed(2);
      out.confirm.vixPrev = vixData.closes[5] != null ? +vixData.closes[5].toFixed(2) : null;
      out.confirm.vixSource = vixSym;
      out.confirm.vixProxy = vixSym !== "VIX";   // 프록시면 절대값은 참고용(추세만 유효)
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
