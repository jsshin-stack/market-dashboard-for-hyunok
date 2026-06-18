// pages/api/cron-refresh.js
// 장 마감 후 하루 1회 Cron으로 실행 → 전 종목 + 섹터 ETF + 지수/지표를 수집해 Upstash(KV)에 저장.
// 이후 사용자는 /api/snapshot 으로 저장된 값을 즉시 읽는다(실시간 호출 없음).
// 분당 8회 제한 대응: 6개씩 묶어 호출하고 배치마다 대기.
// 환경변수: TWELVE_DATA_API_KEY, KV_REST_API_URL, KV_REST_API_TOKEN, (선택) CRON_SECRET

import { Redis } from "@upstash/redis";

// Hobby 플랜 Fluid compute 최대 300초. 한 호출당 ~24종목(약 3분)만 수집하고 이어받기.
export const maxDuration = 300;

const redis = Redis.fromEnv();

// 수집 대상: NDX100 + 주요 SPX 종목 + 섹터 ETF
const NDX_TICKERS = ["NVDA","GOOG","GOOGL","AAPL","MSFT","AMZN","AVGO","TSLA","META","MU","WMT","AMD","ASML","INTC","CSCO","COST","LRCX","ARM","PLTR","AMAT","NFLX","TXN","QCOM","KLAC","LIN","PANW","ADI","STX","TMUS","PEP","APP","WDC","AMGN","CRWD","MRVL","GILD","ISRG","SHOP","HON","BKNG","PDD","SBUX","VRTX","CEG","CDNS","MAR","ADBE","FTNT","SNPS","CMCSA","ADP","INTU","MELI","MNST","CSX","NXPI","DDOG","MPWR","ABNB","MDLZ","ROST","ORLY","DASH","AEP","CTAS","WBD","BKR","REGN","PCAR","FANG","MSTR","MCHP","FAST","EA","XEL","FER","ODFL","EXC","ADSK","IDXX","TTWO","CCEP","KDP","ALNY","PYPL","TRI","PAYX","AXON","WDAY","ROP","CPRT","KHC","GEHC","DXCM","CTSH","TEAM","INSM","VRSK","ZS","CHTR","CSGP"];
const SPX_EXTRA = ["JPM","V","MA","UNH","HD","PG","JNJ","XOM","BAC"];
const SECTOR_ETFS = ["SOXX","XLK","IGV","XLV","XLY"];
const ALL = [...new Set([...NDX_TICKERS, ...SPX_EXTRA, ...SECTOR_ETFS])];

// 이벤트 키워드(영문) — 생성되는 이벤트 이름과 매칭
const EVENT_KEYWORDS = {
  "FOMC": ["fed", "fomc", "powell", "rate decision", "interest rate", "federal reserve"],
  "CPI": ["cpi", "inflation", "consumer price"],
  "PPI": ["ppi", "producer price"],
  "고용보고서": ["jobs report", "nonfarm", "payrolls", "unemployment rate", "labor market"],
  "PCE": ["pce", "core inflation", "personal consumption"],
  "소매판매": ["retail sales", "consumer spending"],
  "실업수당": ["jobless claims", "unemployment claims", "initial claims"],
  "옵션 만기": ["options expiration", "triple witching"],
};
// 감성 사전(시장 맥락) — 긍/부정 단어
const POS_WORDS = ["beat", "beats", "surge", "rally", "gain", "gains", "rise", "rises", "jump", "strong", "growth", "optimism", "upbeat", "cooling", "cools", "ease", "eases", "dovish", "soft landing", "boost", "record high", "outperform", "upgrade"];
const NEG_WORDS = ["miss", "misses", "fall", "falls", "drop", "drops", "plunge", "slump", "weak", "fear", "fears", "concern", "selloff", "sell-off", "hot", "hotter", "hawkish", "recession", "downgrade", "cut", "layoff", "slowdown", "tumble", "warn", "warns"];

// 뉴스 배열에서 특정 이벤트 키워드에 맞는 기사들의 ±판정
function biasForEvent(eventName, news) {
  const keys = Object.keys(EVENT_KEYWORDS).find((k) => eventName.includes(k));
  if (!keys) return { bias: "neutral", why: "관련 키워드 없음 — 중립 처리", n: 0 };
  const kws = EVENT_KEYWORDS[keys];
  const matched = news.filter((a) => {
    const t = ((a.headline || "") + " " + (a.summary || "")).toLowerCase();
    return kws.some((kw) => t.includes(kw));
  });
  if (!matched.length) return { bias: "neutral", why: "최근 관련 뉴스 없음 — 중립", n: 0 };
  let pos = 0, neg = 0;
  matched.forEach((a) => {
    const t = ((a.headline || "") + " " + (a.summary || "")).toLowerCase();
    POS_WORDS.forEach((w) => { if (t.includes(w)) pos++; });
    NEG_WORDS.forEach((w) => { if (t.includes(w)) neg++; });
  });
  let bias = "neutral";
  if (pos > neg * 1.3) bias = "plus";
  else if (neg > pos * 1.3) bias = "minus";
  const why = `최근 뉴스 ${matched.length}건 분석(긍정 ${pos}·부정 ${neg}) → ${bias === "plus" ? "우호적" : bias === "minus" ? "부정적" : "중립적"} 신호`;
  return { bias, why, n: matched.length };
}

