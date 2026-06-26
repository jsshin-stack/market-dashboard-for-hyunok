// pages/api/favorites.js
// 즐겨찾기(=보유) 종목을 Redis에 저장/조회. 로그인 기능이 없어 모든 사용자가 같은 목록을 공유.
// 저장 형식: [{ t:"NVDA", buyDate:"2026-01-15", buyPx:120.5 }, ...]
//   - 갈아타기 신호(+20% 익절 / 12개월 경과 / 200일선 이탈)를 주려면 매수일·매수가가 필요.
//   - 예전 형식(문자열 배열 ["NVDA",...])도 읽을 때 자동 변환(buyDate/buyPx는 null).
// GET   /api/favorites                                  -> { ok, items:[...], tickers:[...] }
// POST  /api/favorites { add:"NVDA", buyDate, buyPx }   종목 추가/매수정보 갱신
// POST  /api/favorites { remove:"NVDA" }                종목 삭제
import { Redis } from "@upstash/redis";

let redis = null;
try { redis = Redis.fromEnv(); } catch (e) { redis = null; }

const KEY = "favorites:list";

// 저장값을 항상 [{t, buyDate, buyPx}] 형태로 정규화(예전 문자열 배열 호환)
function normalize(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map((x) => {
    if (typeof x === "string") return { t: x.toUpperCase(), buyDate: null, buyPx: null };
    if (x && typeof x === "object" && x.t) {
      return {
        t: String(x.t).toUpperCase(),
        buyDate: x.buyDate || null,
        buyPx: (x.buyPx != null && !isNaN(parseFloat(x.buyPx))) ? parseFloat(x.buyPx) : null,
      };
    }
    return null;
  }).filter(Boolean);
}

async function readItems() {
  if (!redis) return [];
  try {
    const v = await redis.get(KEY);
    if (!v) return [];
    const arr = typeof v === "string" ? JSON.parse(v) : v;
    return normalize(arr);
  } catch (e) { return []; }
}
async function writeItems(items) {
  if (!redis) return;
  try { await redis.set(KEY, JSON.stringify(items)); } catch (e) {}
}

export default async function handler(req, res) {
  if (!redis) return res.status(200).json({ ok: false, noRedis: true, items: [], tickers: [], message: "Redis 미연결 - 즐겨찾기 저장 불가" });
  try {
    let items = await readItems();
    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      const add = (body.add || "").toString().trim().toUpperCase();
      const remove = (body.remove || "").toString().trim().toUpperCase();
      if (add) {
        const buyDate = body.buyDate ? String(body.buyDate).slice(0, 10) : null;
        const buyPx = (body.buyPx != null && !isNaN(parseFloat(body.buyPx))) ? parseFloat(body.buyPx) : null;
        const idx = items.findIndex((x) => x.t === add);
        if (idx >= 0) {
          if (buyDate !== null) items[idx].buyDate = buyDate;
          if (buyPx !== null) items[idx].buyPx = buyPx;
        } else {
          items = [...items, { t: add, buyDate, buyPx }];
        }
      }
      if (remove) { items = items.filter((x) => x.t !== remove); }
      await writeItems(items);
    }
    res.status(200).json({ ok: true, items, tickers: items.map((x) => x.t) });
  } catch (e) {
    res.status(500).json({ error: "즐겨찾기 오류: " + (e.message || String(e)) });
  }
}
