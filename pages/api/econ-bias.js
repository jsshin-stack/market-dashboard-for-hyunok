// pages/api/econ-bias.js
// FRED(무료, 미 연준)로 주요 경제지표의 '최신 vs 직전' 방향을 평가해 ±판정.
// + Finnhub 일반 뉴스(최근 3일)의 긍정/부정 분위기를 보조로 병기.
// 환경변수: FRED_API_KEY (필수), FINNHUB_API_KEY (선택, 뉴스 보조)
// 사용법: /api/econ-bias

// 지표 매핑: FRED 시리즈 + 방향 해석.
// dir: "down_good"  = 값이 내려가면 긍정(예: 인플레·실업·금리·청구건수)
//      "up_good"    = 값이 올라가면 긍정(예: 고용·소매판매·GDP)
// yoy: true 면 전년동월 대비 변화율로 판단(물가지수처럼 레벨 자체보다 증가율이 의미)
const INDICATORS = [
  { key: "CPI",      series: "CPIAUCSL", label: "소비자물가(CPI)",       dir: "down_good", yoy: true,  eventMatch: ["CPI"] },
  { key: "PCE",      series: "PCEPI",    label: "PCE 물가",              dir: "down_good", yoy: true,  eventMatch: ["PCE"] },
  { key: "PPI",      series: "PPIACO",   label: "생산자물가(PPI)",       dir: "down_good", yoy: true,  eventMatch: ["PPI"] },
  { key: "고용보고서", series: "PAYEMS",   label: "비농업 고용",           dir: "up_good",   yoy: false, eventMatch: ["고용보고서", "고용"] },
  { key: "실업수당",  series: "ICSA",     label: "신규 실업수당 청구",     dir: "down_good", yoy: false, eventMatch: ["실업수당"] },
  { key: "FOMC",     series: "FEDFUNDS", label: "기준금리(FFR)",         dir: "down_good", yoy: false, eventMatch: ["FOMC"] },
  { key: "소매판매",  series: "RSAFS",    label: "소매판매",              dir: "up_good",   yoy: true,  eventMatch: ["소매판매"] },
];

async function fredLatest(series, apiKey, yoy) {
  // 최근 14개월치를 받아 최신/직전, (yoy면) 전년동월 대비까지 계산
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${series}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=14`;
  const r = await fetch(url);
  const j = await r.json();
  if (!j.observations || !j.observations.length) return null;
  const obs = j.observations
    .map((o) => ({ date: o.date, value: o.value === "." ? null : parseFloat(o.value) }))
    .filter((o) => o.value != null);
  if (obs.length < 2) return null;
  const latest = obs[0], prev = obs[1];          // 최신, 직전
  let curMetric = latest.value, prevMetric = prev.value, mode = "level";
  if (yoy) {
    // 전년동월(약 12개월 전) 대비 변화율
    const yearAgo = obs.find((o) => {
      const dCur = new Date(latest.date), dO = new Date(o.date);
      const months = (dCur.getFullYear() - dO.getFullYear()) * 12 + (dCur.getMonth() - dO.getMonth());
      return months === 12;
    });
    const yearAgoPrev = obs.find((o) => {
      const dCur = new Date(prev.date), dO = new Date(o.date);
      const months = (dCur.getFullYear() - dO.getFullYear()) * 12 + (dCur.getMonth() - dO.getMonth());
      return months === 12;
    });
    if (yearAgo && yearAgoPrev) {
      curMetric = ((latest.value - yearAgo.value) / yearAgo.value) * 100;   // 최신 YoY%
      prevMetric = ((prev.value - yearAgoPrev.value) / yearAgoPrev.value) * 100; // 직전 YoY%
      mode = "yoy";
    } else { mode = "level"; }
  }
  return { latest, prev, curMetric, prevMetric, mode };
}

function judge(ind, m) {
  // 최신 지표가 직전 대비 오르내림 → 방향 해석으로 ±
  const delta = m.curMetric - m.prevMetric;
  const eps = Math.abs(m.prevMetric) * 0.002 + 1e-9;   // 미세 변화는 중립
  let dirUp = delta > eps ? "up" : delta < -eps ? "down" : "flat";
  let bias = "neutral";
  if (dirUp === "flat") bias = "neutral";
  else if (ind.dir === "down_good") bias = dirUp === "down" ? "plus" : "minus";
  else bias = dirUp === "up" ? "plus" : "minus";
  const unit = m.mode === "yoy" ? "% YoY" : "";
  const fmt = (v) => (m.mode === "yoy" ? v.toFixed(1) : (Math.abs(v) >= 1000 ? Math.round(v).toLocaleString() : v.toFixed(2)));
  const why = `${ind.label}: ${fmt(m.prevMetric)}${unit} → ${fmt(m.curMetric)}${unit} (${dirUp === "up" ? "상승" : dirUp === "down" ? "하락" : "보합"}) · 발표 ${m.latest.date}`;
  return { bias, why, latestDate: m.latest.date };
}

const POS = ["beat", "surge", "rally", "gain", "strong", "growth", "optimism", "cooling", "cools", "ease", "dovish", "soft landing", "record high", "upgrade"];
const NEG = ["miss", "fall", "drop", "plunge", "slump", "weak", "fear", "concern", "selloff", "hot", "hawkish", "recession", "downgrade", "layoff", "slowdown", "tumble", "warn"];
async function newsMood(finnhubKey) {
  if (!finnhubKey) return null;
  try {
    const r = await fetch(`https://finnhub.io/api/v1/news?category=general&token=${finnhubKey}`);
    const j = await r.json();
    let arr = Array.isArray(j) ? j : [];
    const cutoff = Date.now() / 1000 - 3 * 86400;
    arr = arr.filter((a) => !a.datetime || a.datetime >= cutoff);
    let pos = 0, neg = 0;
    arr.forEach((a) => {
      const t = ((a.headline || "") + " " + (a.summary || "")).toLowerCase();
      POS.forEach((w) => { if (t.includes(w)) pos++; });
      NEG.forEach((w) => { if (t.includes(w)) neg++; });
    });
    let mood = "중립";
    if (pos > neg * 1.2) mood = "우호적";
    else if (neg > pos * 1.2) mood = "신중";
    return { mood, pos, neg, n: arr.length };
  } catch (e) { return null; }
}

export default async function handler(req, res) {
  const fredKey = process.env.FRED_API_KEY;
  if (!fredKey) return res.status(200).json({ ok: false, noKey: true, message: "FRED_API_KEY 미설정 — 경제지표 평가 생략(일정은 정상 표시)" });
  try {
    const eventBias = {};
    for (const ind of INDICATORS) {
      try {
        const m = await fredLatest(ind.series, fredKey, ind.yoy);
        if (!m) { eventBias[ind.key] = { bias: "neutral", why: `${ind.label}: 데이터 없음`, n: 0 }; continue; }
        eventBias[ind.key] = judge(ind, m);
      } catch (e) {
        eventBias[ind.key] = { bias: "neutral", why: `${ind.label}: 조회 오류`, n: 0 };
      }
    }
    const mood = await newsMood(process.env.FINNHUB_API_KEY);
    res.status(200).json({ ok: true, eventBias, newsMood: mood, at: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ error: "경제지표 평가 오류: " + (e.message || String(e)) });
  }
}