async function fetchNews(finnhubKey) {
  if (!finnhubKey) return [];
  try {
    const r = await fetch(`https://finnhub.io/api/v1/news?category=general&token=${finnhubKey}`);
    const j = await r.json();
    return Array.isArray(j) ? j : [];
  } catch (e) { return []; }
}

const BASE = "https://api.twelvedata.com";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

async function timeSeries(symbol, key, size = 260) {
  const url = `${BASE}/time_series?symbol=${encodeURIComponent(symbol)}&interval=1day&outputsize=${size}&timezone=America/New_York&apikey=${key}`;
  const r = await fetch(url);
  const d = await r.json();
  if (d.status === "error" || !d.values) return null;
  return d.values;
}

// 한 종목의 C1~C7 계산 (quote.js와 동일 규칙). idxCloses는 C7용 지수 종가 배열.
function computeScore(values, idx) {
  const closes = values.map((v) => parseFloat(v.close)).filter((n) => !isNaN(n));
  const highs = values.map((v) => parseFloat(v.high)).filter((n) => !isNaN(n));
  const vols = values.map((v) => parseFloat(v.volume)).filter((n) => !isNaN(n));
  const close = closes[0], prevClose = closes[1];
  const ma200 = avg(closes.slice(0, 200));
  const ma20 = avg(closes.slice(0, 20));
  const high52 = highs.length ? Math.max(...highs.slice(0, 252)) : null;
  const high30 = highs.length ? Math.max(...highs.slice(0, 30)) : null;
  const pull = high52 ? ((close - high52) / high52) * 100 : null;
  const fromMA20 = ma20 ? ((close - ma20) / ma20) * 100 : null;
  const dayChg = prevClose ? ((close - prevClose) / prevClose) * 100 : null;

  const c1 = ma200 != null && close > ma200 ? 1 : 0;
  const c2 = pull != null && pull <= -5 && pull >= -18 ? 1 : 0;
  const c3 = c1 && pull != null && pull <= -3 && pull >= -15 ? 1 : 0;
  const c4 = fromMA20 != null && Math.abs(fromMA20) <= 4 ? 1 : 0;
  const c5 = high30 != null && close >= high30 * 0.98 ? 1 : 0;
  let c6 = 0;
  if (vols.length >= 21) {
    const today = vols[0], pastAvg = avg(vols.slice(1, 21));
    if (pastAvg > 0 && today >= pastAvg * 1.5) c6 = 1;
  }
  let c7 = 0;
  if (idx && idx.ma50 != null && idx.close != null && idx.ret20 != null && closes[20]) {
    const stockRet20 = close / closes[20] - 1;
    if (idx.close > idx.ma50 && stockRet20 > idx.ret20) c7 = 1;
  }
  const c = [c1, c2, c3, c4, c5, c6, c7];
  return {
    close: +close.toFixed(2),
    asOf: values[0] ? values[0].datetime : null,
    dayChg: dayChg != null ? +dayChg.toFixed(2) : null,
    pull: pull != null ? +pull.toFixed(1) : null,
    c, score: c.reduce((a, b) => a + b, 0),
  };
}

