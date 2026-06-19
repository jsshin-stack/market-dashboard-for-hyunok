// pages/api/ff-events.js
// ForexFactory(Fair Economy) 주간 캘린더로 미국 이벤트 + ±평가를 제공.
// actual 있으면 예상 vs 실제(서프라이즈), 없으면 예상 vs 이전(예상 방향)으로 판정.
// 호출 제한(5분당 2회) 때문에 Redis에 1시간 캐시.
// 키 불필요. (Redis 환경변수는 캐시에만 사용; 없으면 매번 직접 호출)

import { Redis } from "@upstash/redis";

let redis = null;
try { redis = Redis.fromEnv(); } catch (e) { redis = null; }

const FF_URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.json";
const CACHE_KEY = "ff:thisweek";
const CACHE_TTL = 3600;   // 1시간

// 지표 성격: 값이 높을수록 시장에 부정(인플레/금리/실업/청구건수) vs 긍정(고용/판매/생산/심리/주택)
const HIGHER_IS_BAD = ["cpi", "inflation", "price", "ppi", "pce", "unemployment", "jobless", "claims", "rate decision", "interest rate", "fed funds"];
const HIGHER_IS_GOOD = ["payroll", "nonfarm", "employment change", "retail sales", "gdp", "industrial production", "durable goods", "ism", "pmi", "confidence", "sentiment", "housing starts", "building permits", "capacity"];

function num(s) {
  if (s == null || s === "") return null;
  const m = String(s).replace(/,/g, "").match(/-?\d+\.?\d*/);
  return m ? parseFloat(m[0]) : null;
}

function classify(title) {
  const t = title.toLowerCase();
  if (HIGHER_IS_BAD.some((k) => t.includes(k))) return "higher_bad";
  if (HIGHER_IS_GOOD.some((k) => t.includes(k))) return "higher_good";
  return "neutral_type";
}

function judge(ev) {
  const f = num(ev.forecast), p = num(ev.previous), a = num(ev.actual);
  const kind = classify(ev.title);
  // 비교 기준: 실제치 있으면 (실제 vs 예상), 없으면 (예상 vs 이전)
  let basis, ref, label;
  if (a != null && f != null) { basis = a; ref = f; label = "실제 vs 예상"; }
  else if (f != null && p != null) { basis = f; ref = p; label = "예상 vs 이전"; }
  else { return { bias: "neutral", why: `${ev.title}: 비교할 수치 부족`, label: "정보부족" }; }

  const delta = basis - ref;
  const eps = Math.abs(ref) * 0.001 + 1e-9;
  const dir = delta > eps ? "up" : delta < -eps ? "down" : "flat";
  let bias = "neutral";
  if (dir !== "flat" && kind !== "neutral_type") {
    if (kind === "higher_bad") bias = dir === "up" ? "minus" : "plus";
    else bias = dir === "up" ? "plus" : "minus";
  }
  const arrow = dir === "up" ? "↑" : dir === "down" ? "↓" : "→";
  const why = `${label}: ${ref}${ev.forecast && ev.forecast.includes("%") ? "%" : ""} → ${basis}${ev.forecast && ev.forecast.includes("%") ? "%" : ""} ${arrow}`;
  return { bias, why, label };
}

async function fetchFF() {
  const r = await fetch(FF_URL, { headers: { "User-Agent": "Mozilla/5.0 (market-dashboard)" } });
  const text = await r.text();
  let data;
  try { data = JSON.parse(text); } catch (e) { return null; }
  return Array.isArray(data) ? data : null;
}

export default async function handler(req, res) {
  try {
    let data = null;
    // 1시간 캐시 확인
    if (redis) {
      try {
        const cached = await redis.get(CACHE_KEY);
        if (cached) data = typeof cached === "string" ? JSON.parse(cached) : cached;
      } catch (e) { /* 캐시 미스 */ }
    }
    if (!data) {
      data = await fetchFF();
      if (!data) return res.status(200).json({ ok: false, reason: "ForexFactory 응답 파싱 실패(호출 제한 또는 차단). 잠시 후 재시도." });
      if (redis) { try { await redis.set(CACHE_KEY, JSON.stringify(data), { ex: CACHE_TTL }); } catch (e) {} }
    }

    const usd = data.filter((e) => e.country === "USD");
    const events = usd.map((e) => {
      const j = judge(e);
      return {
        title: e.title, date: e.date, impact: e.impact,
        forecast: e.forecast || null, previous: e.previous || null, actual: e.actual || null,
        bias: j.bias, why: j.why, label: j.label,
      };
    });
    // 날짜 오름차순 정렬 (같은 시각이면 영향도 높은 순)
    const rank = { High: 0, Medium: 1, Low: 2, Holiday: 3 };
    events.sort((a, b) => new Date(a.date) - new Date(b.date) || (rank[a.impact] ?? 9) - (rank[b.impact] ?? 9));

    res.status(200).json({ ok: true, count: events.length, events, at: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ error: "FF 이벤트 오류: " + (e.message || String(e)) });
  }
}
