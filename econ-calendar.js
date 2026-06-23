// pages/api/ff-calendar.js
// ForexFactory(Fair Economy) 주간 경제 캘린더 JSON을 받아 구조를 확인하는 테스트용.
// 무료, 키 불필요. 호출 제한: 5분당 2회 → 테스트 시 자주 누르지 말 것.
// 사용법: /api/ff-calendar  (이번 주 일정 전체 + 미국 이벤트 미리보기)

export default async function handler(req, res) {
  const url = "https://nfs.faireconomy.media/ff_calendar_thisweek.json";
  try {
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (market-dashboard)" } });
    const status = r.status;
    const text = await r.text();

    // 제한 초과 시 HTML("Request Denied")이 올 수 있음 → JSON 파싱 시도
    let data;
    try { data = JSON.parse(text); } catch (e) {
      return res.status(200).json({
        ok: false, httpStatus: status,
        reason: "JSON이 아님(호출 제한 초과 또는 차단 추정)",
        rawPreview: text.slice(0, 300),
      });
    }
    if (!Array.isArray(data)) {
      return res.status(200).json({ ok: false, httpStatus: status, raw: data });
    }

    // 미국(USD) 이벤트만 추려서 미리보기 + 원본 키 구조 노출
    const usd = data.filter((e) => e.country === "USD");
    res.status(200).json({
      ok: true,
      total: data.length,
      usdCount: usd.length,
      sampleKeys: data[0] ? Object.keys(data[0]) : [],   // 실제 필드명 확인용
      usdSample: usd.slice(0, 12),                        // 미국 이벤트 미리보기
    });
  } catch (e) {
    res.status(500).json({ error: "조회 오류: " + (e.message || String(e)) });
  }
}
