// pages/api/econ-calendar.js
// Trading Economics 경제 캘린더 테스트. guest:guest 공개 키로 미국 향후 한 달 일정을 받아본다.
// 응답에 Actual/Forecast/TEForecast/Importance가 들어오는지 확인용.
// 환경변수: (선택) TE_API_KEY = "client:secret" 형식. 없으면 guest:guest 사용.
// 사용법: /api/econ-calendar  (기본: 미국, 오늘~+30일)

export default async function handler(req, res) {
  const key = process.env.TE_API_KEY || "guest:guest";
  const country = (req.query.country || "United States").toString();

  const today = new Date();
  const end = new Date(); end.setDate(end.getDate() + 30);
  const fmt = (d) => d.toISOString().slice(0, 10);
  const d1 = req.query.start || fmt(today);
  const d2 = req.query.end || fmt(end);

  // country/날짜 범위 조회
  const url = `https://api.tradingeconomics.com/calendar/country/${encodeURIComponent(country)}/${d1}/${d2}?c=${encodeURIComponent(key)}&format=json`;

  try {
    const r = await fetch(url);
    const status = r.status;
    const bodyText = await r.text();   // 본문은 한 번만 읽는다
    let data;
    try { data = JSON.parse(bodyText); } catch (e) { data = bodyText; }

    if (!Array.isArray(data)) {
      // 게스트 제한·오류 메시지 등을 그대로 보여줌
      return res.status(200).json({
        ok: false,
        usingKey: key === "guest:guest" ? "guest:guest (샘플 제한 가능)" : "사용자 키",
        httpStatus: status,
        raw: data,
        hint: "미국 데이터가 안 나오면 guest 제한입니다. 무료 가입 키(client:secret)를 TE_API_KEY로 넣어 재시도하세요.",
      });
    }

    // 주요 지표 위주로 요약 (CPI, 고용, FOMC, PCE, PPI, 소매판매, 실업수당, GDP 등)
    const KEY_EVENTS = ["CPI", "Inflation", "Nonfarm", "Payroll", "Unemployment", "Fed", "FOMC", "Interest Rate", "PCE", "PPI", "Producer Price", "Retail Sales", "GDP", "Jobless"];
    const simplified = data.map((e) => ({
      date: e.Date, country: e.Country, event: e.Event, category: e.Category,
      actual: e.Actual, forecast: e.Forecast || e.TEForecast, previous: e.Previous,
      importance: e.Importance, unit: e.Unit,
    }));
    const major = simplified.filter((e) => KEY_EVENTS.some((k) => (e.event || "").toLowerCase().includes(k.toLowerCase())));

    res.status(200).json({
      ok: true,
      usingKey: key === "guest:guest" ? "guest:guest" : "사용자 키",
      country, range: [d1, d2],
      totalEvents: data.length,
      majorCount: major.length,
      major,                    // 주요 지표만
      sampleAll: simplified.slice(0, 8),   // 전체 일부 미리보기
    });
  } catch (e) {
    res.status(500).json({ error: "조회 오류: " + (e.message || String(e)), url });
  }
}
