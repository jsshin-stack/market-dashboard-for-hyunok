// pages/api/event-bias.js
// 이벤트 탭을 열 때 호출 → Finnhub 최신 시장 뉴스를 받아 이벤트 타입별 ±평가를 실시간 계산.
// 일정 자체는 프론트에서 자동 생성하고, 여기서는 '평가'만 제공한다.
// 환경변수: FINNHUB_API_KEY

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
const POS_WORDS = ["beat", "beats", "surge", "rally", "gain", "gains", "rise", "rises", "jump", "strong", "growth", "optimism", "upbeat", "cooling", "cools", "ease", "eases", "dovish", "soft landing", "boost", "record high", "outperform", "upgrade"];
const NEG_WORDS = ["miss", "misses", "fall", "falls", "drop", "drops", "plunge", "slump", "weak", "fear", "fears", "concern", "selloff", "sell-off", "hot", "hotter", "hawkish", "recession", "downgrade", "cut", "layoff", "slowdown", "tumble", "warn", "warns"];

function biasForEvent(type, news) {
  const kws = EVENT_KEYWORDS[type];
  if (!kws) return { bias: "neutral", why: "키워드 없음 — 중립", n: 0 };
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

export default async function handler(req, res) {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) return res.status(200).json({ ok: true, noKey: true, eventBias: {}, message: "FINNHUB_API_KEY 미설정 — 평가 생략(일정은 정상 표시)" });
  try {
    const r = await fetch(`https://finnhub.io/api/v1/news?category=general&token=${key}`);
    const news = await r.json();
    let arr = Array.isArray(news) ? news : [];
    // 최근 3일치만 사용 (datetime은 유닉스 초)
    const cutoff = Date.now() / 1000 - 3 * 86400;
    arr = arr.filter((a) => !a.datetime || a.datetime >= cutoff);
    const eventBias = {};
    Object.keys(EVENT_KEYWORDS).forEach((type) => { eventBias[type] = biasForEvent(type, arr); });
    res.status(200).json({ ok: true, eventBias, newsCount: arr.length, at: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ error: "뉴스 조회 오류: " + (e.message || String(e)) });
  }
}
