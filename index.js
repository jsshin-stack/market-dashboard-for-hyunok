// pages/api/favorites.js
// 즐겨찾기 종목 목록을 Redis에 저장/조회. 로그인 기능이 없어 모든 사용자가 같은 목록을 공유.
// GET   /api/favorites            → { ok, tickers: [...] }
// POST  /api/favorites {add:"NVDA"}   또는 {remove:"NVDA"}  → 갱신된 목록 반환
import { Redis } from "@upstash/redis";

let redis = null;
try { redis = Redis.fromEnv(); } catch (e) { redis = null; }

const KEY = "favorites:list";

async function readList() {
  if (!redis) return [];
  try {
    const v = await redis.get(KEY);
    if (!v) return [];
    const arr = typeof v === "string" ? JSON.parse(v) : v;
    return Array.isArray(arr) ? arr : [];
  } catch (e) { return []; }
}
async function writeList(arr) {
  if (!redis) return;
  try { await redis.set(KEY, JSON.stringify(arr)); } catch (e) {}
}

export default async function handler(req, res) {
  if (!redis) return res.status(200).json({ ok: false, noRedis: true, tickers: [], message: "Redis 미연결 — 즐겨찾기 저장 불가" });
  try {
    let list = await readList();
    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      const add = (body.add || "").toString().trim().toUpperCase();
      const remove = (body.remove || "").toString().trim().toUpperCase();
      if (add) { if (!list.includes(add)) list = [...list, add]; }
      if (remove) { list = list.filter((t) => t !== remove); }
      await writeList(list);
    }
    res.status(200).json({ ok: true, tickers: list });
  } catch (e) {
    res.status(500).json({ error: "즐겨찾기 오류: " + (e.message || String(e)) });
  }
}