export default async function handler(req, res) {
  // Cron 인증(선택): CRON_SECRET이 설정돼 있으면 헤더 검사
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers["authorization"];
    if (auth !== `Bearer ${secret}`) return res.status(401).json({ error: "unauthorized" });
  }
  const key = process.env.TWELVE_DATA_API_KEY;
  if (!key) return res.status(500).json({ error: "TWELVE_DATA_API_KEY 미설정" });

  const force = req.query && (req.query.force === "1" || req.query.force === "true");
  const CHUNK = 24;   // 한 호출당 수집 종목 수 (4배치×62초 ≈ 3분, Hobby 5분 한도 내 안전)

  try {
    // 최신 거래일 확인 (QQQ 1회) + C7 기준
    const qqq = await timeSeries("QQQ", key, 280);
    let idxRef = null, latestDay = null;
    if (qqq) {
      const closes = qqq.map((v) => parseFloat(v.close)).filter((n) => !isNaN(n));
      idxRef = { close: closes[0], ma50: avg(closes.slice(0, 50)), ret20: closes[20] ? (closes[0] / closes[20] - 1) : null };
      latestDay = qqq[0] ? qqq[0].datetime : null;
    }

    // 기존 스냅샷 로드
    let snap = null;
    try {
      const existing = await redis.get("snapshot:latest");
      if (existing) snap = typeof existing === "string" ? JSON.parse(existing) : existing;
    } catch (e) { /* 없으면 새로 */ }

    // 거래일이 바뀌었거나 force면 새 수집 시작(기존 종목 비움)
    const sameDay = snap && snap.asOf === latestDay && !force;
    let stocks = sameDay ? (snap.stocks || {}) : {};

    // 이미 다 받았으면 스킵 (force 아닐 때)
    if (sameDay && !force) {
      const have = ALL.filter((s) => stocks[s]).length;
      if (have >= ALL.length) {
        return res.status(200).json({ ok: true, done: true, have, total: ALL.length, asOf: latestDay, reason: "이미 전 종목 수집 완료" });
      }
    }

    // 아직 안 받은 종목만 추려서 이번 호출 분(CHUNK)만 수집
    const remaining = ALL.filter((s) => !stocks[s]);
    const todo = remaining.slice(0, CHUNK);
    let ok = 0, fail = 0;
    for (let i = 0; i < todo.length; i += 6) {
      const batch = todo.slice(i, i + 6);
      await Promise.all(batch.map(async (sym) => {
        try {
          const vals = await timeSeries(sym, key, 260);
          if (vals) { stocks[sym] = computeScore(vals, idxRef); ok++; }
          else fail++;
        } catch (e) { fail++; }
      }));
      if (i + 6 < todo.length) await sleep(62000);   // 분당 8크레딧 보호
    }

    // 지수/확인지표 + 이벤트는 매 호출 갱신(가벼움)
    const macro = await buildMacro(key, idxRef);
    const finnhubKey = process.env.FINNHUB_API_KEY;
    const news = await fetchNews(finnhubKey);
    const eventBias = {};
    Object.keys(EVENT_KEYWORDS).forEach((type) => { eventBias[type] = biasForEvent(type, news); });

    const haveNow = ALL.filter((s) => stocks[s]).length;
    const snapshot = {
      updatedAt: new Date().toISOString(),
      asOf: latestDay,
      stockCount: haveNow, failCount: fail,
      complete: haveNow >= ALL.length,
      stocks, macro, eventBias, newsCount: news.length,
    };
    await redis.set("snapshot:latest", JSON.stringify(snapshot));

    return res.status(200).json({
      ok: true, asOf: latestDay,
      collectedThisCall: ok, failedThisCall: fail,
      have: haveNow, total: ALL.length,
      complete: snapshot.complete,
      message: snapshot.complete ? "전 종목 수집 완료" : `진행 중: ${haveNow}/${ALL.length} (다음 호출에서 이어받기)`,
    });
  } catch (e) {
    return res.status(500).json({ error: "수집 오류: " + (e.message || String(e)) });
  }
}

// 지수·확인지표 수집 (macro.js 로직 축약)
async function buildMacro(key, idxRef) {
  const out = { idx: {}, confirm: {} };
  const plan = [
    { k: "NDX", syms: ["NDX", "QQQ"] },
    { k: "SPX", syms: ["SPX", "GSPC", "SPY"] },
  ];
  for (const { k, syms } of plan) {
    let s = null, used = null;
    for (const sym of syms) {
      const v = await timeSeries(sym, key, 280);
      if (v) { s = v.map((x) => parseFloat(x.close)).filter((n) => !isNaN(n)); used = sym; if (s.length > 100) break; }
    }
    if (!s) { out.idx[k] = { error: "no data" }; continue; }
    const close = s[0], ma = avg(s.slice(0, 200)), maOld = avg(s.slice(20, 220));
    const ago = s[Math.min(251, s.length - 1)];
    const roc = ago ? +(((close - ago) / ago) * 100).toFixed(1) : null;
    if (roc != null) { if (k === "NDX") out.confirm.rocNDX = roc; else out.confirm.rocSPX = roc; }
    out.idx[k] = {
      close: +close.toFixed(2), source: used, isProxy: used !== k && used !== "GSPC",
      prevDay: s[1] != null ? +s[1].toFixed(2) : null,
      prevWeek: s[5] != null ? +s[5].toFixed(2) : null,
      prevMonth: s[21] != null ? +s[21].toFixed(2) : null,
      maVal: ma != null ? +ma.toFixed(2) : null,
      gapPct: ma ? +(((close - ma) / ma) * 100).toFixed(2) : null,
      slopePct: ma && maOld ? +(((ma - maOld) / maOld) * 100).toFixed(2) : null,
      roc12m: roc,
    };
  }
  // VIX(→VIXY 프록시), HYG
  for (const sym of ["VIX", "VIXY"]) {
    const v = await timeSeries(sym, key, 10);
    if (v) {
      const c = v.map((x) => parseFloat(x.close)).filter((n) => !isNaN(n));
      out.confirm.vix = +c[0].toFixed(2);
      out.confirm.vixPrev = c[5] != null ? +c[5].toFixed(2) : null;
      out.confirm.vixSource = sym; out.confirm.vixProxy = sym !== "VIX";
      break;
    }
  }
  const hyg = await timeSeries("HYG", key, 25);
  if (hyg) {
    const c = hyg.map((x) => parseFloat(x.close)).filter((n) => !isNaN(n));
    out.confirm.hyg20 = c[20] ? +(((c[0] - c[20]) / c[20]) * 100).toFixed(2) : null;
  }
  return out;
}
