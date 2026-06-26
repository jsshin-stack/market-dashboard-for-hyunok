// pages/api/trigger-refresh.js
// 화면의 "지금 새로고침" 버튼이 호출하는 가벼운 트리거.
// CRON_SECRET을 클라이언트에 노출하지 않기 위해, 이 서버 사이드 핸들러가
// 내부에서 secret을 붙여 /api/cron-refresh 를 호출한다.
// (cron-refresh는 무거운 수집 작업을 수행 → 이 핸들러는 그 결과를 그대로 전달)
export const maxDuration = 300;

export default async function handler(req, res) {
  try {
    // 자기 자신의 배포 URL 구성 (Vercel은 VERCEL_URL 제공, 로컬은 host 헤더)
    const host = process.env.VERCEL_URL || req.headers.host;
    const proto = host && host.startsWith("localhost") ? "http" : "https";
    const base = `${proto}://${host}`;

    const secret = process.env.CRON_SECRET;
    const headers = {};
    if (secret) headers["authorization"] = `Bearer ${secret}`;

    // force=1 로 호출해 즉시 새 수집을 강제(거래일 안 바뀌어도 부족분 이어받기)
    const r = await fetch(`${base}/api/cron-refresh?force=1`, { headers });
    const j = await r.json().catch(() => ({}));

    if (!r.ok) {
      return res.status(200).json({
        ok: false,
        message: j.error || j.reason || "수집 호출 실패",
        detail: j,
      });
    }
    return res.status(200).json({
      ok: true,
      message: j.message || "수집 완료",
      have: j.have, total: j.total, complete: j.complete,
      collectedThisCall: j.collectedThisCall, asOf: j.asOf,
    });
  } catch (e) {
    return res.status(200).json({ ok: false, message: "수집 오류: " + (e.message || String(e)) });
  }
}
