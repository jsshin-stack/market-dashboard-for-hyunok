// pages/api/snapshot.js
// Cron이 저장해둔 최신 스냅샷(전 종목 C1~C7 + 지수 + 확인지표)을 즉시 반환한다.
// 실시간 외부 호출 없음 → 빠르고 한도 소모 없음.

import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

export default async function handler(req, res) {
  try {
    const raw = await redis.get("snapshot:latest");
    if (!raw) return res.status(200).json({ ok: true, empty: true, message: "아직 수집된 스냅샷이 없습니다. Cron 실행 후 채워집니다." });
    // Upstash는 JSON을 객체로 돌려줄 수도, 문자열로 줄 수도 있음 → 둘 다 처리
    const data = typeof raw === "string" ? JSON.parse(raw) : raw;
    res.status(200).json({ ok: true, ...data });
  } catch (e) {
    res.status(500).json({ error: "스냅샷 읽기 오류: " + (e.message || String(e)) });
  }
}
