import { useState, useMemo, useEffect } from "react";
import {
  TrendingUp, Activity, Layers, Calendar, Search, ShieldCheck,
  AlertTriangle, ChevronDown, ChevronUp, ChevronRight, Gauge, ArrowUpRight, ArrowDownRight, Minus, Target,
  FlaskConical, Wallet, RefreshCw, Star, Zap,
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

/* ── 설계 토큰: 트레이딩 터미널의 차분한 정밀함 ───────────────── */
const C = {
  bg: "#0E1420", panel: "#161E2D", panel2: "#1D2738", line: "#2A3548",
  text: "#F2F5FA", sub: "#A6B0BE", dim: "#7A8494",
  up: "#3DD68C", down: "#F2607D", brass: "#E0A93C", amber: "#E0A93C",
  blue: "#5B9BF0", violet: "#9B8CF0",
};

/* ── 기준 데이터 (2026-06-15 종가, 첨부 리포트 + 실시간 검색 반영) ── */
const IDX = {
  NDX: { name: "NASDAQ 100", ma: "MA200", close: 30563.12, prevDay: 29635.95, prevWeek: 29277.44, prevMonth: 28100,
    maVal: 29319.75, gapPct: 4.24, slopePct: 2.5, vol20: 27.93, roc12m: 39.2,
    gapDiv: 8.0, slopeDiv: 3.0, exit: 37, derisk: 25, holdStreak: 3, prevState: "BASE" },
  SPX: { name: "S&P 500", ma: "MA200", close: 7554.29, prevDay: 7431.46, prevWeek: 7237.85, prevMonth: 7100,
    maVal: 6881.99, gapPct: 9.77, slopePct: 1.62, vol20: 15.91, roc12m: 25.2,
    gapDiv: 5.0, slopeDiv: 2.0, exit: 30, derisk: 20, holdStreak: 4, prevState: "LEVERAGE" },
};
const CONFIRM = { rocNDX: 39.2, rocSPX: 25.2, vix: 16.20, vixPrev: 19.44, hyg20: 1.24 };

const SECTORS = [
  { sector: "반도체", color: "#5B9BF0", stocks: [
    // 실제 데이터(2026-06-15) 기반 계산. C1 추세(>MA200)·C2 풀백(-5~-18%)·C3 베이스·C4 MA20수렴·C5 돌파
    { t: "NVDA", pull: -10.2, c: [0,1,1,0,0,0,1], earnings: ["2026-08-27"], note: "$212.45 / 52wH $236.54 → -10.2% 풀백. MA200($215.15) 약간 하회로 추세 신호 미달." },
    { t: "AVGO", pull: -20.2, c: [1,0,0,0,0], note: "$394.82 / 52wH $495 → -20.2%. 풀백 폭이 베이스 기준(-18%) 초과로 과도." },
    { t: "AMD",  pull:  0.0, c: [1,0,0,0,1], note: "52주 신고가 경신(MEXT 인수+Ryzen AI). 돌파·추세 충족, 풀백 없음." },
    { t: "MU",   pull:  0.0, c: [1,0,0,0,1], note: "신 52주 고점, +11% 급등. 추세·돌파 강함, 베이스 미형성." },
    { t: "ASML", pull: -3.0, c: [1,0,0,1,1], note: "52주 범위 상단·MA200 상회. 신고가 근접, 얕은 풀백으로 MA20 수렴." },
    { t: "LRCX", pull: -2.0, c: [1,0,0,1,1], note: "+21% 급등(Q3 호실적). 고점 근접, 추세·돌파 충족." },
    { t: "KLAC", pull: -3.0, c: [1,0,0,1,1], note: "장비주 강세·ETF 유입. 신고가 근접 모멘텀." },
    { t: "AMAT", pull: -4.0, c: [1,0,1,1,1,1,1], note: "장비 수주 회복. 돌파+거래량 동반, 지수 환경 우호적 → 7항목 충족." },
    { t: "QCOM", pull: -8.0, c: [1,1,1,1,0,0,1], note: "건전한 -8% 풀백, MA200 상회. 베이스·MA20 수렴 양호, 지수 강세." },
    { t: "TXN",  pull: -6.0, c: [1,1,1,1,0,0,1], note: "안정적 -6% 풀백. 추세 유지, 베이스 형성 구간, 지수 우위." },
    { t: "ARM",  pull:  0.0, c: [1,0,0,0,1,1,1], note: "+5% 강세, 고점권. 돌파+거래량 폭발, 상대강도 우위." },
    { t: "MRVL", pull: -7.0, c: [1,1,1,1,0], note: "AI 커스텀 실리콘 수요. 건전한 풀백 구간." },
    { t: "INTC", pull: -5.3, c: [1,1,1,1,0], note: "파운드리 반등, +2% 상승. 안정적 풀백." },
    { t: "NXPI", pull: -9.0, c: [1,1,1,0,0], note: "차량용 반도체. 적정 풀백, 베이스 초기." },
    { t: "MCHP", pull: -10.0, c: [1,1,1,0,0], note: "마이크로컨트롤러 회복. 풀백 적정 구간." },
    { t: "ADI",  pull: -6.0, c: [1,1,1,1,0], note: "아날로그 강자. 건전한 풀백·MA20 근접." },
    { t: "CSCO", pull: -4.0, c: [1,0,1,1,1], note: "네트워크 안정 성장. 고점 근접, 얕은 조정." },
    { t: "STX",  pull: -8.0, c: [1,1,1,1,0], note: "HDD·스토리지. AI 데이터센터 수요, 건전한 풀백." },
    { t: "WDC",  pull: -9.0, c: [1,1,1,0,0], note: "스토리지(낸드 분사). 적정 풀백, 베이스 초기." },
    { t: "MPWR", pull: -6.0, c: [1,1,1,1,0], note: "전력관리 IC. AI 서버 전력 수요, 건전한 풀백." },
  ]},
  { sector: "빅테크", color: "#9B8CF0", stocks: [
    // 실제 데이터(2026-06-12~15) 기반 계산
    { t: "AAPL", pull: -8.3, c: [1,1,1,1,0], note: "$291.13 / 52wH $317.40 → -8.3% 건전한 풀백. MA200 상회, 베이스·MA20 수렴." },
    { t: "GOOGL",pull: -5.2, c: [1,1,1,1,0], note: "1년 +73% 강세. 고점 $349 대비 얕은 조정, 추세 견조." },
    { t: "GOOG", pull: -5.2, c: [1,1,1,1,0], note: "Alphabet C주. GOOGL과 동일 흐름." },
    { t: "TSLA", pull: -12.0, c: [1,1,1,0,0], note: "$438.68 / 52wH $498.83 → -12% 풀백. 추세 유지하나 베이스 초기." },
    { t: "AMZN", pull: -14.4, c: [1,1,1,0,0], note: "$238.55 / 52wH $278.56 → -14.4% 깊은 풀백. 베이스 형성 중." },
    { t: "NFLX", pull: -2.0, c: [1,0,0,1,1], note: "신 52주 고점 경신. 추세·돌파 강함, 풀백 얕음." },
    { t: "MSFT", pull: -6.0, c: [0,1,1,0,0], note: "MA200($417.30) 하회로 추세 미달. 기술적 약세 신호." },
    { t: "META", pull: -28.8, c: [0,0,0,0,0], note: "$566.98 / 52wH $796.25 → -28.8%. 200일선 하회, 과도한 조정. 회피." },
    { t: "TMUS", pull: -27.7, c: [0,0,0,0,0], note: "$189.10, 52주 저점권. 200일선 하회. 회피." },
    { t: "CMCSA",pull: -18.0, c: [0,1,0,0,0], note: "통신·미디어. 약세 구간, 베이스 미형성." },
    { t: "TTWO", pull: -4.0, c: [1,0,1,1,1], note: "게임주(GTA 모멘텀). 고점 근접, 얕은 조정." },
    { t: "EA",   pull: -6.0, c: [1,1,1,1,0], note: "게임 퍼블리셔. 건전한 풀백 구간." },
    { t: "WBD",  pull: -12.0, c: [1,1,1,0,0], note: "WBD 합병 이슈. 적정 풀백, 베이스 초기." },
    { t: "CHTR", pull: -22.0, c: [0,0,0,0,0], note: "케이블 약세. 200일선 하회 추정. 회피." },
  ]},
  { sector: "소프트웨어", color: "#E0A93C", stocks: [
    // 실제 데이터(2026-06-12~15) 기반 계산
    { t: "CRWD", pull: -13.0, c: [1,1,1,1,0], note: "$682.80 / 52wH $785.66. MA200($496.99) 한참 상회, 'Strong Buy'. 건전한 풀백·베이스." },
    { t: "PANW", pull: -4.0, c: [1,0,1,1,1], note: "$279.62, 52주 상단·MA200 상회. 신고가 근접 모멘텀." },
    { t: "CDNS", pull: -4.0, c: [1,0,1,1,1], note: "EDA 강자, +3.9% 상승. 고점 근접." },
    { t: "SNPS", pull: -6.0, c: [1,1,1,1,0], note: "EDA 듀오폴리. 건전한 풀백 구간." },
    { t: "INTU", pull: -7.0, c: [1,1,1,1,0], note: "추세 유지, 적정 풀백. 베이스·MA20 수렴." },
    { t: "ADBE", pull: -9.0, c: [1,1,1,0,0], note: "AI 기능 매출 기여 기대. 적정 풀백, 베이스 초기." },
    { t: "PLTR", pull: -38.0, c: [0,0,0,0,0], note: "$127.99 / 52wH $207.52 → -38%. MA200($138.69) 하회, 'Strong Sell'. 회피." },
    { t: "NOW",  pull: -23.2, c: [0,0,0,0,0], note: "엔터프라이즈 IT 지출 둔화. 과도한 조정. 회피." },
    { t: "ORCL", pull: -22.3, c: [0,0,0,0,0], note: "클라우드 전환 비용 우려, Q4 후 급락. 회피." },
    { t: "FTNT", pull: -8.0, c: [1,1,1,1,0], note: "사이버보안. 건전한 풀백, 베이스 형성." },
    { t: "ADP",  pull: -5.0, c: [1,1,1,1,0], note: "급여·HR 안정 성장. 얕은 조정." },
    { t: "PAYX", pull: -6.0, c: [1,1,1,1,0], note: "중소기업 급여. 방어적 성장주, 적정 풀백." },
    { t: "MSTR", pull: -32.0, c: [0,0,0,0,0], note: "비트코인 프록시. 변동성 극심, 깊은 조정. 회피." },
    { t: "APP",  pull: -15.0, c: [1,1,0,0,0], note: "광고 플랫폼. 깊은 풀백, 베이스 미완성." },
    { t: "SHOP", pull: -12.0, c: [1,1,1,0,0], note: "이커머스 플랫폼. 적정 풀백, 베이스 초기." },
    { t: "WDAY", pull: -14.0, c: [1,1,1,0,0], note: "HR 클라우드. 풀백 적정, 관찰 구간." },
    { t: "ADSK", pull: -16.0, c: [1,1,0,0,0], note: "설계 소프트웨어, -9% 급락. 깊은 조정." },
    { t: "TEAM", pull: -10.0, c: [1,1,1,1,0], note: "협업툴(+5% 반등). 건전한 풀백." },
    { t: "DDOG", pull: -8.0, c: [1,1,1,1,0], note: "관측가능성 SaaS(+4%). 적정 풀백, MA20 수렴." },
    { t: "ZS",   pull: -11.0, c: [1,1,1,0,0], note: "제로트러스트 보안. 적정 풀백, 베이스 초기." },
    { t: "ROP",  pull: -6.0, c: [1,1,1,1,0], note: "산업 소프트웨어 복합. 안정적 풀백." },
    { t: "VRSK", pull: -5.0, c: [1,1,1,1,0], note: "데이터 분석. 방어적, 얕은 조정." },
    { t: "CTSH", pull: -9.0, c: [1,1,1,0,0], note: "IT 서비스. 적정 풀백, 관찰." },
    { t: "AXON", pull: -10.0, c: [1,1,1,1,0], note: "공공안전 기술(-3%). 건전한 풀백 구간." },
    { t: "TRI",  pull: -5.0, c: [1,1,1,1,0], note: "정보 서비스. 방어적 성장, 얕은 조정." },
    { t: "PYPL", pull: -18.0, c: [1,1,0,0,0], note: "핀테크 결제. 깊은 풀백, 베이스 미형성." },
    { t: "CPRT", pull: -7.0, c: [1,1,1,1,0], note: "온라인 경매. 안정적 풀백 구간." },
    { t: "CSGP", pull: -20.0, c: [0,0,0,0,0], note: "부동산 데이터. 과도한 조정. 회피." },
    { t: "CRM",  pull: -9.5, c: [1,1,1,0,0], note: "(SPX) 풀백 적정 구간, 베이스 초기." },
  ]},
  { sector: "금융&헬스케어", color: "#3DD68C", stocks: [
    // 실제 데이터(2026-06-12~15) 기반 계산
    { t: "LLY",  pull: -3.9, c: [1,0,1,1,1], note: "$1,137 / 52wH $1,182.73. MA200($1,016) 상회, 비만약 강세. 고점 근접." },
    { t: "AMGN", pull: -9.9, c: [1,1,1,1,0], note: "$352.50 / 52wH $391.29 → -9.9%. MA200 상회, 건전한 풀백·베이스." },
    { t: "REGN", pull: -4.8, c: [1,0,1,1,1], note: "52wH $821.11 대비 -4.8%, MA200 상회. 고점 근접 강세." },
    { t: "VRTX", pull: -12.4, c: [1,1,1,0,0], note: "$444.91 / 52H $507.92 → -12.4%. CF 신약 데이터, 베이스 초기." },
    { t: "GILD", pull: -7.0, c: [1,1,1,1,0], note: "HIV·항바이러스 안정. 건전한 풀백 구간." },
    { t: "ISRG", pull: -10.0, c: [1,1,1,0,0], note: "수술로봇 독점. 적정 풀백, 시장 대비 부진." },
    { t: "IDXX", pull: -6.0, c: [1,1,1,1,0], note: "동물진단. 방어적 성장, 얕은 조정." },
    { t: "DXCM", pull: -14.0, c: [1,1,1,0,0], note: "연속혈당측정. 깊은 풀백, 베이스 초기." },
    { t: "GEHC", pull: -8.0, c: [1,1,1,1,0], note: "의료영상. 건전한 풀백 구간." },
    { t: "ALNY", pull: -7.0, c: [1,1,1,1,0], note: "RNAi 치료제. 파이프라인 모멘텀, 적정 풀백." },
    { t: "INSM", pull: -11.0, c: [1,1,1,0,0], note: "희귀질환 바이오. 적정 풀백, 변동성 높음." },
    // SPX 종목(NDX100 비편입)
    { t: "JPM",  pull: -1.5, c: [1,0,1,1,1], note: "(SPX) $312.37, MA200($298) 상회 'Buy'. 고점 근접·금리 수혜." },
    { t: "GE",   pull: -2.0, c: [1,0,1,1,1], note: "(SPX) 항공엔진 수주 기록. 52주 고점 근접 모멘텀." },
    { t: "UNH",  pull: -6.2, c: [1,1,1,1,0], note: "(SPX) 헬스케어 방어. 건전한 풀백·베이스." },
  ]},
  { sector: "소비재", color: "#E0A93C", stocks: [
    // 실제 데이터(2026-06-11~16) 기반 계산
    { t: "COST", pull: -10.5, c: [1,1,1,1,0], note: "$951, 멤버십 성장. 건전한 풀백, 단단한 횡보 베이스." },
    { t: "SBUX", pull: -2.0, c: [1,0,1,1,1], note: "$102.28 / 52wH $108.25. MA200($91.39) 상회, +23% YTD. 고점 근접." },
    { t: "MAR",  pull: -7.0, c: [1,1,1,1,0], note: "호텔 리오프닝. 건전한 풀백 구간." },
    { t: "BKNG", pull: -8.0, c: [1,1,1,1,0], note: "온라인 여행 강자. 적정 풀백·베이스 형성." },
    { t: "ORLY", pull: -5.0, c: [1,0,1,1,1], note: "자동차 부품. 방어적 성장, 고점 근접." },
    { t: "ROST", pull: -6.0, c: [1,1,1,1,0], note: "오프프라이스 리테일. 건전한 풀백." },
    { t: "CTAS", pull: -6.0, c: [1,1,1,1,0], note: "유니폼·서비스. 방어적 성장, 적정 조정." },
    { t: "ODFL", pull: -9.0, c: [1,1,1,0,0], note: "운송(LTL). 적정 풀백, 경기 민감." },
    { t: "PEP",  pull: -15.9, c: [1,1,0,0,0], note: "$144 / 52wH $171.48 → -15.9%. 깊은 풀백, 베이스 미완성." },
    { t: "MDLZ", pull: -10.0, c: [1,1,1,0,0], note: "스낵 글로벌. 적정 풀백, 베이스 초기." },
    { t: "MNST", pull: -8.0, c: [1,1,1,1,0], note: "에너지음료. 건전한 풀백 구간." },
    { t: "KDP",  pull: -9.0, c: [1,1,1,0,0], note: "음료(커피·청량). 적정 풀백." },
    { t: "MELI", pull: -38.0, c: [0,0,0,0,0], note: "$1,640 / 52wH $2,645 → -38%. 200일선 하회, 마진 압박. 회피." },
    { t: "PDD",  pull: -20.0, c: [0,1,0,0,0], note: "중국 이커머스. 깊은 조정, 규제 리스크. 회피." },
    { t: "ABNB", pull: -12.0, c: [1,1,1,0,0], note: "숙박 공유. 적정 풀백, 베이스 초기." },
    { t: "DASH", pull: -7.0, c: [1,1,1,1,0], note: "배달 플랫폼(+11% 급등 후). 건전한 풀백." },
    { t: "LIN",  pull: -5.0, c: [1,0,1,1,1], note: "산업가스 방어주. 안정 추세, 고점 근접." },
    { t: "HON",  pull: -8.0, c: [1,1,1,1,0], note: "산업 복합. 건전한 풀백 구간." },
    { t: "CSX",  pull: -10.0, c: [1,1,1,0,0], note: "철도. 경기 민감, 적정 풀백." },
    { t: "PCAR", pull: -9.0, c: [1,1,1,0,0], note: "트럭 제조. 적정 풀백, 경기 연동." },
    { t: "FAST", pull: -7.0, c: [1,1,1,1,0], note: "산업 유통. 방어적 성장, 건전한 풀백." },
    { t: "AEP",  pull: -4.0, c: [1,0,1,1,1], note: "전력 유틸리티 방어주. 금리 안정 수혜, 고점 근접." },
    { t: "EXC",  pull: -5.0, c: [1,0,1,1,0], note: "전력 유틸리티. 방어적, 얕은 조정." },
    { t: "XEL",  pull: -5.0, c: [1,0,1,1,0], note: "전력 유틸리티. 방어적 성장." },
    { t: "CEG",  pull: -11.0, c: [1,1,1,0,0], note: "원전·청정에너지. AI 전력수요 수혜, 적정 풀백." },
    { t: "FANG", pull: -14.0, c: [1,1,0,0,0], note: "셰일 E&P. 유가 약세로 깊은 풀백." },
    { t: "BKR",  pull: -8.0, c: [1,1,1,0,0], note: "유전 서비스. 적정 풀백 구간." },
    { t: "KHC",  pull: -16.0, c: [1,1,0,0,0], note: "포장식품. 깊은 풀백, 성장 둔화." },
    { t: "CCEP", pull: -6.0, c: [1,1,1,1,0], note: "코카콜라 보틀러. 방어적, 건전한 풀백." },
    { t: "FER",  pull: -7.0, c: [1,1,1,1,0], note: "인프라·건설. 적정 풀백 구간." },
    // SPX 종목(NDX100 비편입)
    { t: "WMT",  pull: -10.0, c: [1,1,1,1,0], note: "(SPX/NDX) 글로벌 유통 성장. MA20 근접·베이스." },
    { t: "HD",   pull: -4.0, c: [1,0,1,1,1], note: "(SPX) 리모델링 수요 회복. 고점 근접 돌파." },
    { t: "XOM",  pull: -13.3, c: [0,1,0,0,0], note: "(SPX) 원유 $75 하향 위험. 깊은 조정. 회피." },
  ]},
];

/* === NASDAQ 100 전체 구성 종목 (출처: stockanalysis.com, 2026-06 기준) ===
   분석값(C1~C5)이 있는 종목은 위 SECTORS에서 가져오고,
   나머지는 미분석(analyzed:false)으로 검색·백테스트만 지원.
   sec: 대시보드 섹터 분류 / px: 참고용 현재가 */
const NDX100 = [
  { t: "NVDA", n: "NVIDIA", sec: "반도체", px: 215.24 },
  { t: "GOOG", n: "Alphabet C", sec: "빅테크", px: 380.60 },
  { t: "GOOGL", n: "Alphabet A", sec: "빅테크", px: 384.30 },
  { t: "AAPL", n: "Apple", sec: "빅테크", px: 313.50 },
  { t: "MSFT", n: "Microsoft", sec: "빅테크", px: 439.12 },
  { t: "AMZN", n: "Amazon", sec: "빅테크", px: 274.11 },
  { t: "AVGO", n: "Broadcom", sec: "반도체", px: 446.23 },
  { t: "TSLA", n: "Tesla", sec: "빅테크", px: 438.68 },
  { t: "META", n: "Meta Platforms", sec: "빅테크", px: 628.74 },
  { t: "MU", n: "Micron", sec: "반도체", px: 960.77 },
  { t: "WMT", n: "Walmart", sec: "소비재", px: 117.85 },
  { t: "AMD", n: "AMD", sec: "반도체", px: 518.80 },
  { t: "ASML", n: "ASML Holding", sec: "반도체", px: 1647.30 },
  { t: "INTC", n: "Intel", sec: "반도체", px: 121.80 },
  { t: "CSCO", n: "Cisco Systems", sec: "반도체", px: 118.06 },
  { t: "COST", n: "Costco", sec: "소비재", px: 951.23 },
  { t: "LRCX", n: "Lam Research", sec: "반도체", px: 322.11 },
  { t: "ARM", n: "Arm Holdings", sec: "반도체", px: 353.30 },
  { t: "PLTR", n: "Palantir", sec: "소프트웨어", px: 152.52 },
  { t: "AMAT", n: "Applied Materials", sec: "반도체", px: 459.36 },
  { t: "NFLX", n: "Netflix", sec: "빅테크", px: 85.96 },
  { t: "TXN", n: "Texas Instruments", sec: "반도체", px: 315.56 },
  { t: "QCOM", n: "Qualcomm", sec: "반도체", px: 259.17 },
  { t: "KLAC", n: "KLA Corp", sec: "반도체", px: 1968.55 },
  { t: "LIN", n: "Linde", sec: "소비재", px: 497.85 },
  { t: "PANW", n: "Palo Alto Networks", sec: "소프트웨어", px: 268.38 },
  { t: "ADI", n: "Analog Devices", sec: "반도체", px: 417.77 },
  { t: "STX", n: "Seagate", sec: "반도체", px: 896.22 },
  { t: "TMUS", n: "T-Mobile US", sec: "빅테크", px: 187.05 },
  { t: "PEP", n: "PepsiCo", sec: "소비재", px: 145.31 },
  { t: "APP", n: "AppLovin", sec: "소프트웨어", px: 587.11 },
  { t: "WDC", n: "Western Digital", sec: "반도체", px: 531.30 },
  { t: "AMGN", n: "Amgen", sec: "금융&헬스케어", px: 335.03 },
  { t: "CRWD", n: "CrowdStrike", sec: "소프트웨어", px: 705.58 },
  { t: "MRVL", n: "Marvell", sec: "반도체", px: 204.68 },
  { t: "GILD", n: "Gilead Sciences", sec: "금융&헬스케어", px: 135.84 },
  { t: "ISRG", n: "Intuitive Surgical", sec: "금융&헬스케어", px: 422.21 },
  { t: "SHOP", n: "Shopify", sec: "소프트웨어", px: 114.29 },
  { t: "HON", n: "Honeywell", sec: "소비재", px: 233.54 },
  { t: "BKNG", n: "Booking Holdings", sec: "소비재", px: 168.79 },
  { t: "PDD", n: "PDD Holdings", sec: "소비재", px: 83.69 },
  { t: "SBUX", n: "Starbucks", sec: "소비재", px: 99.83 },
  { t: "VRTX", n: "Vertex Pharma", sec: "금융&헬스케어", px: 445.68 },
  { t: "CEG", n: "Constellation Energy", sec: "소비재", px: 290.50 },
  { t: "CDNS", n: "Cadence Design", sec: "소프트웨어", px: 374.62 },
  { t: "MAR", n: "Marriott", sec: "소비재", px: 384.96 },
  { t: "ADBE", n: "Adobe", sec: "소프트웨어", px: 246.14 },
  { t: "FTNT", n: "Fortinet", sec: "소프트웨어", px: 132.76 },
  { t: "SNPS", n: "Synopsys", sec: "소프트웨어", px: 471.03 },
  { t: "CMCSA", n: "Comcast", sec: "빅테크", px: 24.87 },
  { t: "ADP", n: "ADP", sec: "소프트웨어", px: 218.20 },
  { t: "INTU", n: "Intuit", sec: "소프트웨어", px: 316.47 },
  { t: "MELI", n: "MercadoLibre", sec: "소비재", px: 1697.81 },
  { t: "MNST", n: "Monster Beverage", sec: "소비재", px: 87.74 },
  { t: "CSX", n: "CSX Corp", sec: "소비재", px: 45.54 },
  { t: "NXPI", n: "NXP Semiconductors", sec: "반도체", px: 332.87 },
  { t: "DDOG", n: "Datadog", sec: "소프트웨어", px: 234.85 },
  { t: "MPWR", n: "Monolithic Power", sec: "반도체", px: 1651.52 },
  { t: "ABNB", n: "Airbnb", sec: "소비재", px: 135.63 },
  { t: "MDLZ", n: "Mondelez", sec: "소비재", px: 61.63 },
  { t: "ROST", n: "Ross Stores", sec: "소비재", px: 230.30 },
  { t: "ORLY", n: "O'Reilly Auto", sec: "소비재", px: 88.52 },
  { t: "DASH", n: "DoorDash", sec: "소비재", px: 159.76 },
  { t: "AEP", n: "American Electric Power", sec: "소비재", px: 127.40 },
  { t: "CTAS", n: "Cintas", sec: "소비재", px: 171.57 },
  { t: "WBD", n: "Warner Bros Discovery", sec: "빅테크", px: 26.98 },
  { t: "BKR", n: "Baker Hughes", sec: "소비재", px: 64.87 },
  { t: "REGN", n: "Regeneron", sec: "금융&헬스케어", px: 621.49 },
  { t: "PCAR", n: "PACCAR", sec: "소비재", px: 112.05 },
  { t: "FANG", n: "Diamondback Energy", sec: "소비재", px: 192.48 },
  { t: "MSTR", n: "Strategy", sec: "소프트웨어", px: 152.49 },
  { t: "MCHP", n: "Microchip", sec: "반도체", px: 97.79 },
  { t: "FAST", n: "Fastenal", sec: "소비재", px: 44.74 },
  { t: "EA", n: "Electronic Arts", sec: "빅테크", px: 201.36 },
  { t: "XEL", n: "Xcel Energy", sec: "소비재", px: 78.77 },
  { t: "FER", n: "Ferrovial", sec: "소비재", px: 68.51 },
  { t: "ODFL", n: "Old Dominion Freight", sec: "소비재", px: 225.00 },
  { t: "EXC", n: "Exelon", sec: "소비재", px: 45.65 },
  { t: "ADSK", n: "Autodesk", sec: "소프트웨어", px: 218.97 },
  { t: "IDXX", n: "IDEXX Labs", sec: "금융&헬스케어", px: 569.98 },
  { t: "TTWO", n: "Take-Two", sec: "빅테크", px: 220.49 },
  { t: "CCEP", n: "Coca-Cola Europacific", sec: "소비재", px: 91.47 },
  { t: "KDP", n: "Keurig Dr Pepper", sec: "소비재", px: 29.97 },
  { t: "ALNY", n: "Alnylam Pharma", sec: "금융&헬스케어", px: 305.27 },
  { t: "PYPL", n: "PayPal", sec: "소프트웨어", px: 44.58 },
  { t: "TRI", n: "Thomson Reuters", sec: "소프트웨어", px: 83.42 },
  { t: "PAYX", n: "Paychex", sec: "소프트웨어", px: 95.52 },
  { t: "AXON", n: "Axon Enterprise", sec: "소프트웨어", px: 424.48 },
  { t: "WDAY", n: "Workday", sec: "소프트웨어", px: 133.00 },
  { t: "ROP", n: "Roper Technologies", sec: "소프트웨어", px: 318.60 },
  { t: "CPRT", n: "Copart", sec: "소비재", px: 33.13 },
  { t: "KHC", n: "Kraft Heinz", sec: "소비재", px: 24.27 },
  { t: "GEHC", n: "GE HealthCare", sec: "금융&헬스케어", px: 62.90 },
  { t: "DXCM", n: "DexCom", sec: "금융&헬스케어", px: 72.86 },
  { t: "CTSH", n: "Cognizant", sec: "소프트웨어", px: 53.95 },
  { t: "TEAM", n: "Atlassian", sec: "소프트웨어", px: 97.99 },
  { t: "INSM", n: "Insmed", sec: "금융&헬스케어", px: 107.47 },
  { t: "VRSK", n: "Verisk Analytics", sec: "소프트웨어", px: 171.47 },
  { t: "ZS", n: "Zscaler", sec: "소프트웨어", px: 131.51 },
  { t: "CHTR", n: "Charter Communications", sec: "빅테크", px: 143.80 },
  { t: "CSGP", n: "CoStar Group", sec: "소프트웨어", px: 32.10 },
];
const SECTOR_COLOR = { "반도체": "#5B9BF0", "빅테크": "#9B8CF0", "소프트웨어": "#E0A93C", "금융&헬스케어": "#3DD68C", "소비재": "#E0A93C" };
// 섹터 대표 ETF — 섹터를 '하나의 종목'처럼 C1~C7로 평가
const SECTOR_ETFS = [
  { sector: "반도체", etf: "SOXX", color: "#5B9BF0" },
  { sector: "빅테크", etf: "XLK", color: "#9B8CF0" },
  { sector: "소프트웨어", etf: "IGV", color: "#E0A93C" },
  { sector: "금융&헬스케어", etf: "XLV", color: "#3DD68C" },
  { sector: "소비재", etf: "XLY", color: "#E0A93C" },
];
// 나스닥100/레버리지 지수 ETF — 종목 검색·자동완성·백테스트에 노출
const INDEX_ETFS = [
  { t: "QQQ", n: "Invesco QQQ (나스닥100)", sec: "지수 ETF", px: 0 },
  { t: "QLD", n: "ProShares Ultra QQQ (나스닥100 2배)", sec: "지수 ETF", px: 0 },
  { t: "TQQQ", n: "ProShares UltraPro QQQ (나스닥100 3배)", sec: "지수 ETF", px: 0 },
  { t: "SPY", n: "SPDR S&P 500", sec: "지수 ETF", px: 0 },
  { t: "SSO", n: "ProShares Ultra S&P500 (2배)", sec: "지수 ETF", px: 0 },
  { t: "UPRO", n: "ProShares UltraPro S&P500 (3배)", sec: "지수 ETF", px: 0 },
  { t: "SOXL", n: "Direxion 반도체 3배", sec: "지수 ETF", px: 0 },
];
const NDX_TICKERS = new Set(NDX100.map((s) => s.t));

/* === 매크로 이벤트 자동 생성 (오늘 기준 향후 30일, 오름차순) ===
   정기 반복 이벤트를 날짜 규칙으로 생성한다. 일회성 뉴스는 포함 안 됨.
   bias 기본값은 neutral이며, 배포판에서 뉴스 기반으로 갱신된다. */
const FOMC_2026 = ["2026-01-28", "2026-03-18", "2026-04-29", "2026-06-17", "2026-07-29", "2026-09-16", "2026-10-28", "2026-12-09"];
const US_HOLIDAYS_2026 = {
  "2026-01-01": "신정", "2026-01-19": "마틴루터킹데이", "2026-02-16": "프레지던츠데이",
  "2026-04-03": "성금요일(휴장)", "2026-05-25": "메모리얼데이", "2026-06-19": "준틴스데이",
  "2026-07-03": "독립기념일(대체휴장)", "2026-09-07": "노동절", "2026-11-26": "추수감사절",
  "2026-12-25": "크리스마스",
};
function nthWeekdayOfMonth(year, month, weekday, n) {
  // month: 0-11, weekday: 0(일)-6(토), n: 1=첫째
  const first = new Date(year, month, 1);
  let day = 1 + ((weekday - first.getDay() + 7) % 7) + (n - 1) * 7;
  return new Date(year, month, day);
}
function iso(d) { return d.toISOString().slice(0, 10); }
function generateEvents(fromISO, days = 30) {
  const start = new Date(fromISO + "T00:00:00");
  const end = new Date(start); end.setDate(end.getDate() + days);
  const ev = [];
  const within = (d) => d >= start && d <= end;

  // 월 단위로 훑으며 정기 지표 생성 (이번 달 + 다음 달)
  for (let m = 0; m < 2; m++) {
    const base = new Date(start.getFullYear(), start.getMonth() + m, 1);
    const Y = base.getFullYear(), M = base.getMonth();
    // 고용보고서: 첫째 금요일
    const jobs = nthWeekdayOfMonth(Y, M, 5, 1);
    if (within(jobs)) ev.push({ d: jobs, ev: "고용보고서 (비농업 고용)", impact: "매우 높음", kw: "US jobs report nonfarm payrolls" });
    // CPI: 보통 10~15일 사이 (근사: 둘째 수요일)
    const cpi = nthWeekdayOfMonth(Y, M, 3, 2);
    if (within(cpi)) ev.push({ d: cpi, ev: "소비자물가지수 (CPI)", impact: "매우 높음", kw: "US CPI inflation report" });
    // PPI: CPI 다음날 근사 (둘째 목요일)
    const ppi = nthWeekdayOfMonth(Y, M, 4, 2);
    if (within(ppi)) ev.push({ d: ppi, ev: "생산자물가지수 (PPI)", impact: "높음", kw: "US PPI producer prices" });
    // 소매판매: 셋째 화요일 근사
    const retail = nthWeekdayOfMonth(Y, M, 2, 3);
    if (within(retail)) ev.push({ d: retail, ev: "소매판매", impact: "중간", kw: "US retail sales" });
    // 옵션 만기일(트리플위칭 포함): 셋째 금요일
    const opex = nthWeekdayOfMonth(Y, M, 5, 3);
    if (within(opex)) ev.push({ d: opex, ev: "옵션 만기일 (OpEx)", impact: "중간", kw: "options expiration triple witching" });
    // PCE: 말일 근사 (마지막 평일)
    const lastDay = new Date(Y, M + 1, 0);
    while (lastDay.getDay() === 0 || lastDay.getDay() === 6) lastDay.setDate(lastDay.getDate() - 1);
    if (within(lastDay)) ev.push({ d: new Date(lastDay), ev: "PCE 물가지수 (Fed 선호지표)", impact: "높음", kw: "US PCE inflation" });
  }
  // FOMC (고정 일정)
  FOMC_2026.forEach((f) => {
    const d = new Date(f + "T00:00:00");
    if (within(d)) ev.push({ d, ev: "FOMC 금리결정 + 기자회견", impact: "매우 높음", kw: "FOMC Fed interest rate decision" });
  });
  // 주간 실업수당 청구 (매주 목요일)
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (d.getDay() === 4) ev.push({ d: new Date(d), ev: "신규 실업수당 청구건수", impact: "낮음", kw: "US jobless claims" });
  }
  // 미국 증시 휴장일
  Object.entries(US_HOLIDAYS_2026).forEach(([dt, name]) => {
    const d = new Date(dt + "T00:00:00");
    if (within(d)) ev.push({ d, ev: `${name} (휴장)`, impact: "—", kw: "" });
  });

  // 정렬 + 표기 가공
  const WD = ["일", "월", "화", "수", "목", "금", "토"];
  return ev.sort((a, b) => a.d - b.d).map((e) => ({
    date: `${e.d.getMonth() + 1}/${e.d.getDate()} (${WD[e.d.getDay()]})`,
    dateISO: iso(e.d),
    ev: e.ev, impact: e.impact, kw: e.kw,
    exp: "—", bias: "neutral",
    why: "평가 대기 — '실데이터 갱신' 시 최신 뉴스 기반으로 ±판정됩니다.",
  }));
}

/* ── 판정 엔진 (첨부 리포트 공식 구현) ───────────────────────── */
function calcIndex(d) {
  const gap_score = Math.min((d.gapPct / d.gapDiv) * 40, 40);
  const slope_score = Math.min((d.slopePct / d.slopeDiv) * 30, 30);
  const vol_score = Math.max(((d.derisk - d.vol20) / d.derisk) * 30, 0);
  const strength = +(gap_score + slope_score + vol_score).toFixed(1);
  const aboveMA = d.close > d.maVal;
  let state;
  if (!aboveMA || d.vol20 > d.exit) state = "CASH";
  else if (d.vol20 > d.derisk) state = "BASE";
  else state = "LEVERAGE";
  const order = { CASH: 0, BASE: 1, LEVERAGE: 2 };
  let action, streak;
  if (state === d.prevState) { action = "HOLD"; streak = d.holdStreak; }
  else if (order[state] > order[d.prevState]) { action = "BUY"; streak = 1; }
  else { action = "REDUCE"; streak = 1; }
  const chg = (a, b) => +(((a - b) / b) * 100).toFixed(2);
  return {
    gap_score: +gap_score.toFixed(1), slope_score: +slope_score.toFixed(1), vol_score: +vol_score.toFixed(1),
    strength, state, action, streak, aboveMA,
    dDay: chg(d.close, d.prevDay), dWeek: chg(d.close, d.prevWeek), dMonth: chg(d.close, d.prevMonth),
  };
}
const stockScore = (c) => c.reduce((a, b) => a + b, 0);
// C1~C5 한 줄 설명 (카드 하단 범례용)
const C_LEGEND = [
  "추세: 완전 정배열(50>150>200일선) + 200일선 우상향",
  "풀백: 30일 고점 -3×ATR 이내 (변동성 기반 지지)",
  "베이스: 추세 유지하며 적정 조정 구간",
  "변동성 수축: 최근 10일 변동폭이 ATR 이내로 응축",
  "돌파: 최근 30일 고점 돌파",
  "거래량: 돌파일 폭발(20일평균 1.5배↑) + 직전 고갈",
  "주도주: 지수 50일선 위 + RS 상위 20%",
];
function grade(s, max = 5) {
  const r = s / max;   // 충족 비율
  if (r >= 0.8) return { label: "1순위 매수 후보", color: C.up, dot: "🟢" };
  if (r >= 0.55) return { label: "관찰 / 부분 매수", color: C.brass, dot: "🟡" };
  if (r >= 0.35) return { label: "관망", color: C.amber, dot: "🟠" };
  return { label: "회피 / 보류", color: C.down, dot: "🔴" };
}

/* 전략 행동 사다리 (높을수록 공격적) */
const ACTION_LADDER = [
  { action: "회피", color: C.down },        // 0
  { action: "관망", color: C.amber },        // 1
  { action: "부분 매수", color: C.brass },   // 2
  { action: "매수", color: C.up },           // 3
  { action: "적극 매수", color: C.up },      // 4
];

/* 종목별 기본 전략 레벨 = 지수 상태(레짐) × 종목 베이스 스캔 점수
   지수가 공격적(LEVERAGE)일수록 같은 점수라도 한 단계 위 행동을 권고. */
function baseLevel(score, idxState) {
  if (idxState === "CASH") {
    if (score >= 4) return { level: 1, note: "지수 CASH(고변동) — 강한 종목도 신규 진입 보류, 분할 관찰." };
    return { level: 0, note: "지수 CASH 국면. 신규 매수 자제, 현금 비중 유지." };
  }
  if (idxState === "BASE") {
    if (score >= 4) return { level: 3, note: "베이스 완성 + 지수 추세 유효. 분할 매수 적합 구간." };
    if (score === 3) return { level: 2, note: "베이스 형성 중. 일부 진입 후 돌파 확인." };
    if (score === 2) return { level: 1, note: "신호 약함. 점수 상승·돌파 대기." };
    return { level: 0, note: "기준 미달. 매수 대상 아님." };
  }
  // LEVERAGE
  if (score >= 4) return { level: 4, note: "지수 LEVERAGE + 종목 4점 이상. 비중 확대 적합." };
  if (score === 3) return { level: 3, note: "지수 강세 환경. 분할 매수 진입 가능." };
  if (score === 2) return { level: 1, note: "지수는 강하나 종목 신호 약함. 돌파 확인 후 진입." };
  return { level: 0, note: "기준 미달. 추격 자제." };
}

/* 확인지표 오버레이: VIX·HYG·12M ROC 통과 여부로 전략 레벨을 가감
   - 전지표 통과 → 변동 없음
   - 일부 미달 → 미달 1개당 한 단계 하향 (최저 0)
   - C2(VIX) 미달은 변동성 급등 신호 → 추가 1단계 하향 */
function confirmOverlay(level, conf, idxKey) {
  const fails = [];
  const rocPass = idxKey === "NDX" ? conf.raw.rocNDX > 0 : conf.raw.rocSPX > 0;
  const vixPass = conf.raw.vix < 30;
  const hygPass = conf.raw.hyg20 > -2;
  if (!rocPass) fails.push("12M ROC");
  if (!vixPass) fails.push("VIX≥30");
  if (!hygPass) fails.push("HYG≤-2%");
  let down = fails.length;
  if (!vixPass) down += 1; // 변동성 급등은 가중 페널티
  const adjusted = Math.max(0, level - down);
  return { adjusted, fails, vixPass, hygPass, rocPass };
}

/* 최종 전략 = 기본 레벨에 확인지표 오버레이 적용 */
function stockStrategy(score, idxState, conf, idxKey) {
  const base = baseLevel(score, idxState);
  if (!conf) {
    const a = ACTION_LADDER[base.level];
    return { action: a.action, color: a.color, note: base.note, fails: [], downgraded: false };
  }
  const ov = confirmOverlay(base.level, conf, idxKey);
  const a = ACTION_LADDER[ov.adjusted];
  const downgraded = ov.adjusted < base.level;
  let note = base.note;
  if (ov.fails.length === 0) {
    note += " 확인지표 전부 통과 — 환경 우호적.";
  } else {
    note = `확인지표 미달(${ov.fails.join(", ")})로 ${base.level - ov.adjusted}단계 하향. ` + base.note;
  }
  return { action: a.action, color: a.color, note, fails: ov.fails, downgraded };
}

/* 종목이 어느 지수에 속하는지 — 실제 NDX100 편입 여부로 판정.
   NDX 편입 종목은 NDX+SPX 양쪽(대부분 SPX에도 포함), 그 외는 SPX만. */
function stockIndices(ticker) {
  return NDX_TICKERS.has(ticker) ? ["NDX", "SPX"] : ["SPX"];
}

/* === 종목 실전 행동 판정 (백테스트와 동일 규칙) ===
   C1~C7 점수 + 지수 국면 + 확인지표로 매수/보유/관망/회피를 정하고
   매수 시 손절가(-7%)·익절가(+20%)·추적손절(-10%)을 함께 제시한다.
   반환: { action, color, reason, stop, target, trail, size } */
function tradeAction(st, idxStates, conf) {
  // 통합 강도(10팩터)가 있으면 그것을 기준으로(상단 배지와 일치). 없으면 7팩터 비율.
  const hasCombined = st.combined && typeof st.combined.strength === "number";
  const ratio = hasCombined ? st.combined.strength / 100 : (st.score / (st.c ? st.c.length : 5));
  const scoreLabel = hasCombined ? `강도 ${st.combined.strength}%` : `${st.score}/${st.c ? st.c.length : 5}`;
  const px = st.close != null ? st.close : (st.px != null ? st.px : null);
  // 지수 국면: 보유 지수 중 하나라도 강세(LEVERAGE/BASE)면 우호
  const regimes = stockIndices(st.t).map((ix) => idxStates?.[ix]?.state).filter(Boolean);
  const regimeOk = regimes.some((r) => r === "LEVERAGE" || r === "BASE");
  const confOk = conf ? conf.allPass : true;

  // 손절/익절/추적 가격: ATR 있으면 동적(진입가-2×ATR), 없으면 % 폴백
  const atr = st.atr != null ? st.atr : null;
  const lvl = px ? (atr != null ? {
    stop: +(px - 2 * atr).toFixed(2),          // 동적 손절: 진입가 - 2×ATR
    trail: +(px - 3 * atr).toFixed(2),          // 추적 손절: 진입가 - 3×ATR
    target: +(px + 4 * atr).toFixed(2),         // 익절: 진입가 + 4×ATR (손익비 2:1)
    mode: "ATR",
    stopPct: +(((-2 * atr) / px) * 100).toFixed(1),
  } : {
    stop: +(px * 0.93).toFixed(2),
    target: +(px * 1.20).toFixed(2),
    trail: +(px * 0.90).toFixed(2),
    mode: "%",
    stopPct: -7,
  }) : null;

  let action, color, reason, size = null;
  if (ratio >= 0.7 && regimeOk && confOk) {
    action = "매수"; color = C.up; size = ratio >= 0.85 ? "100%" : "70%";
    reason = `강신호(${scoreLabel}) + 지수 우호 + 확인지표 통과. 진입 적합.`;
  } else if (ratio >= 0.7 && (!regimeOk || !confOk)) {
    action = "관망"; color = C.amber;
    reason = `종목 신호는 강하나 ${!regimeOk ? "지수 약세" : "확인지표 미달"}. 환경 개선 시 진입.`;
  } else if (ratio >= 0.45) {
    action = "보유/관찰"; color = C.brass;
    reason = `중간 신호(${scoreLabel}). 신규 진입은 보류, 보유 중이면 손절 지키며 관찰.`;
  } else if (ratio >= 0.3) {
    action = "관망"; color = C.amber;
    reason = `약한 신호(${scoreLabel}). 베이스 형성·돌파 대기.`;
  } else {
    action = "회피/매도"; color = C.down;
    reason = `신호 미달(${scoreLabel}). 신규 진입 자제, 보유 중이면 비중 축소.`;
  }
  return { action, color, reason, size, lvl, regimes, regimeOk, confOk };
}
function calcConfirm(cf) {
  const all = [
    { name: "C1 · 12M ROC (NDX)", pass: cf.rocNDX > 0, base: "> 0%", val: `+${cf.rocNDX}%` },
    { name: "C1 · 12M ROC (SPX)", pass: cf.rocSPX > 0, base: "> 0%", val: `+${cf.rocSPX}%` },
    { name: "C2 · VIX", pass: cf.vix < 30, base: "< 30", val: cf.vix.toFixed(2), extra: `▼${(cf.vixPrev - cf.vix).toFixed(2)}pt` },
    { name: "C3 · HYG 20일", pass: cf.hyg20 > -2, base: "> -2%", val: `+${cf.hyg20}%` },
  ];
  return { all, allPass: all.every((x) => x.pass), raw: cf };
}

/* ============================================================
   백테스트 엔진
   ------------------------------------------------------------
   ⚙️ API 연동 포인트:
   실제 서비스에서는 fetchPriceSeries(ticker, startISO, endISO)를
   웹 API(예: 시세 제공사) 호출로 교체하세요. 반환 형식만 맞추면
   (아래 [{date, close}] 배열) 나머지 로직은 그대로 동작합니다.
   지금은 결정론적 의사난수로 종목별 일관된 모의 시계열을 생성합니다.
   ============================================================ */

// 종목별 시드(가격 흐름이 매번 동일하도록) — 티커 문자코드 합
function seedFromTicker(t) {
  let s = 0;
  for (let i = 0; i < t.length; i++) s = (s * 31 + t.charCodeAt(i)) % 100000;
  return s || 1;
}
// 결정론적 의사난수 (mulberry32)
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* === 실제 주가 앵커 (웹 검색으로 수집한 실값) ===
   일별 종가 전체는 검색으로 얻기 어려워, 신뢰 가능한 주요 시점의
   실제 종가를 앵커로 두고 그 사이를 주별로 보간한다.
   NVDA 출처: Yahoo Finance, Investing.com, StockScan, Macrotrends
   (2025-06 ~ 2026-06, 분할·배당 조정 기준) */
const REAL_ANCHORS = {
  NVDA: [
    { date: "2025-06-23", close: 142.03 }, // 52주 저점
    { date: "2025-08-15", close: 165.00 },
    { date: "2025-10-29", close: 207.03 }, // 2025 고점권
    { date: "2025-12-31", close: 186.50 }, // 연말 종가
    { date: "2026-02-10", close: 188.54 },
    { date: "2026-04-10", close: 188.89 },
    { date: "2026-04-24", close: 209.16 },
    { date: "2026-05-14", close: 236.54 }, // 52주 고점(ATH권)
    { date: "2026-06-05", close: 208.59 },
    { date: "2026-06-12", close: 205.19 }, // 최근 금요일 종가
    { date: "2026-06-15", close: 212.45 }, // 6/15 종가(+3.5% 랠리)
  ],
};

// 두 앵커 사이를 선형 보간하여 주어진 날짜의 실제 추정 종가 산출
function interpAnchor(anchors, iso) {
  const t = new Date(iso).getTime();
  if (t <= new Date(anchors[0].date).getTime()) return anchors[0].close;
  const last = anchors[anchors.length - 1];
  if (t >= new Date(last.date).getTime()) return last.close;
  for (let i = 0; i < anchors.length - 1; i++) {
    const a = anchors[i], b = anchors[i + 1];
    const ta = new Date(a.date).getTime(), tb = new Date(b.date).getTime();
    if (t >= ta && t <= tb) {
      const f = (t - ta) / (tb - ta);
      return +(a.close + (b.close - a.close) * f).toFixed(2);
    }
  }
  return last.close;
}

// 거래일(평일) 날짜 배열 생성
function tradingDays(startISO, endISO) {
  const out = [];
  const d = new Date(startISO + "T00:00:00");
  const end = new Date(endISO + "T00:00:00");
  while (d <= end) {
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6) out.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/* === 가격 시계열 ===
   실제 앵커가 있는 종목(REAL_ANCHORS)은 앵커 기반 실값 추정 시계열을,
   없으면 결정론적 모의 시계열을 반환한다.
   ⚙️ API 연동 시: 아래 anchors 분기를 실 시세 API 호출로 교체. */
function fetchPriceSeries(ticker, startISO, endISO, meta) {
  const days = tradingDays(startISO, endISO);
  if (days.length === 0) return [];
  const rnd2 = rng(seedFromTicker(ticker) + 7);
  const mkVol = (prevC, c) => {
    // 가격 상승일에 거래량이 늘도록(돌파일 급증 흉내), 기본 100만 ± 변동
    const base = 1000000;
    const move = prevC ? Math.abs(c / prevC - 1) : 0;
    const spike = move > 0.03 ? 1.6 + rnd2() : 1;     // 큰 상승/하락일 거래량 급증
    return Math.round(base * (0.7 + rnd2() * 0.6) * spike);
  };
  const anchors = REAL_ANCHORS[ticker];
  if (anchors) {
    const rand = rng(seedFromTicker(ticker));
    const anchorDates = new Set(anchors.map((a) => a.date));
    let prev = null;
    return days.map((d) => {
      const base = interpAnchor(anchors, d);
      const noise = anchorDates.has(d) ? 0 : (rand() - 0.5) * 0.016;
      const close = +(base * (1 + noise)).toFixed(2);
      const volume = mkVol(prev, close); prev = close;
      return { date: d, close, volume, real: true };
    });
  }
  const rand = rng(seedFromTicker(ticker));
  const score = meta?.score ?? 2;
  const drift = (score - 2) * 0.0006 + 0.0002;
  const vol = 0.012 + Math.abs(meta?.pull ?? 8) / 1000;
  let price = 100 + (seedFromTicker(ticker) % 300);
  const series = [];
  let prev = null;
  for (let i = 0; i < days.length; i++) {
    const shock = (rand() + rand() + rand() - 1.5) * 2 * vol;
    price = Math.max(1, price * (1 + drift + shock));
    const close = +price.toFixed(2);
    const volume = mkVol(prev, close); prev = close;
    series.push({ date: days[i], close, volume, real: false });
  }
  return series;
}

// 20일 이동평균 (전략 신호용)
function sma(series, idx, win) {
  if (idx < win - 1) return null;
  let s = 0;
  for (let k = idx - win + 1; k <= idx; k++) s += series[k].close;
  return s / win;
}

/* === 특정 시점(idx)의 베이스 스캔 점수 계산 (C1~C7) ===
   대시보드의 종목 카드와 동일한 규칙을 그 시점까지의 시계열로 재현한다.
   C1 추세: 종가 > MA200
   C2 풀백: 52주(최대 252일) 고점 대비 -5~-18%
   C3 베이스: 추세(C1) + 적정 조정(-3~-15%)
   C4 MA20 수렴: 종가가 MA20 ±4% 이내
   C5 돌파: 최근 30일 고점의 98% 이상(돌파/근접)
   C6 거래량: 돌파일 거래량이 20일 평균의 1.5배 이상 (volume 데이터 필요)
   C7 지수환경: 지수가 50일선 위 + 종목 상대강도(20일) 우위 (idxSeries 필요)
   데이터(거래량/지수)가 없으면 해당 항목은 0으로 처리한다.
   반환: { c: [c1..c7], score, detail } */
// 백테스트 점수 파라미터 (하락/횡보장 검증 기반 튜닝값). 한곳에 모아 조정 쉽게.
const BT_PARAMS = {
  c1strict: false,   // C1: false=종가>MA200 & MA50>MA200(완화), true=완전정배열
  c2atr: 3,          // C2: 30일고점 - c2atr×ATR 이내
  c4k: 4,            // C4: 최근10일 변동폭 ≤ c4k×ATR
  c6burst: 1.3,      // C6: 돌파 거래량 ≥ c6burst×20일평균
  c6dry: 0.7,        // C6: 직전3일 거래량 < c6dry×50일평균
  entry: 2,          // 진입(재진입): C점수 ≥ entry
  exit: 2,           // 청산 시그널: C점수 ≤ exit (장기추세 꺾임과 함께)
  trail: -25,        // 추적손절 % (낙폭 방어 + 큰 추세 유지의 균형, 실데이터 검증값)
  // 분할 매수: [고점대비 하락%, 총자본 대비 매수 비중%]
  buyLevels: [[0, 30], [5, 10], [10, 15], [15, 20], [20, 25]],
  sellFraction: 3,   // 매도 시그널 시 1/N씩 분할 매도 (3 = 1/3)
  sellGapPct: 3,     // 분할 매도 간격: 직전 매도가보다 이 %만큼 더 떨어져야 다음 분할 매도 (가짜 신호 회피 → 수익 극대화)
  useMACDBuy: true,  // 추가 분할매수 시 MACD 반등 확인(골든크로스 또는 히스토그램 상승)
};

// MACD(12,26,9) 전체 시계열 계산
function computeMACDSeries(series) {
  const closes = series.map((d) => d.close);
  const ema = (arr, n) => { const k = 2 / (n + 1); let e = arr[0]; const out = [e]; for (let i = 1; i < arr.length; i++) { e = arr[i] * k + e * (1 - k); out.push(e); } return out; };
  const e12 = ema(closes, 12), e26 = ema(closes, 26);
  const macd = closes.map((_, i) => e12[i] - e26[i]);
  const sig = ema(macd, 9);
  const hist = macd.map((m, i) => m - sig[i]);
  return { macd, sig, hist };
}
// 장기 추세 꺾임: 120일·60일 종가 회귀 기울기가 모두 음수
function longTrendBroken(series, idx) {
  const slopeOf = (win) => {
    const lo = Math.max(0, idx - win + 1);
    const seg = series.slice(lo, idx + 1).map((d) => d.close);
    const n = seg.length; if (n < 5) return 0;
    let sx = 0, sy = 0, sxy = 0, sxx = 0;
    for (let k = 0; k < n; k++) { sx += k; sy += seg[k]; sxy += k * seg[k]; sxx += k * k; }
    const d = n * sxx - sx * sx; return d ? (n * sxy - sx * sy) / d : 0;
  };
  return slopeOf(120) < 0 && slopeOf(60) < 0;
}


function btATR(series, idx, n = 14) {
  if (idx < n) return null;
  let t = 0, c = 0;
  for (let k = idx - n + 1; k <= idx; k++) {
    const h = series[k].high, l = series[k].low, pc = series[k - 1].close;
    if ([h, l, pc].some((x) => x == null || isNaN(x))) continue;
    t += Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)); c++;
  }
  return c ? t / c : null;
}

// 백테스트용 C1~C6 점수 (OHLCV 필요). C7은 백테스트에서 지수환경으로 별도 처리.
function scoreAt(series, idx, idxSeries) {
  const P = BT_PARAMS;
  const close = series[idx].close;
  const lo = (n) => Math.max(0, idx - n + 1);
  const win = (n) => series.slice(lo(n), idx + 1);
  const maOf = (n) => { const a = win(n).map((d) => d.close); return a.length ? a.reduce((x, y) => x + y, 0) / a.length : null; };
  const hasOHLC = series[idx].high != null && series[idx].low != null;
  const ma50 = maOf(50), ma150 = maOf(150), ma200 = maOf(200);
  const ma200_20 = idx >= 220 ? (() => { const a = series.slice(idx - 219, idx - 19).map((d) => d.close); return a.reduce((x, y) => x + y, 0) / a.length; })() : ma200;
  const atr = hasOHLC ? btATR(series, idx, 14) : null;
  const highs = win(252).map((d) => (d.high != null ? d.high : d.close));
  const high52 = Math.max(...highs);
  const high30 = Math.max(...win(30).map((d) => (d.high != null ? d.high : d.close)));
  const high30prev = idx > 0 ? Math.max(...series.slice(lo(31), idx).map((d) => (d.high != null ? d.high : d.close))) : high30;
  const pull = high52 ? ((close - high52) / high52) * 100 : 0;

  // C1 추세
  const c1 = P.c1strict
    ? (ma50 != null && ma150 != null && ma200 != null && close > ma50 && ma50 > ma150 && ma150 > ma200 && ma200 > ma200_20 ? 1 : 0)
    : (ma200 != null && close > ma200 && (ma50 == null || ma50 > ma200) ? 1 : 0);
  // C2 ATR 풀백 하한선 (ATR 없으면 % 폴백 -5~-18)
  const c2 = atr != null ? (close >= high30 - P.c2atr * atr ? 1 : 0) : (pull <= -5 && pull >= -18 ? 1 : 0);
  // C3 베이스
  const c3 = (ma200 != null && close > ma200 && pull <= -2 && pull >= -18) ? 1 : 0;
  // C4 변동성 수축 (ATR 없으면 0)
  let c4 = 0;
  if (atr != null) {
    const w10 = win(10);
    const range10 = Math.max(...w10.map((d) => (d.high != null ? d.high : d.close))) - Math.min(...w10.map((d) => (d.low != null ? d.low : d.close)));
    c4 = range10 <= P.c4k * atr ? 1 : 0;
  }
  // C5 돌파
  const c5 = close >= high30prev ? 1 : 0;
  // C6 거래량 폭발 + 직전 고갈 (거래량 없으면 0)
  let c6 = 0;
  const vols = win(51).map((d) => d.volume).filter((v) => v != null && !isNaN(v));
  if (vols.length >= 51) {
    const today = vols[vols.length - 1];
    const ma20v = vols.slice(-21, -1).reduce((a, b) => a + b, 0) / 20;
    const ma50v = vols.slice(-51, -1).reduce((a, b) => a + b, 0) / 50;
    const prev3 = vols.slice(-4, -1).reduce((a, b) => a + b, 0) / 3;
    if (ma20v > 0 && today >= P.c6burst * ma20v && prev3 < P.c6dry * ma50v) c6 = 1;
  }
  // C7 지수환경 (지수 50일선 위 + 상대강도)
  let c7 = 0;
  if (idxSeries && idxSeries.length) {
    const j = Math.min(idx, idxSeries.length - 1);
    const ic = idxSeries[j].close;
    const iwin = idxSeries.slice(Math.max(0, j - 49), j + 1).map((d) => d.close);
    const ima50 = iwin.length ? iwin.reduce((a, b) => a + b, 0) / iwin.length : null;
    const stockRet = series[lo(20)] ? (close / series[lo(20)].close - 1) : 0;
    const idxAgo = idxSeries[Math.max(0, j - 19)].close;
    const idxRet = idxAgo ? (ic / idxAgo - 1) : 0;
    if (ima50 != null && ic > ima50 && stockRet > idxRet) c7 = 1;
  }

  const c = [c1, c2, c3, c4, c5, c6, c7];
  return { c, score: c.reduce((a, b) => a + b, 0) };
}

/* === 백테스트 실행 (실전 요소 종합) ===
   strategyEnabled=false → 시작일 전액 매수 후 보유(Buy&Hold)
   strategyEnabled=true  → 다음 규칙을 모두 적용:
   [진입] C1~C7 점수 ≥ 5  AND  지수 50일선 위(국면 필터)  AND  손익비 ≥ 1.5  AND  실적 임박 아님
   [비중] 포지션 사이징: 점수·변동성 기반으로 매수 비중(50~100%) 차등
   [출구] ① 손절 -7%  ② 추적손절: 보유 중 고점 대비 -10%  ③ 익절: +20% 목표 도달  ④ 신호 약화(점수 ≤ 2)
   opts: { idxSeries, earnings }  (earnings: 실적 예정일 ISO 배열) */
function annualVol(series, idx, win = 20) {
  const lo = Math.max(1, idx - win + 1);
  const rets = [];
  for (let k = lo; k <= idx; k++) rets.push(series[k].close / series[k - 1].close - 1);
  if (rets.length < 2) return 0.3;
  const m = rets.reduce((a, b) => a + b, 0) / rets.length;
  const v = rets.reduce((a, b) => a + (b - m) ** 2, 0) / rets.length;
  return Math.sqrt(v) * Math.sqrt(252);   // 연율화 변동성
}
function nearEarnings(dateISO, earnings, daysAhead = 5) {
  if (!earnings || !earnings.length) return false;
  const t = new Date(dateISO).getTime();
  return earnings.some((e) => {
    const d = new Date(e).getTime() - t;
    return d >= 0 && d <= daysAhead * 86400000;
  });
}
function runBacktest(series, capital, meta, strategyEnabled, opts = {}) {
  if (series.length < 2) return null;
  const idxSeries = opts.idxSeries;
  const earnings = opts.earnings;
  const start = series[0].close;
  let cash = capital, shares = 0, inPos = false;
  let trades = 0, stops = 0, trails = 0, takes = 0, skipsRR = 0, skipsEarn = 0;
  let entryPx = 0, peakSinceEntry = 0;
  const equity = [];
  let peak = capital, maxDD = 0;

  // 포지션 사이징: 점수 비율 높고 변동성 낮을수록 큰 비중(0.5~1.0)
  const sizeFor = (score, maxScore, vol) => {
    const sBoost = Math.min(1, score / maxScore);              // 0~1
    const vAdj = Math.max(0.5, Math.min(1, 0.25 / Math.max(0.1, vol))); // 변동성 클수록 축소
    return Math.max(0.5, Math.min(1, 0.6 * sBoost + 0.4 * vAdj));
  };
  // 손익비: 저항(최근 252일 고점)까지 상승 여력 vs 손절 -7%
  const rrFor = (idx) => {
    const lo = Math.max(0, idx - 251);
    const high = Math.max(...series.slice(lo, idx + 1).map((d) => d.close));
    const px = series[idx].close;
    const upside = ((high - px) / px) * 100;     // 저항까지 %
    return upside / 7;                            // 위험(-7%) 대비
  };
  const idxAbove50 = (idx) => {
    if (!idxSeries || !idxSeries.length) return true;   // 지수 없으면 통과
    const j = Math.min(idx, idxSeries.length - 1);
    const w = idxSeries.slice(Math.max(0, j - 49), j + 1).map((d) => d.close);
    const ma = w.reduce((a, b) => a + b, 0) / w.length;
    return idxSeries[j].close > ma;
  };

  const TRAIL = BT_PARAMS.trail;
  const signals = [];   // 매수/매도 시점 기록 {date, type, price}

  // 전략용 MACD 미리 계산
  const MACD = strategyEnabled ? computeMACDSeries(series) : null;
  const goldenCross = (i) => i > 0 && MACD.macd[i] > MACD.sig[i] && MACD.macd[i - 1] <= MACD.sig[i - 1];
  const histUp = (i) => i > 0 && MACD.hist[i] > MACD.hist[i - 1];
  const macdBuyOK = (i) => !BT_PARAMS.useMACDBuy || goldenCross(i) || histUp(i);

  // 분할 상태
  const capital0 = capital;
  let entryPeak = 0;        // 매수 사이클의 고점(추가매수 기준)
  let boughtLevels = {};    // 이미 매수한 하락 단계
  let sellStage = 0;        // 분할 매도 진행 단계
  let lastSellPx = 0;       // 직전 분할 매도가 (다음 분할은 이보다 sellGapPct% 더 떨어져야 실행)
  let invested = 0;         // 현재 주식에 투입된 원금(매수 시 +금액, 매도 시 -비례원금)
  let avgCost = 0;          // 보유 주식 평균 매입가
  let realizedPnL = 0;      // 실현 손익 누적
  let idleReserve = capital; // 아직 한 번도 투입 안 된 예비 현금(차트 자산가치에서 제외)
  const warm = Math.min(30, Math.floor(series.length / 5));

  let cycleBase = capital;   // 현재 매수 사이클의 기준 자본(시작 시점 가용현금) — 재진입 시 갱신되어 복리 반영
  const buyPortion = (i, pct) => {
    const px = series[i].close;
    const amt = Math.min(cash, cycleBase * pct / 100);
    if (amt <= 0) return;
    const newSh = amt / px;
    avgCost = (avgCost * shares + px * newSh) / (shares + newSh);  // 평단가 갱신
    shares += newSh; cash -= amt; invested += amt; trades++;
    idleReserve = Math.max(0, idleReserve - amt);  // 투입된 만큼 예비현금에서 차감(한번 투입되면 '내 전략 자금'으로 편입)
    signals.push({ date: series[i].date, type: "buy", price: px, value: cash + shares * px });
  };

  for (let i = 0; i < series.length; i++) {
    const px = series[i].close;
    if (!strategyEnabled) {
      if (i === 0) { shares = capital / px; cash = 0; inPos = true; }
    } else {
      if (!inPos && shares === 0) {
        // 사이클 시작: 첫 진입도 매수 신호(C점수 ≥ entry)가 떠야 함. 시작일 강제매수 없음.
        // (바이앤홀드는 시작일 100% 보유 기준, 전략은 신호 확인 후 진입 → 초기 변동 회피)
        const sc = i >= warm ? scoreAt(series, i, idxSeries).score : -1;
        if (i >= warm && sc >= BT_PARAMS.entry) {
          inPos = true; entryPeak = px; peakSinceEntry = px; boughtLevels = {}; sellStage = 0; lastSellPx = 0;
          cycleBase = cash;   // 이번 사이클 기준 자본 = 현재 가용 현금 전액(이전 사이클 수익 포함 → 복리)
          buyPortion(i, BT_PARAMS.buyLevels[0][1]); boughtLevels[0] = 1;
        }
      } else if (inPos) {
        entryPeak = Math.max(entryPeak, px);
        peakSinceEntry = Math.max(peakSinceEntry, px);
        const dropFromPeak = ((px - entryPeak) / entryPeak) * 100;
        // 분할 매수: 고점 대비 하락 단계 도달 + MACD 반등 확인
        BT_PARAMS.buyLevels.forEach(([lv, pct]) => {
          if (lv > 0 && dropFromPeak <= -lv && !boughtLevels[lv] && cash > 0 && macdBuyOK(i)) {
            buyPortion(i, pct); boughtLevels[lv] = 1;
          }
        });
        // 매도 시그널: (장기추세 꺾임 AND C점수 ≤ exit) 또는 추적손절
        const trailPct = ((px - peakSinceEntry) / peakSinceEntry) * 100;
        const { score: sc } = i >= warm ? scoreAt(series, i, idxSeries) : { score: 99 };
        const sigSell = i >= warm && longTrendBroken(series, i) && sc <= BT_PARAMS.exit;
        const hardStop = trailPct <= TRAIL;
        // 분할 매도 간격: 직전 매도 후, 그 가격보다 sellGapPct% 더 떨어졌을 때만 다음 분할 매도
        // (단, 추적손절은 안전장치이므로 간격 무시하고 즉시 실행)
        const gapOK = lastSellPx === 0 || px <= lastSellPx * (1 - BT_PARAMS.sellGapPct / 100);
        if (((sigSell && gapOK) || hardStop) && shares > 0) {
          const denom = Math.max(1, BT_PARAMS.sellFraction - sellStage);
          const sellSh = shares / denom;          // 1/3씩 분할 매도
          const soldCost = avgCost * sellSh;       // 매도분의 원금
          realizedPnL += (px - avgCost) * sellSh;  // 매도분 실현손익
          cash += sellSh * px; shares -= sellSh; invested -= soldCost; trades++; sellStage++;
          lastSellPx = px;                          // 이번 매도가 기록
          if (hardStop) trails++;
          signals.push({ date: series[i].date, type: "sell", kind: hardStop ? "trail" : "signal", price: px, value: cash + shares * px });
          if (sellStage >= BT_PARAMS.sellFraction || shares * px < capital0 * 0.01) {
            realizedPnL += (px - avgCost) * shares;
            cash += shares * px; invested = 0; shares = 0; inPos = false; sellStage = 0; avgCost = 0;  // 사이클 종료
          }
        }
      }
    }
    // 차트값: 전략·바이앤홀드 모두 "총자산(현금 + 주식 평가액)".
    // 분할 매수는 현금→주식 전환이라 총자산이 연속적 → 수직 점프 없음.
    // 진입 전엔 현금 100%라 capital에서 평평하게 시작. 매도분도 현금으로 보존됨.
    const dispVal = cash + shares * px;
    peak = Math.max(peak, dispVal); maxDD = Math.max(maxDD, peak > 0 ? (peak - dispVal) / peak : 0);
    equity.push({ date: series[i].date, value: +Math.max(0, dispVal).toFixed(0) });
  }
  // 실제 총자산(현금+주식)
  const trueFinal = cash + shares * series[series.length - 1].close;
  // 수익률·낙폭: 전체 자본(capital) 기준 — 바이앤홀드와 동일 기준이라 공정 비교
  const endVal = equity[equity.length - 1].value;
  const base = capital;
  return {
    startPrice: start, endPrice: series[series.length - 1].close,
    finalValue: +trueFinal.toFixed(0), profit: +(trueFinal - base).toFixed(0),
    retPct: base > 0 ? ((trueFinal - base) / base) * 100 : 0,
    totalAsset: +trueFinal.toFixed(0),
    maxDD: maxDD * 100, trades, stops, trails, takes, skipsRR, skipsEarn, equity, signals,
  };
}

/* === 레버리지 타이밍 백테스트 ===
   "종목을 2배로 추종하되, N일 이동평균선 위일 때만 보유하고 아래면 현금"
   - 검증 결과 위험 대비 수익이 가장 좋았던 전략(QLD+200일타이밍의 일반화).
   - leverage: 2 = 2배 ETF 모사. 비용: 운용비 0.9% + (L-1)*5% 차입이자(일할 차감).
   - maPeriod: 추세 판단 이동평균(기본 200일). 느릴수록 휩쏘 적음.
   - 주의: 단일 종목 레버리지는 변동성 끌림·갭하락 위험이 크고, 과거 강세장 결과가
     미래에 재현된다는 보장이 없음(특히 개별주). 분산 지수(QQQ 등)일수록 안정적. */
function runLevTiming(series, capital, opts = {}) {
  if (series.length < 2) return null;
  const L = opts.leverage || 2;
  const maP = opts.maPeriod || 200;
  const annualCost = 0.009 + (L - 1) * 0.05;
  const dailyCost = annualCost / 252;
  // 레버리지 가격 경로(비용 반영)
  const lev = [series[0].close];
  for (let i = 1; i < series.length; i++) {
    const r = series[i].close / series[i - 1].close - 1;
    lev.push(lev[i - 1] * (1 + L * r - dailyCost));
  }
  const maAt = (i) => {
    if (i < maP - 1) return null;
    let s = 0; for (let k = i - maP + 1; k <= i; k++) s += series[k].close;
    return s / maP;
  };
  let cash = capital, units = 0;
  let peak = capital, maxDD = 0, switches = 0;
  const equity = [];
  for (let i = 0; i < series.length; i++) {
    const px = lev[i];
    const ma = maAt(i);
    const above = ma !== null && series[i].close > ma;
    if (above && units === 0) { units = cash / px; cash = 0; switches++; }
    else if (!above && units > 0) { cash += units * px; units = 0; switches++; }
    const val = cash + units * px;
    peak = Math.max(peak, val); maxDD = Math.max(maxDD, peak > 0 ? (peak - val) / peak : 0);
    equity.push({ date: series[i].date, value: +Math.max(0, val).toFixed(0) });
  }
  const finalVal = cash + units * lev[lev.length - 1];
  return {
    finalValue: +finalVal.toFixed(0), profit: +(finalVal - capital).toFixed(0),
    retPct: capital > 0 ? ((finalVal - capital) / capital) * 100 : 0,
    maxDD: maxDD * 100, switches, leverage: L, maPeriod: maP, equity,
  };
}

function diffDaysISO(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}

/* ── 공통 UI ─────────────────────────────────────────────────── */
const fmt = (n) => n.toLocaleString("en-US", { maximumFractionDigits: 1 });
const ChgPill = ({ v, label }) => {
  const up = v >= 0;
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 10, color: C.dim, marginBottom: 3, letterSpacing: "0.04em" }}>{label}</div>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 2, color: up ? C.up : C.down, fontSize: 13, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
        {up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}{up ? "+" : ""}{v}%
      </div>
    </div>
  );
};
const STATE_COLOR = { LEVERAGE: C.up, BASE: C.blue, CASH: C.down };
const ACTION_COLOR = { BUY: C.up, HOLD: C.blue, REDUCE: C.down };

function Card({ children, style }) {
  return <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: 18, ...style }}>{children}</div>;
}
function SectionTitle({ icon: Icon, children, sub }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "26px 2px 14px" }}>
      <div style={{ width: 30, height: 30, borderRadius: 9, background: C.panel2, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${C.line}` }}>
        <Icon size={16} color={C.brass} />
      </div>
      <div>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.text, letterSpacing: "-0.01em" }}>{children}</div>
        {sub && <div style={{ fontSize: 11, color: C.dim }}>{sub}</div>}
      </div>
    </div>
  );
}

/* ── 지수 신호 카드 ──────────────────────────────────────────── */
function IndexCard({ k, d }) {
  const [open, setOpen] = useState(false);
  const r = calcIndex(d);
  const sc = STATE_COLOR[r.state], ac = ACTION_COLOR[r.action];
  return (
    <Card style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 12, color: C.sub }}>{k}</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: C.text }}>{d.name}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: C.text, fontVariantNumeric: "tabular-nums" }}>{fmt(d.close)}</div>
            <div style={{ fontSize: 11, color: C.dim }}>
              {d.asOf ? `${d.asOf} 종가` : "종가"}{d._proxy ? ` · ${d._proxy} 기준` : ""}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-around", margin: "16px 0", padding: "12px 0", borderTop: `1px solid ${C.line}`, borderBottom: `1px solid ${C.line}` }}>
          <ChgPill v={r.dDay} label="전일비" /><ChgPill v={r.dWeek} label="전주비" /><ChgPill v={r.dMonth} label="전월비" />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ padding: "5px 11px", borderRadius: 999, background: `${sc}1F`, color: sc, fontSize: 12, fontWeight: 700 }}>{r.state}</span>
          <span style={{ padding: "5px 11px", borderRadius: 999, background: `${ac}1F`, color: ac, fontSize: 12, fontWeight: 700 }}>
            {r.action}{r.action === "HOLD" ? `-${r.streak}` : ""}
          </span>
          <span style={{ marginLeft: "auto", fontSize: 12, color: C.sub }}>강도 <b style={{ color: C.text, fontSize: 15 }}>{r.strength}</b>/100</span>
        </div>

        <div style={{ marginTop: 10, height: 6, background: C.panel2, borderRadius: 4, overflow: "hidden" }}>
          <div style={{ width: `${r.strength}%`, height: "100%", background: `linear-gradient(90deg, ${C.blue}, ${C.up})` }} />
        </div>
      </div>

      <button onClick={() => setOpen(!open)} style={{ width: "100%", padding: "10px 18px", background: C.panel2, border: "none", borderTop: `1px solid ${C.line}`, color: C.sub, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
        신호 계산 상세 {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {open && (
        <div style={{ padding: "14px 18px", background: C.panel2, fontSize: 12.5, color: C.sub, lineHeight: 1.9, fontVariantNumeric: "tabular-nums" }}>
          <Row l={`gap (${d.gapPct}% / ${d.gapDiv} ×40)`} v={`${r.gap_score} pt`} />
          <Row l={`slope (${d.slopePct}% / ${d.slopeDiv} ×30)`} v={`${r.slope_score} pt`} />
          <Row l={`vol (vol20 ${d.vol20}% vs derisk ${d.derisk}%)`} v={`${r.vol_score} pt`} />
          <div style={{ height: 1, background: C.line, margin: "8px 0" }} />
          <Row l={`Close > ${d.ma}`} v={r.aboveMA ? "✓ 충족" : "✗ 미달"} c={r.aboveMA ? C.up : C.down} />
          <Row l={`vol20 > exit(${d.exit}%)`} v={d.vol20 > d.exit ? "✗ 초과→CASH" : "✓ 이내"} c={d.vol20 > d.exit ? C.down : C.up} />
          <Row l={`vol20 > derisk(${d.derisk}%)`} v={d.vol20 > d.derisk ? `→ BASE` : `→ LEVERAGE`} c={d.vol20 > d.derisk ? C.blue : C.up} />
        </div>
      )}
    </Card>
  );
}
const Row = ({ l, v, c }) => (
  <div style={{ display: "flex", justifyContent: "space-between" }}>
    <span>{l}</span><span style={{ color: c || C.text, fontWeight: 600 }}>{v}</span>
  </div>
);

/* ── 종목 신호 카드 (지수 카드와 동일 포맷) ──────────────────── */
function StockSignalCard({ st, idxStates, conf }) {
  // 미분석 종목: 베이스 스캔 데이터 없음 → 간소 카드
  if (!st.analyzed) {
    const indices = stockIndices(st.t);
    return (
      <Card style={{ borderColor: C.line }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 12, color: st.color }}>{st.sector}{indices.includes("NDX") ? " · NDX 100" : ""}</div>
            <div style={{ fontSize: 19, fontWeight: 800, color: C.text }}>{st.t}</div>
            <div style={{ fontSize: 11.5, color: C.sub, marginTop: 1 }}>{st.name}</div>
          </div>
          {st.px != null && (
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: C.text, fontVariantNumeric: "tabular-nums" }}>${st.px.toLocaleString()}</div>
              <div style={{ fontSize: 10, color: C.dim }}>참고가</div>
            </div>
          )}
        </div>
        <div style={{ marginTop: 12, padding: "11px 13px", background: `${C.amber}12`, border: `1px solid ${C.amber}33`, borderRadius: 9, fontSize: 11.5, color: C.sub, lineHeight: 1.6 }}>
          ⚠ <b style={{ color: C.amber }}>미분석 종목</b> — 베이스 스캔(C1~C5) 점수와 전략 행동은 아직 없습니다. 이 종목을 분석하려면 채팅에 "{st.t} 분석해줘"라고 요청하세요. <b style={{ color: C.sub }}>백테스트는 바로 가능</b>합니다.
        </div>
      </Card>
    );
  }
  const g = st.combined ? grade(st.combined.strength, 100) : grade(st.score, st.c.length);
  const labels = ["C1 추세", "C2 풀백", "C3 베이스", "C4 수축", "C5 돌파", "C6 거래량", "C7 주도주"];
  const nC = st.c.length;                    // 5 또는 7
  const maxScore = nC;
  const indices = stockIndices(st.t);
  return (
    <Card style={{ borderColor: `${g.color}44` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, color: st.color }}>{st.sector}</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 9, flexWrap: "wrap" }}>
            <span style={{ fontSize: 19, fontWeight: 800, color: C.text }}>{st.t}</span>
            {st.name && <span style={{ fontSize: 12, color: C.sub }}>{st.name}</span>}
            {st.imminent ? <span style={{ fontSize: 9.5, fontWeight: 700, color: C.amber, background: `${C.amber}22`, border: `1px solid ${C.amber}66`, padding: "2px 7px", borderRadius: 999 }}>⚡ 돌파 임박</span> : null}
          </div>
          <div style={{ display: "flex", gap: 14, marginTop: 5, fontSize: 11.5, color: C.sub, flexWrap: "wrap" }}>
            {st.close != null && <span>현재가 <b style={{ color: C.text }}>${st.close.toLocaleString()}</b></span>}
            {st.per != null && <span>PER <b style={{ color: C.text }}>{st.per}</b></span>}
            {st.pbr != null && <span>PBR <b style={{ color: C.text }}>{st.pbr}</b></span>}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          {st.combined ? (
            <>
              <div style={{ fontSize: 26, fontWeight: 800, color: g.color, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
                {st.combined.plusCount}<span style={{ fontSize: 13, color: C.dim }}>/{st.combined.totalFactors}</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 800, color: g.color, marginTop: 2 }}>강도 {st.combined.strength}%</div>
              <div style={{ fontSize: 11, color: g.color, fontWeight: 700, marginTop: 2 }}>{g.dot} {g.label}</div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 26, fontWeight: 800, color: g.color, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
                {st.score}<span style={{ fontSize: 13, color: C.dim }}>/{maxScore}</span>
              </div>
              <div style={{ fontSize: 11.5, color: g.color, fontWeight: 700, marginTop: 3 }}>{g.dot} {g.label}</div>
            </>
          )}
        </div>
      </div>
{st.chart && st.chart.length > 1 && (
        <div style={{ marginTop: 12, height: 110 }}>
          <div style={{ fontSize: 9.5, color: C.dim, marginBottom: 2 }}>최근 30일 종가</div>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={st.chart} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <XAxis dataKey="date" hide />
              <YAxis domain={["auto", "auto"]} hide />
              <Tooltip
                contentStyle={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 11 }}
                labelStyle={{ color: C.dim }} formatter={(v) => [`$${v}`, "종가"]} />
              <Line type="monotone" dataKey="close" stroke={g.color} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "center", margin: "14px 0", padding: "10px 0", borderTop: `1px solid ${C.line}`, borderBottom: `1px solid ${C.line}` }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 10, color: C.dim, marginBottom: 3, letterSpacing: "0.04em" }}>고점 대비 풀백</div>
          <div style={{ color: st.pull <= 0 ? C.down : C.up, fontSize: 15, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
            {st.pull > 0 ? "+" : ""}{st.pull}%
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: `repeat(${nC},1fr)`, gap: 5 }}>
        {st.c.map((v, j) => (
          <div key={j} style={{ textAlign: "center", padding: "8px 1px", borderRadius: 8, background: v ? `${g.color}1A` : C.panel2, border: `1px solid ${v ? `${g.color}44` : C.line}` }}>
            <div style={{ fontSize: 13, color: v ? g.color : C.dim }}>{v ? "✓" : "—"}</div>
            <div style={{ fontSize: 8, color: C.dim, marginTop: 2 }}>{labels[j].split(" ")[0]}</div>
          </div>
        ))}
      </div>
      {/* C1~C7 설명 (3열) */}
      <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "4px 10px", fontSize: 9, color: C.dim, lineHeight: 1.4 }}>
        {C_LEGEND.slice(0, nC).map((d, j) => (
          <div key={j} style={{ display: "flex", gap: 4 }}>
            <span style={{ color: st.c[j] ? g.color : C.dim, fontWeight: 700, flexShrink: 0 }}>{st.c[j] ? "✓" : "—"}C{j + 1}</span>
            <span>{d}</span>
          </div>
        ))}
      </div>

      {/* 다기간 추세 (장기/단기 분리 + 국면) */}
      {st.multiTrend && (() => {
        const mt = st.multiTrend;
        const pc = mt.phaseColor === "up" ? C.up : mt.phaseColor === "down" ? C.down : C.dim;
        const arrow = (d) => d > 0 ? "↑" : d < 0 ? "↓" : "→";
        const acol = (d) => d > 0 ? C.up : d < 0 ? C.down : C.dim;
        const ps = mt.periods;
        const bars = [["5일", ps.d5], ["15일", ps.d15], ["30일", ps.d30], ["60일", ps.d60], ["90일", ps.d90]];
        return (
          <div style={{ marginTop: 12, padding: "11px 13px", background: C.panel2, borderRadius: 9 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 9 }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: C.sub }}>다기간 추세 분석</span>
              <span style={{ fontSize: 12, color: pc, fontWeight: 800 }}>{mt.phase}</span>
            </div>
            {/* 장기/단기 요약 */}
            <div style={{ display: "flex", gap: 18, marginBottom: 10 }}>
              <div style={{ fontSize: 11.5, color: C.sub }}>장기(120·200일) <b style={{ color: acol(mt.longDir) }}>{arrow(mt.longDir)} {mt.longPct > 0 ? "+" : ""}{mt.longPct}%</b></div>
              <div style={{ fontSize: 11.5, color: C.sub }}>단기(5·15일) <b style={{ color: acol(mt.shortDir) }}>{arrow(mt.shortDir)} {mt.shortPct > 0 ? "+" : ""}{mt.shortPct}%</b></div>
            </div>
            {/* 기간별 막대 */}
            <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 40, marginBottom: 6 }}>
              {bars.map(([lbl, v], i) => {
                const h = Math.max(3, Math.min(38, Math.abs(v) * 1.6));
                const col = v > 0.3 ? C.up : v < -0.3 ? C.down : C.dim;
                return (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
                    <div style={{ width: "70%", height: h, background: col, borderRadius: 3, opacity: 0.85 }} />
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {bars.map(([lbl, v], i) => (
                <div key={i} style={{ flex: 1, textAlign: "center", fontSize: 8.5, color: C.dim }}>{lbl}<br /><span style={{ color: v > 0.3 ? C.up : v < -0.3 ? C.down : C.dim }}>{v > 0 ? "+" : ""}{v}%</span></div>
              ))}
            </div>
            <div style={{ fontSize: 9.5, color: C.dim, marginTop: 9, lineHeight: 1.5 }}>{mt.phaseDesc}</div>
          </div>
        );
      })()}

      {/* 추세채널 (C8 추세구조 · C9 채널위치 · C10 오버슈팅) */}
      {st.channel && (() => {
        const ch = st.channel;
        const pos = ch.posPct;
        // 위치 바: -20~140%를 0~100 좌표로
        const barX = Math.max(0, Math.min(100, ((pos - (-20)) / (140 - (-20))) * 100));
        const posColor = pos > 100 ? C.down : pos <= 35 ? C.up : C.amber;
        const posLabel = pos > 100 ? "오버슈팅(과열)" : pos <= 35 ? "하단권(저평가)" : pos >= 65 ? "상단권(고평가)" : "중간";
        return (
          <div style={{ marginTop: 12, padding: "11px 13px", background: C.panel2, borderRadius: 9 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 9 }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: C.sub }}>추세채널 분석 (최근 90일)</span>
              <span style={{ fontSize: 11, color: ch.dir === "상승" ? C.up : ch.dir === "하락" ? C.down : C.dim, fontWeight: 700 }}>채널 {ch.dir} 추세</span>
            </div>
            {/* 채널 위치 바 */}
            <div style={{ position: "relative", height: 8, borderRadius: 999, background: `linear-gradient(90deg, ${C.up}55, ${C.amber}55, ${C.down}55)`, marginBottom: 4 }}>
              <div style={{ position: "absolute", left: `${barX}%`, top: -3, width: 3, height: 14, borderRadius: 2, background: posColor, transform: "translateX(-50%)" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8.5, color: C.dim, marginBottom: 8 }}>
              <span>하단(저평가)</span><span>중심</span><span>상단(고평가)</span>
            </div>
            <div style={{ fontSize: 11.5, color: C.sub, marginBottom: 8 }}>
              현재 채널 위치 <b style={{ color: posColor }}>{pos}% · {posLabel}</b>
              {ch.lowerNow != null && <span style={{ color: C.dim }}> (하단 ${ch.lowerNow} ~ 상단 ${ch.upperNow})</span>}
            </div>
            {/* C8~C10 */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "4px 10px", fontSize: 9, color: C.dim, lineHeight: 1.4 }}>
              <div style={{ display: "flex", gap: 4 }}>
                <span style={{ color: ch.c8 ? C.up : C.dim, fontWeight: 700 }}>{ch.c8 ? "✓" : "—"}C8</span>
                <span>추세구조: 저점·고점 동시 상승</span>
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                <span style={{ color: ch.c9 ? C.up : C.dim, fontWeight: 700 }}>{ch.c9 ? "✓" : "—"}C9</span>
                <span>채널 하단권(저가 매수 유리)</span>
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                <span style={{ color: ch.c10 ? C.down : C.dim, fontWeight: 700 }}>{ch.c10 ? "!" : "—"}C10</span>
                <span>오버슈팅(상단 돌파·익절 주의)</span>
              </div>
            </div>
            <div style={{ fontSize: 9.5, color: C.dim, marginTop: 8, lineHeight: 1.5 }}>
              {ch.c8
                ? (ch.c9 ? "상승 추세 + 채널 하단권 → 저가 매수 기회 구간입니다."
                  : ch.c10 ? "상승 추세지만 채널 상단을 넘은 과열 상태 → 일부 익절·추격매수 주의."
                  : "상승 추세 진행 중. 채널 하단 접근 시 분할 매수가 유리합니다.")
                : "뚜렷한 상승 추세 구조가 아닙니다(저점·고점 동시 상승 미충족). 추세 매매보다 관망이 안전합니다."}
            </div>
          </div>
        );
      })()}
      <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.7, marginTop: 12, padding: "10px 12px", background: C.panel2, borderRadius: 9 }}>{st.note}</div>

      {/* 종목 실전 행동 (매수/보유/매도/손절) */}
      {idxStates && (() => {
        const ta = tradeAction(st, idxStates, conf);
        return (
          <div style={{ marginTop: 12, padding: "12px 13px", borderRadius: 10, background: `${ta.color}12`, border: `1px solid ${ta.color}44` }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
              <span style={{ fontSize: 10.5, color: C.dim, letterSpacing: "0.06em", display: "inline-flex", alignItems: "center", gap: 5 }}>
                <Target size={12} color={ta.color} /> 실전 행동
              </span>
              <span style={{ fontSize: 15, fontWeight: 800, color: ta.color }}>{ta.action}{ta.size ? ` · ${ta.size}` : ""}</span>
            </div>
            <div style={{ fontSize: 11, color: C.sub, lineHeight: 1.6, marginBottom: ta.lvl ? 9 : 0 }}>{ta.reason}</div>
            {ta.lvl && (
              <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                <div style={{ textAlign: "center", padding: "7px 2px", borderRadius: 7, background: C.panel2 }}>
                  <div style={{ fontSize: 8.5, color: C.dim }}>{ta.lvl.mode === "ATR" ? "손절 -2×ATR" : "손절 -7%"}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.down, fontVariantNumeric: "tabular-nums" }}>${ta.lvl.stop}</div>
                </div>
                <div style={{ textAlign: "center", padding: "7px 2px", borderRadius: 7, background: C.panel2 }}>
                  <div style={{ fontSize: 8.5, color: C.dim }}>{ta.lvl.mode === "ATR" ? "추적 -3×ATR" : "추적손절 -10%"}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.amber, fontVariantNumeric: "tabular-nums" }}>${ta.lvl.trail}</div>
                </div>
                <div style={{ textAlign: "center", padding: "7px 2px", borderRadius: 7, background: C.panel2 }}>
                  <div style={{ fontSize: 8.5, color: C.dim }}>{ta.lvl.mode === "ATR" ? "익절 +4×ATR" : "익절 +20%"}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.up, fontVariantNumeric: "tabular-nums" }}>${ta.lvl.target}</div>
                </div>
              </div>
              {ta.lvl.mode === "ATR" && <div style={{ fontSize: 8.5, color: C.dim, marginTop: 5, textAlign: "center" }}>변동성(ATR ${st.atr}) 기반 동적 손절 · 손절폭 {ta.lvl.stopPct}%</div>}
              </>
            )}
            <div style={{ fontSize: 9, color: C.dim, marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span>지수 국면: {ta.regimes.join("/") || "—"} {ta.regimeOk ? "✓" : "⚠"}</span>
              <span>확인지표: {ta.confOk ? "통과 ✓" : "일부 미달 ⚠"}</span>
            </div>
          </div>
        );
      })()}
    </Card>
  );
}

/* ── 메인 앱 ─────────────────────────────────────────────────── */
export default function App() {
  const [tab, setTab] = useState("overview");
  const [ovQuery, setOvQuery] = useState("");
  const [ovSelected, setOvSelected] = useState(null);
  const [ovLoading, setOvLoading] = useState(false);   // 개별 종목 조회 중
  const [ovMsg, setOvMsg] = useState("");

  // 즐겨찾기 상태
  const [favTickers, setFavTickers] = useState([]);       // 저장된 티커 목록
  const [favData, setFavData] = useState({});             // {티커: 실시간 조회 결과}
  const [favLoading, setFavLoading] = useState(false);
  const [favMsg, setFavMsg] = useState("");

  // 즐겨찾기 목록 불러오기
  async function loadFavorites() {
    try {
      const r = await fetch("/api/favorites");
      const j = await r.json();
      if (j.ok) setFavTickers(j.tickers || []);
      return j.tickers || [];
    } catch (e) { return favTickers; }
  }
  // 즐겨찾기 추가/삭제
  async function toggleFavorite(ticker, add) {
    const tk = ticker.trim().toUpperCase();
    if (!tk) return;
    try {
      const r = await fetch("/api/favorites", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(add ? { add: tk } : { remove: tk }),
      });
      const j = await r.json();
      if (j.ok) setFavTickers(j.tickers || []);
    } catch (e) { /* 무시 */ }
  }
  // 즐겨찾기 종목들을 실시간 조회 (탭 열 때마다)
  async function refreshFavorites(tickers) {
    const list = tickers || favTickers;
    if (!list.length) { setFavData({}); return; }
    setFavLoading(true);
    setFavMsg(`${list.length}개 종목 실시간 조회 중…`);
    const out = {};
    try {
      // 한도 보호: 한 번에 최대 8개씩 쉼표로 묶어 조회
      for (let i = 0; i < list.length; i += 8) {
        const batch = list.slice(i, i + 8);
        const r = await fetch(`/api/quote?symbols=${encodeURIComponent(batch.join(","))}`);
        const j = await r.json();
        if (j && j.data) Object.assign(out, j.data);
      }
      setFavData(out);
      setFavMsg(`갱신 완료 · ${new Date().toLocaleTimeString("ko-KR")}`);
    } catch (e) { setFavMsg("조회 실패 — 잠시 후 다시 시도하세요."); }
    finally { setFavLoading(false); }
  }
  // 즐겨찾기 탭 열 때 목록 로드 후 자동 조회
  useEffect(() => {
    if (tab !== "favorites") return;
    let cancelled = false;
    (async () => {
      const list = await loadFavorites();
      if (!cancelled) refreshFavorites(list);
    })();
    return () => { cancelled = true; };
  }, [tab]);
  // 첫 로드 시 즐겨찾기 목록만 미리 로드(별 표시용)
  useEffect(() => { loadFavorites(); }, []);


  // 종목 1개만 실시간 조회 (검색→선택 시 호출, 한도 절약)
  async function fetchOne(ticker) {
    const tk = ticker.trim().toUpperCase();
    if (!tk) return;
    setOvLoading(true);
    setOvMsg(`${tk} 실시간 조회 중…`);
    try {
      const resp = await fetch(`/api/quote?symbols=${encodeURIComponent(tk)}&chart=1`);
      const json = await resp.json();
      const d = json && json.data && json.data[tk];
      if (resp.ok && d && !d.error) {
        setLive((prev) => ({ ...prev, [tk]: d }));
        setOvMsg(`${tk} 갱신 완료 (${d.asOf || "최신"} 기준)`);
      } else {
        setOvMsg(`${tk} 조회 실패: ${(d && d.error) || "데이터 없음"} — 티커를 확인하거나 잠시 후 다시 시도하세요.`);
      }
    } catch (e) {
      setOvMsg(`${tk} 조회 오류: ${e.message}`);
    } finally { setOvLoading(false); }
  }
  // 베이스 스캔: 특정 종목의 현재가·풀백을 실시간으로 갱신
  async function refreshScanPull(ticker) {
    const tk = ticker.trim().toUpperCase();
    if (!tk) return;
    setScanLiveLoading((prev) => ({ ...prev, [tk]: true }));
    try {
      const resp = await fetch(`/api/quote?symbols=${encodeURIComponent(tk)}`);
      const json = await resp.json();
      const d = json && json.data && json.data[tk];
      if (resp.ok && d && !d.error && d.pull != null) {
        setScanLivePull((prev) => ({
          ...prev,
          [tk]: { pull: d.pull, px: d.close, at: d.asOf || "최신" },
        }));
      } else {
        setScanLivePull((prev) => ({ ...prev, [tk]: { error: (d && d.error) || "조회 실패" } }));
      }
    } catch (e) {
      setScanLivePull((prev) => ({ ...prev, [tk]: { error: e.message } }));
    } finally {
      setScanLiveLoading((prev) => ({ ...prev, [tk]: false }));
    }
  }
  // 백테스트 입력 상태 (기본: 오늘 기준 최근 1년)
  const [btTicker, setBtTicker] = useState("NVDA");
  const [btPicked, setBtPicked] = useState(true);   // 자동완성에서 선택했거나 초기값이면 목록 숨김
  const [btStart, setBtStart] = useState(() => { const d = new Date(); d.setFullYear(d.getFullYear() - 1); return d.toISOString().slice(0, 10); });
  const [btEnd, setBtEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const [btAmount, setBtAmount] = useState("10000");
  const [btResult, setBtResult] = useState(null);
  const [btError, setBtError] = useState("");
  // 오늘 기준 30일 이벤트 자동 생성 (아티팩트는 고정 날짜, 배포판은 실제 오늘)
  const todayISO = new Date().toISOString().slice(0, 10);   // 배포판: 실제 오늘
  // 실시간 갱신 상태
  const [live, setLive] = useState({});
  const [scanLivePull, setScanLivePull] = useState({});   // 베이스 스캔: 종목별 실시간 풀백 {t: {pull, px, hi, at}}
  const [scanLiveLoading, setScanLiveLoading] = useState({});  // 종목별 갱신 중 여부
  const [loading, setLoading] = useState(false);
  const [liveMsg, setLiveMsg] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [asOfDate, setAsOfDate] = useState(null);
  const [liveIdx, setLiveIdx] = useState(null);
  const [liveConf, setLiveConf] = useState(null);
  const [sectorLive, setSectorLive] = useState(null);   // 섹터 ETF C1~C7 평가
  const [sectorLoading, setSectorLoading] = useState(false);
  const [sectorMsg, setSectorMsg] = useState("");
  const [eventBias, setEventBias] = useState(null);   // 이벤트 타입별 ±평가
  const [eventBiasLoading, setEventBiasLoading] = useState(false);
  const [eventBiasAt, setEventBiasAt] = useState(null);

  // 이벤트: 일정은 자동 생성, ±평가는 스냅샷/실시간 조회분을 매칭
  const events = useMemo(() => {
    const base = generateEvents(todayISO, 30);
    if (!eventBias) return base;
    return base.map((e) => {
      const type = Object.keys(eventBias).find((k) => e.ev.includes(k));
      if (type && eventBias[type]) return { ...e, bias: eventBias[type].bias, why: eventBias[type].why };
      return e;
    });
  }, [todayISO, eventBias]);

  const [newsMood, setNewsMood] = useState(null);
  const [ffEvents, setFfEvents] = useState(null);   // ForexFactory 실제 일정+평가
  // 이벤트 탭을 열면 ForexFactory 실제 일정 + FRED 보조평가 + 뉴스 분위기 조회
  useEffect(() => {
    if (tab !== "calendar") return;
    let cancelled = false;
    (async () => {
      setEventBiasLoading(true);
      // ForexFactory 실제 일정(예상/실제/이전 + ±)
      try {
        const rf = await fetch("/api/ff-events");
        const jf = await rf.json();
        if (!cancelled && jf.ok && jf.events) { setFfEvents(jf.events); setEventBiasAt(jf.at || new Date().toISOString()); }
      } catch (e) { /* FF 실패 시 자동생성 일정으로 폴백 */ }
      // FRED 보조평가 + 뉴스 분위기
      try {
        const r = await fetch("/api/econ-bias");
        const j = await r.json();
        if (!cancelled && j.ok) {
          if (j.eventBias) setEventBias(j.eventBias);
          if (j.newsMood) setNewsMood(j.newsMood);
        }
      } catch (e) { /* 보조 */ }
      finally { if (!cancelled) setEventBiasLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [tab]);

  // 섹터 대표 ETF를 C1~C7로 평가 (Twelve Data, 섹터당 1회 = 5회)
  async function refreshSectors() {
    setSectorLoading(true);
    setSectorMsg("섹터 ETF C1~C7 평가 중… (최대 1분)");
    const etfs = SECTOR_ETFS.map((e) => e.etf);
    const merged = {};
    try {
      // quote API는 한 번에 최대 8개까지 → 5개라 1회로 충분하나, 안전하게 처리
      const resp = await fetch(`/api/quote?symbols=${encodeURIComponent(etfs.join(","))}`);
      const json = await resp.json();
      if (resp.ok && json.data) {
        SECTOR_ETFS.forEach(({ sector, etf, color }) => {
          const d = json.data[etf];
          if (d && !d.error) merged[sector] = { sector, etf, color, ...d };
        });
        setSectorLive(merged);
        setSectorMsg(`갱신 완료 · ${Object.keys(merged).length}/5 섹터 · ${new Date().toLocaleTimeString("ko-KR")}`);
      } else {
        setSectorMsg("조회 실패: " + (json.error || "오류"));
      }
    } catch (e) {
      setSectorMsg("조회 오류: " + e.message);
    } finally { setSectorLoading(false); }
  }
  const idxData = useMemo(() => {
    const base = { NDX: { ...IDX.NDX }, SPX: { ...IDX.SPX } };
    if (liveIdx) {
      ["NDX", "SPX"].forEach((k) => {
        const d = liveIdx[k];
        if (!d || d.error) return;
        // 프록시(QQQ/SPY)든 실제 지수든 받아온 값을 모두 반영한다.
        // 프록시는 가격 스케일이 다르므로 _proxy 라벨로 출처를 표시.
        base[k] = { ...base[k], ...d, _proxy: d.isProxy ? d.source : null };
      });
    }
    return base;
  }, [liveIdx]);
  const confData = useMemo(() => ({ ...CONFIRM, ...(liveConf || {}) }), [liveConf]);
  const conf = useMemo(() => calcConfirm(confData), [confData]);
  const ndx = calcIndex(idxData.NDX), spx = calcIndex(idxData.SPX);

  async function refreshLive() {
    setLoading(true);
    setLiveMsg("지수·확인지표를 최신으로 불러오는 중…");
    let idxNote = "";
    try {
      const mResp = await fetch("/api/macro");
      const mJson = await mResp.json();
      if (mResp.ok && mJson.ok) {
        if (mJson.idx) {
          setLiveIdx(mJson.idx);
          if (mJson.idx.NDX && mJson.idx.NDX.asOf) setAsOfDate(mJson.idx.NDX.asOf);
          const ndxOk = mJson.idx.NDX && !mJson.idx.NDX.error;
          idxNote = ndxOk ? (mJson.idx.NDX.isProxy ? `지수=ETF프록시(${mJson.idx.NDX.source})` : "지수=실시간") : "지수=갱신실패";
        }
        if (mJson.confirm && Object.keys(mJson.confirm).length) setLiveConf(mJson.confirm);
        setLiveMsg(`지수·확인지표 갱신 완료 · ${idxNote} · ${new Date().toLocaleTimeString("ko-KR")}`);
        setLastUpdated(new Date());
      } else {
        setLiveMsg("갱신 실패: " + (mJson.error || "API 오류"));
      }
    } catch (e) {
      setLiveMsg("갱신 실패: " + e.message);
    } finally { setLoading(false); }
  }

  // 페이지 진입 시 저장된 스냅샷(Cron 수집분)을 즉시 불러와 모든 탭에 반영
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/snapshot");
        const j = await r.json();
        if (!j.ok || j.empty) return;
        if (j.stocks) {
          setLive(j.stocks);
          // 섹터 ETF도 같은 스냅샷에서 구성
          const sec = {};
          SECTOR_ETFS.forEach(({ sector, etf, color }) => {
            if (j.stocks[etf]) sec[sector] = { sector, etf, color, ...j.stocks[etf] };
          });
          if (Object.keys(sec).length) setSectorLive(sec);
        }
        if (j.macro) {
          if (j.macro.idx) setLiveIdx(j.macro.idx);
          if (j.macro.confirm && Object.keys(j.macro.confirm).length) setLiveConf(j.macro.confirm);
        }
        if (j.asOf) setAsOfDate(j.asOf);
        if (j.eventBias) setEventBias(j.eventBias);
        if (j.updatedAt) {
          setLastUpdated(new Date(j.updatedAt));
          const cnt = j.stockCount || Object.keys(j.stocks || {}).length;
          setLiveMsg(j.complete === false
            ? `자동 수집 진행 중 · ${cnt}/110 종목 (나머지는 순차 수집됨) · 기준 ${j.asOf || "최신"}`
            : `자동 수집분 로드됨 · 종목 ${cnt}개 · 기준 ${j.asOf || "최신"}`);
        }
      } catch (e) { /* 스냅샷 없으면 예시 데이터로 시작 */ }
    })();
  }, []);

  const allStocks = useMemo(() => {
    // 분석값(C1~C5)이 있는 종목 맵
    const analyzed = {};
    // 시드(SECTORS)는 종목명·섹터·색상 등 메타정보로만 사용.
    // C1~C7 점수는 실시간 조회/스냅샷(둘 다 7팩터)에서만 채워진다 — 옛 5팩터는 평가에 쓰지 않음.
    SECTORS.forEach((s) => s.stocks.forEach((st) => {
      analyzed[st.t] = { t: st.t, sector: s.sector, color: s.color, c: null, score: null, pull: null, analyzed: false, seedOnly: true };
    }));
    // 실시간 데이터가 있으면 해당 종목의 c/score/pull을 실제값(7항목)으로 덮어쓰기 + note 동적 생성
    const liveNote = (d) => {
      const names = ["정배열", "ATR풀백", "베이스", "변동성수축", "돌파", "거래량", "주도주"];
      const passed = (d.c || []).map((v, i) => (v ? names[i] : null)).filter(Boolean);
      const parts = [];
      if (d.pull != null) parts.push(`고점대비 ${d.pull > 0 ? "+" : ""}${d.pull}%`);
      if (d.atr != null) parts.push(`ATR ${d.atr}`);
      parts.push(passed.length ? `충족: ${passed.join("·")}` : "충족 항목 없음");
      return `실시간 분석 — ${parts.join(" · ")}.`;
    };
    Object.entries(live).forEach(([sym, d]) => {
      if (analyzed[sym]) analyzed[sym] = { ...analyzed[sym], c: d.c, score: d.score, pull: d.pull, close: d.close, atr: d.atr, per: d.per, pbr: d.pbr, name: d.name || analyzed[sym].name, imminent: d.imminent, chart: d.chart, combined: d.combined, channel: d.channel, multiTrend: d.multiTrend, note: liveNote(d), analyzed: true, seedOnly: false, live: true };
      else analyzed[sym] = { t: sym, sector: "기타", color: "#A6B0BE", c: d.c, score: d.score, pull: d.pull, close: d.close, atr: d.atr, per: d.per, pbr: d.pbr, name: d.name, imminent: d.imminent, chart: d.chart, combined: d.combined, channel: d.channel, multiTrend: d.multiTrend, note: liveNote(d), analyzed: true, seedOnly: false, live: true };
    });
    // NDX100 전체를 기준으로 병합 (분석값 있으면 사용, 없으면 미분석)
    const merged = NDX100.map((m) => {
      if (analyzed[m.t]) return { ...analyzed[m.t], name: m.n, px: analyzed[m.t].close != null ? analyzed[m.t].close : m.px };
      return {
        t: m.t, name: m.n, sector: m.sec, color: SECTOR_COLOR[m.sec] || "#8B97A8",
        pull: null, c: null, score: null, note: "미분석 종목 — 실데이터 갱신 또는 백테스트로 분석 가능합니다.",
        analyzed: false, px: m.px,
      };
    });
    Object.values(analyzed).forEach((a) => {
      if (!NDX_TICKERS.has(a.t)) merged.push(a);
    });
    // 지수 ETF(QQQ/QLD/TQQQ 등) — 이미 merged에 없으면 추가
    const mergedTickers = new Set(merged.map((m) => m.t));
    INDEX_ETFS.forEach((e) => {
      if (mergedTickers.has(e.t)) return;
      if (analyzed[e.t]) merged.push({ ...analyzed[e.t], name: e.n });
      else merged.push({
        t: e.t, name: e.n, sector: e.sec, color: "#5B9BF0",
        pull: null, c: null, score: null, note: "지수 ETF — 직접 조회 또는 백테스트로 분석 가능합니다.",
        analyzed: false, px: e.px,
      });
    });
    return merged;
  }, [live]);
  const ranked = useMemo(() => [...allStocks].filter((s) => s.analyzed).sort((a, b) => (b.score / b.c.length) - (a.score / a.c.length) || b.score - a.score), [allStocks]);
  const ovFound = ovQuery.trim()
    ? allStocks.filter((s) => s.t.toLowerCase().includes(ovQuery.trim().toLowerCase()))
    : [];
  const ovSelectedStock = ovSelected
    ? (allStocks.find((s) => s.t === ovSelected)
        || (live[ovSelected]
            ? { t: ovSelected, name: ovSelected, sector: "직접 조회", color: "#8B97A8", ...live[ovSelected], analyzed: true, note: "실시간 데이터 기반 계산." }
            : { t: ovSelected, name: ovSelected, sector: "직접 조회", color: "#8B97A8", c: null, score: null, pull: null, analyzed: false, note: "조회 중이거나 데이터가 없습니다." }))
    : null;

  const TABS = [
    { id: "overview", label: "종합", icon: Gauge },
    { id: "favorites", label: "즐겨찾기", icon: Star },
    { id: "confirm", label: "확인지표", icon: ShieldCheck },
    { id: "sectors", label: "섹터", icon: Layers },
    { id: "scan", label: "베이스 스캔", icon: TrendingUp },
    { id: "calendar", label: "이벤트", icon: Calendar },
    { id: "lookup", label: "백테스트", icon: FlaskConical },
  ];

  // 백테스트 실행 핸들러
  const runBT = async () => {
    setBtError("");
    const tk = btTicker.trim().toUpperCase();
    const meta = allStocks.find((s) => s.t === tk);
    const amt = parseFloat(btAmount);
    if (!meta) { setBtError(`"${tk || "?"}" 종목을 찾을 수 없습니다. 수록 종목 중에서 입력하세요.`); setBtResult(null); return; }
    if (!(amt > 0)) { setBtError("투자 금액을 0보다 크게 입력하세요."); setBtResult(null); return; }
    if (diffDaysISO(btStart, btEnd) < 5) { setBtError("기간이 너무 짧습니다. 최소 1주 이상으로 설정하세요."); setBtResult(null); return; }

    setBtError("실제 시세를 불러오는 중…");
    let series = null, source = "모의";
    try {
      const resp = await fetch(`/api/series?symbol=${encodeURIComponent(tk)}&start=${btStart}&end=${btEnd}`);
      const json = await resp.json();
      if (json.ok && json.values && json.values.length >= 2) { series = json.values; source = "실제 API"; }
    } catch (e) { /* 폴백 */ }
    if (!series) {
      series = fetchPriceSeries(tk, btStart, btEnd, meta);
      source = REAL_ANCHORS[tk] ? "실제 앵커(보간)" : "모의";
    }
    if (!series || series.length < 2) { setBtError("해당 기간에 거래일이 부족합니다."); setBtResult(null); return; }

    // 지수 시계열(C7·국면 필터용): 실제 QQQ 시도 → 실패 시 모의 벤치마크
    let idxSeries = null;
    try {
      const ir = await fetch(`/api/series?symbol=QQQ&start=${btStart}&end=${btEnd}`);
      const ij = await ir.json();
      if (ij.ok && ij.values && ij.values.length >= 2) idxSeries = ij.values;
    } catch (e) { /* 폴백 */ }
    if (!idxSeries) idxSeries = fetchPriceSeries("NDX_BENCH", btStart, btEnd, { score: 3, pull: -4 });

    setBtError("");
    const btOpts = { idxSeries, earnings: meta.earnings };
    const hold = runBacktest(series, amt, meta, false);
    const strat = runBacktest(series, amt, meta, true, btOpts);
    // 레버리지 타이밍(2배 + 200일선): 검증상 위험대비 수익 최강. 단일종목은 위험 큼.
    const levTiming = runLevTiming(series, amt, { leverage: 2, maPeriod: 200 });
    const sigByDate = {};
    (strat.signals || []).forEach((s) => { sigByDate[s.date] = s; });
    const chart = series.map((p, i) => {
      const sig = sigByDate[p.date];
      return {
        date: p.date, "매수후보유": hold.equity[i].value, "전략": strat.equity[i].value,
        "2배+200일": levTiming ? levTiming.equity[i].value : null,
        sigType: sig ? sig.type : null,           // "buy" | "sell" | null
        sigKind: sig ? (sig.kind || null) : null, // 매도 종류
        sigValue: sig ? strat.equity[i].value : null,
      };
    });
    setBtResult({ tk, meta, amt, series, hold, strat, levTiming, chart, isReal: source === "실제 API", source });
  };

  return (
    <div style={{ minHeight: "100%", background: C.bg, color: C.text, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", padding: "20px 14px 40px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>

        {/* 헤더 */}
        <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 6 }}>
          <Activity size={22} color={C.brass} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, letterSpacing: "0.2em", color: C.brass, textTransform: "uppercase" }}>Market Trend Terminal</div>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>시장 추세 분석 대시보드</h1>
          </div>
          <button
            onClick={() => refreshLive()}
            disabled={loading}
            title="지수·확인지표를 최신으로 갱신"
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "9px 13px", borderRadius: 10, cursor: loading ? "wait" : "pointer",
              background: loading ? C.line : C.brass, color: loading ? C.sub : C.bg, border: "none", fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap",
            }}
          >
            <RefreshCw size={14} style={loading ? { animation: "spin 1s linear infinite" } : undefined} /> {loading ? "갱신 중…" : "지수·지표 갱신"}
          </button>
        </div>
        <div style={{ fontSize: 12, color: C.dim, marginBottom: 6 }}>
          {lastUpdated
            ? `데이터 기준일 ${asOfDate || "최신"} · 갱신 ${lastUpdated.toLocaleString("ko-KR", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })} · 실시간 API`
            : "예시 데이터(미갱신) · 우측 '실데이터 갱신'을 누르면 최신 시세로 업데이트됩니다"}
        </div>
        <div style={{ fontSize: 10.5, color: liveMsg.includes("실패") ? C.down : C.dim, marginBottom: 18, lineHeight: 1.5, padding: "8px 11px", background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8 }}>
          {liveMsg
            ? <>↻ {liveMsg}</>
            : <>↻ <b style={{ color: C.sub }}>지수·지표 갱신</b>: 지수(NDX·SPX)와 확인지표(VIX·HYG·12M ROC)를 실시간으로 다시 불러옵니다(4~6회 호출, 수초). 종목·섹터·베이스스캔은 장 마감 후 자동 수집분을 쓰며, 종목은 종합 탭에서 검색 시 개별 실시간 조회됩니다.</>}
        </div>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

        {/* 탭 */}
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 6, marginBottom: 8 }}>
          {TABS.map((t) => {
            const on = tab === t.id, Icon = t.icon;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                display: "flex", alignItems: "center", gap: 6, padding: "8px 13px", borderRadius: 999, whiteSpace: "nowrap",
                border: `1px solid ${on ? C.brass : C.line}`, background: on ? `${C.brass}1A` : "transparent",
                color: on ? C.brass : C.sub, cursor: "pointer", fontSize: 12.5, fontWeight: 600,
              }}><Icon size={14} />{t.label}</button>
            );
          })}
        </div>

        {/* ── 종합 ── */}
        {tab === "overview" && (
          <>
            <SectionTitle icon={Gauge} sub="gap·slope·vol 점수 → 상태 → 액션 (실데이터 갱신 시 실시간)">지수 신호 변화</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 12 }}>
              <IndexCard k="NDX" d={idxData.NDX} /><IndexCard k="SPX" d={idxData.SPX} />
            </div>

            {/* 지수 전체 전략 행동 — 지수 상태(state/action)로 동적 생성 */}
            {(() => {
              const stLabel = { CASH: "현금(CASH)", BASE: "보유(BASE)", LEVERAGE: "공격(LEVERAGE)" };
              const acLabel = { HOLD: "유지", BUY: "비중 확대", REDUCE: "비중 축소" };
              // 두 지수 종합: 더 보수적인 쪽을 기준으로 행동 제시
              const order = { CASH: 0, BASE: 1, LEVERAGE: 2 };
              const weaker = order[ndx.state] <= order[spx.state] ? ndx : spx;
              const weakerK = weaker === ndx ? "NDX" : "SPX";
              let head, color;
              if (weaker.state === "CASH") { head = "지수 전략 행동: 신규 매수 자제 · 현금 비중 확대"; color = C.down; }
              else if (weaker.state === "BASE") { head = "지수 전략 행동: 기존 포지션 유지 · 신규는 선별적"; color = C.amber; }
              else { head = "지수 전략 행동: 강세 환경 · 분할 매수/비중 확대 가능"; color = C.up; }
              return (
                <Card style={{ marginTop: 14, borderColor: `${color}44` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <Minus size={15} color={color} /><b style={{ fontSize: 14, color }}>{head}</b>
                  </div>
                  <div style={{ fontSize: 12.5, color: C.sub, lineHeight: 1.8 }}>
                    NDX는 <b style={{ color: C.text }}>{stLabel[ndx.state]}</b> 국면({ndx.action === "HOLD" ? `HOLD-${ndx.streak}` : acLabel[ndx.action]}, 강도 {ndx.strength}),
                    SPX는 <b style={{ color: C.text }}>{stLabel[spx.state]}</b> 국면({spx.action === "HOLD" ? `HOLD-${spx.streak}` : acLabel[spx.action]}, 강도 {spx.strength}).
                    {weaker.state === "LEVERAGE"
                      ? " 두 지수 모두 추세가 강해 신규 진입·비중 확대에 우호적인 구간입니다."
                      : weaker.state === "BASE"
                      ? ` ${weakerK}의 변동성이 다소 높아, 공격적 확대보다 기존 포지션 유지가 합리적입니다.`
                      : ` ${weakerK}가 추세 이탈/고변동 상태라, 신규 매수를 자제하고 현금 비중을 높이는 편이 안전합니다.`}
                  </div>
                </Card>
              );
            })()}
            <Card style={{ marginTop: 12, borderColor: conf.allPass ? `${C.up}55` : `${C.down}55` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <ShieldCheck size={16} color={conf.allPass ? C.up : C.down} />
                <b style={{ fontSize: 14, color: conf.allPass ? C.up : C.down }}>
                  {conf.allPass ? "전지표 통과 — 거시 환경 강세 신호 유효" : "확인지표 일부 미달 — 주의"}
                </b>
              </div>
              <div style={{ fontSize: 12, color: C.sub, marginTop: 6 }}>
                VIX {confData.vix ?? "—"} ({confData.vix != null && confData.vix < 20 ? "리스크온" : confData.vix != null && confData.vix < 30 ? "중립" : "불안"} 구간), HYG {confData.hyg20 != null ? (confData.hyg20 > 0 ? `+${confData.hyg20}` : confData.hyg20) : "—"}% ({confData.hyg20 != null && confData.hyg20 > -2 ? "신용 양호" : "신용 위축"}). 상세는 확인지표 탭 참고.
              </div>
            </Card>

            {/* 종목 검색 → 선택 → 해당 종목 전략 행동 */}
            <SectionTitle icon={Search} sub="NASDAQ 100 전체 검색 · 선택하면 전략 행동 표시">종목 신호 조회</SectionTitle>{/* NDX100 */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 11, padding: "0 14px", marginBottom: 12 }}>
              <Search size={16} color={C.dim} />
              <input value={ovQuery} onChange={(e) => { setOvQuery(e.target.value); setOvSelected(null); }} placeholder="예: NVDA, TSLA, COST…"
                style={{ flex: 1, border: "none", outline: "none", background: "transparent", color: C.text, fontSize: 15, padding: "12px 0" }} />
              {ovQuery && <button onClick={() => { setOvQuery(""); setOvSelected(null); }} style={{ border: "none", background: "transparent", color: C.dim, cursor: "pointer", fontSize: 13 }}>지우기</button>}
            </div>

            {ovQuery.trim() === "" && !ovSelected && (
              <div style={{ fontSize: 12, color: C.dim, padding: "4px 2px", lineHeight: 1.6 }}>
                티커를 입력해 종목을 선택하면 <b style={{ color: C.sub }}>그 종목만 실시간 시세로 조회</b>해 C1~C7 신호와 실전 행동(매수/매도/손절·익절가)을 보여줍니다. NDX100에 없는 S&P 500 종목(예: JPM, GE, UNH)도 직접 조회할 수 있습니다.
              </div>
            )}
            {ovQuery.trim() !== "" && ovFound.length === 0 && !ovSelected && (
              <Card style={{ textAlign: "center", color: C.dim, fontSize: 13 }}>
                <div style={{ marginBottom: 10 }}>"{ovQuery.toUpperCase()}"는 수록 목록에 없습니다. S&P 500 등 다른 미국 종목이면 아래로 직접 조회할 수 있습니다.</div>
                <button onClick={() => { const tk = ovQuery.trim().toUpperCase(); setOvSelected(tk); fetchOne(tk); }} disabled={ovLoading} style={{
                  display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 15px", borderRadius: 9, cursor: ovLoading ? "wait" : "pointer",
                  background: C.brass, color: C.bg, border: "none", fontSize: 13, fontWeight: 700,
                }}>
                  <Search size={14} /> {ovQuery.toUpperCase()} 실시간 조회
                </button>
              </Card>
            )}

            {/* 후보 목록 (미선택 상태에서만 노출) */}
            {ovQuery.trim() !== "" && ovFound.length > 0 && !ovSelected && (
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {ovFound.map((st) => {
                  const g = grade(st.score, (st.c ? st.c.length : 5));
                  return (
                    <button key={st.t} onClick={() => { setOvSelected(st.t); fetchOne(st.t); }} style={{
                      display: "flex", alignItems: "center", gap: 11, padding: "11px 14px", borderRadius: 10, cursor: "pointer", textAlign: "left",
                      background: C.panel, border: `1px solid ${C.line}`,
                    }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: st.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 14, fontWeight: 700, color: C.text, minWidth: 52 }}>{st.t}</span>
                      <span style={{ fontSize: 11, color: C.sub, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{st.name || st.sector}</span>
                      {st.analyzed
                        ? <span style={{ fontSize: 14, fontWeight: 800, color: g.color }}>{st.score}<span style={{ fontSize: 10, color: C.dim }}>/{st.c.length}</span></span>
                        : <span style={{ fontSize: 10, fontWeight: 700, color: C.amber, background: `${C.amber}1A`, padding: "2px 7px", borderRadius: 999 }}>미분석</span>}
                      <ChevronRight size={15} color={C.dim} />
                    </button>
                  );
                })}
              </div>
            )}

            {/* 선택된 단일 종목 카드 */}
            {ovSelectedStock && (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                  <button onClick={() => { setOvSelected(null); setOvMsg(""); }} style={{
                    display: "inline-flex", alignItems: "center", gap: 4, padding: "6px 12px", borderRadius: 8, cursor: "pointer",
                    background: "transparent", border: `1px solid ${C.line}`, color: C.sub, fontSize: 12,
                  }}>← 목록으로</button>
                  <button onClick={() => fetchOne(ovSelected)} disabled={ovLoading} style={{
                    display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, cursor: ovLoading ? "wait" : "pointer",
                    background: ovLoading ? C.line : `${C.brass}22`, border: `1px solid ${C.brass}55`, color: C.brass, fontSize: 12, fontWeight: 700,
                  }}>
                    <RefreshCw size={12} style={ovLoading ? { animation: "spin 1s linear infinite" } : undefined} /> 최신 시세로 조회
                  </button>
                  {ovMsg && <span style={{ fontSize: 11, color: ovMsg.includes("실패") || ovMsg.includes("오류") ? C.down : C.dim }}>{ovMsg}</span>}
                  {(() => {
                    const tk = (ovSelectedStock.t || "").toUpperCase();
                    const isFav = favTickers.includes(tk);
                    return (
                      <button onClick={() => toggleFavorite(tk, !isFav)} style={{
                        display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8,
                        border: `1px solid ${isFav ? C.brass : C.line}`, background: isFav ? `${C.brass}1A` : "transparent",
                        color: isFav ? C.brass : C.sub, cursor: "pointer", fontSize: 12, fontWeight: 600,
                      }}>
                        <Star size={13} fill={isFav ? C.brass : "none"} /> {isFav ? "즐겨찾기됨" : "즐겨찾기 추가"}
                      </button>
                    );
                  })()}
                </div>
                <StockSignalCard st={ovSelectedStock} idxStates={{ NDX: ndx, SPX: spx }} conf={conf} />
              </>
            )}

            {/* 매수 후보 리스트 (선택된 종목이 없을 때) */}
            {!ovSelected && (() => {
              const buys = allStocks
                .filter((s) => s.analyzed && s.c)
                .map((s) => ({ s, ta: tradeAction(s, { NDX: ndx, SPX: spx }, conf) }))
                .filter((x) => x.ta.action === "매수")
                .sort((a, b) => (b.s.score / b.s.c.length) - (a.s.score / a.s.c.length));
              return (
                <div style={{ marginTop: 18 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: C.text, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                    <TrendingUp size={15} color={C.up} /> 매수 후보 {buys.length > 0 ? `(${buys.length})` : ""}
                  </div>
                  <div style={{ fontSize: 10.5, color: C.dim, marginBottom: 10, lineHeight: 1.5 }}>
                    C1~C7 강신호 + 지수 우호 + 확인지표 통과 종목입니다. 클릭하면 상세 신호와 손절·익절가를 봅니다. (자동 수집/조회된 종목 기준)
                  </div>
                  {buys.length === 0 ? (
                    <Card style={{ textAlign: "center", color: C.dim, fontSize: 12, padding: "18px 14px" }}>
                      현재 매수 조건을 충족하는 종목이 없습니다. 시장 환경이 약하거나 아직 데이터 수집 전일 수 있어요.
                    </Card>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                      {buys.slice(0, 20).map(({ s, ta }) => {
                        const gg = grade(s.score, s.c.length);
                        return (
                          <button key={s.t} onClick={() => { setOvSelected(s.t); fetchOne(s.t); }} style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 13px", borderRadius: 9,
                            background: C.panel2, border: `1px solid ${C.up}33`, cursor: "pointer", textAlign: "left", width: "100%",
                          }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                              <span style={{ width: 8, height: 8, borderRadius: 999, background: s.color, flexShrink: 0 }} />
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{s.t} {s.imminent ? <span style={{ fontSize: 9, color: C.amber }}>⚡</span> : null}</div>
                                <div style={{ fontSize: 10, color: C.dim, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name || s.sector}</div>
                              </div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                              {ta.size && <span style={{ fontSize: 10, color: C.up }}>비중 {ta.size}</span>}
                              <span style={{ fontSize: 14, fontWeight: 800, color: gg.color, fontVariantNumeric: "tabular-nums" }}>{s.score}<span style={{ fontSize: 9, color: C.dim }}>/{s.c.length}</span></span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}
          </>
        )}

        {/* ── 즐겨찾기 ── */}
        {tab === "favorites" && (
          <>
            <SectionTitle icon={Star} sub="저장 종목의 데일리 매수/보유/매도 체크">즐겨찾기</SectionTitle>
            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "0 2px 12px" }}>
              <div style={{ fontSize: 10.5, color: C.dim, lineHeight: 1.5, flex: 1 }}>
                종합 탭에서 종목 검색 후 '즐겨찾기 추가'로 누적됩니다. 탭을 열 때마다 실시간 조회해 종목별 행동(매수·보유·매도)을 판정합니다. (모든 사용자 공유 목록)
              </div>
              <button onClick={() => refreshFavorites()} disabled={favLoading} style={{
                display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8,
                border: `1px solid ${C.line}`, background: C.panel2, color: C.sub, cursor: favLoading ? "default" : "pointer", fontSize: 12, fontWeight: 600, flexShrink: 0,
              }}>
                <RefreshCw size={13} style={favLoading ? { animation: "spin 1s linear infinite" } : undefined} /> 갱신
              </button>
            </div>
            {favMsg && <div style={{ fontSize: 10.5, color: favMsg.includes("실패") ? C.down : C.dim, marginBottom: 10 }}>{favMsg}</div>}

            {favTickers.length === 0 ? (
              <Card style={{ textAlign: "center", color: C.dim, fontSize: 13, padding: "28px 16px" }}>
                <Star size={22} color={C.dim} style={{ marginBottom: 8 }} />
                <div>아직 즐겨찾기한 종목이 없습니다.</div>
                <div style={{ fontSize: 11, marginTop: 6 }}>종합 탭에서 종목을 검색한 뒤 '즐겨찾기 추가'를 누르세요.</div>
              </Card>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {favTickers.map((tk) => {
                  const d = favData[tk];
                  if (!d || d.error) {
                    return (
                      <Card key={tk} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>{tk}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: 11, color: C.dim }}>{favLoading ? "조회 중…" : (d && d.error ? "데이터 없음" : "대기")}</span>
                          <button onClick={() => toggleFavorite(tk, false)} style={{ border: "none", background: "transparent", color: C.dim, cursor: "pointer", fontSize: 16 }}>✕</button>
                        </div>
                      </Card>
                    );
                  }
                  // 실시간 데이터로 매수/보유/매도 판정
                  const stObj = { t: tk, name: d.name, sector: "즐겨찾기", color: C.brass, c: d.c, score: d.score, pull: d.pull, close: d.close, atr: d.atr, per: d.per, pbr: d.pbr, imminent: d.imminent, analyzed: true };
                  const ta = tradeAction(stObj, { NDX: ndx, SPX: spx }, conf);
                  return (
                    <Card key={tk} style={{ borderLeft: `3px solid ${ta.color}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 16, fontWeight: 800, color: C.text }}>{tk}</span>
                            {d.name && <span style={{ fontSize: 11.5, color: C.sub }}>{d.name}</span>}
                            {d.imminent ? <span style={{ fontSize: 9, color: C.amber }}>⚡ 돌파임박</span> : null}
                          </div>
                          <div style={{ display: "flex", gap: 12, marginTop: 4, fontSize: 11, color: C.sub, flexWrap: "wrap" }}>
                            {d.close != null && <span>현재가 <b style={{ color: C.text }}>${d.close.toLocaleString()}</b></span>}
                            {d.combined
                              ? <span>강도 <b style={{ color: C.text }}>{d.combined.strength}%</b> <span style={{ color: C.dim }}>({d.combined.plusCount}/{d.combined.totalFactors})</span></span>
                              : <span>점수 <b style={{ color: C.text }}>{d.score}/{d.c ? d.c.length : 7}</b></span>}
                            {d.pull != null && <span>고점대비 {d.pull}%</span>}
                            {d.multiTrend && <span style={{ color: d.multiTrend.phaseColor === "up" ? C.up : d.multiTrend.phaseColor === "down" ? C.down : C.dim }}>추세: {d.multiTrend.phase}</span>}
                          </div>
                          <div style={{ fontSize: 11.5, color: C.dim, marginTop: 6, lineHeight: 1.5 }}>{ta.reason}</div>
                          {ta.lvl && (
                            <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: 10.5 }}>
                              <span style={{ color: C.down }}>손절 ${ta.lvl.stop}</span>
                              <span style={{ color: C.amber }}>추적 ${ta.lvl.trail}</span>
                              <span style={{ color: C.up }}>익절 ${ta.lvl.target}</span>
                            </div>
                          )}
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                          <span style={{ padding: "5px 12px", borderRadius: 999, background: `${ta.color}22`, color: ta.color, fontSize: 13, fontWeight: 800 }}>{ta.action}</span>
                          {ta.size && <span style={{ fontSize: 10, color: C.dim }}>제안 비중 {ta.size}</span>}
                          <button onClick={() => toggleFavorite(tk, false)} style={{ border: "none", background: "transparent", color: C.dim, cursor: "pointer", fontSize: 14 }}>✕ 삭제</button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── 확인지표 ── */}
        {tab === "confirm" && (
          <>
            <SectionTitle icon={ShieldCheck} sub="C1 추세 · C2 변동성 · C3 신용">확인 지표 (Confirmation)</SectionTitle>
            <div style={{ fontSize: 10.5, color: C.dim, margin: "0 2px 12px", lineHeight: 1.5 }}>
              {lastUpdated
                ? `실시간 갱신됨${confData.vixProxy ? " · VIX는 VIXY 프록시(추세 기준)" : ""} · 12M ROC는 지수 252일 수익률로 산출`
                : "예시 데이터(미갱신) · '실데이터 갱신' 시 VIX·HYG·12M ROC가 최신값으로 계산됩니다"}
            </div>
            {conf.all.map((x, i) => (
              <Card key={i} style={{ marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px" }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{x.name}</div>
                  <div style={{ fontSize: 11, color: C.dim }}>기준 {x.base}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: x.pass ? C.up : C.down, fontVariantNumeric: "tabular-nums" }}>{x.val}</div>
                  <div style={{ fontSize: 11, color: x.pass ? C.up : C.down }}>{x.pass ? "✓ 통과" : "✗ 미달"}{x.extra ? ` · ${x.extra}` : ""}</div>
                </div>
              </Card>
            ))}
            <Card style={{ background: conf.allPass ? `${C.up}12` : `${C.down}12`, borderColor: conf.allPass ? `${C.up}44` : `${C.down}44` }}>
              <b style={{ color: conf.allPass ? C.up : C.down, fontSize: 13.5 }}>판정: {conf.allPass ? "거시 환경 강세 신호 유효" : "환경 약화 — 방어적 접근"}</b>
              <div style={{ fontSize: 12.5, color: C.sub, lineHeight: 1.8, marginTop: 6 }}>
                {(() => {
                  const v = confData.vix, vp = confData.vixPrev, h = confData.hyg20, rn = confData.rocNDX;
                  const vixDir = (vp != null && v != null) ? (v < vp ? `전주 ${vp}에서 하락` : v > vp ? `전주 ${vp}에서 상승` : `전주와 동일`) : "";
                  const vixZone = v != null ? (v < 20 ? "20 이하 리스크온 구간" : v < 30 ? "20~30 중립 구간" : "30 이상 불안 구간") : "";
                  const hygTxt = h != null ? (h > 0 ? `HYG +${h}%는 신용 스프레드 축소로 기업 신뢰 양호` : `HYG ${h}%로 신용 위축 신호`) : "";
                  const rocTxt = rn != null ? (rn > 0 ? "12M ROC 양수로 장기 추세 상방" : "12M ROC 음수로 장기 추세 약화") : "";
                  return `VIX ${v ?? "—"}${vixDir ? ` (${vixDir})` : ""} — ${vixZone}. ${hygTxt}. ${rocTxt}.`;
                })()}
                {confData.vixProxy ? " (VIX는 VIXY 프록시 기준)" : ""}
              </div>
            </Card>
          </>
        )}

        {/* ── 섹터 ── */}
        {tab === "sectors" && (
          <>
            <SectionTitle icon={Layers} sub="섹터 대표 ETF를 C1~C7로 평가 · 충족률 내림차순">섹터 리포트</SectionTitle>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ fontSize: 10.5, color: C.dim, lineHeight: 1.5, flex: 1 }}>
                각 섹터를 대표 ETF(SOXX·XLK·IGV·XLV·XLY)로 잡아, 개별 종목과 동일한 C1~C7 기준으로 평가합니다. ETF 5개만 조회해 한도 부담이 없습니다.
              </div>
              <button onClick={refreshSectors} disabled={sectorLoading} style={{
                display: "inline-flex", alignItems: "center", gap: 5, padding: "8px 14px", borderRadius: 9, cursor: sectorLoading ? "wait" : "pointer", marginLeft: 10,
                background: sectorLoading ? C.line : C.brass, color: sectorLoading ? C.sub : C.bg, border: "none", fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap",
              }}>
                <RefreshCw size={13} style={sectorLoading ? { animation: "spin 1s linear infinite" } : undefined} /> {sectorLoading ? "평가 중…" : "섹터 갱신"}
              </button>
            </div>
            {sectorMsg && <div style={{ fontSize: 10.5, color: sectorMsg.includes("실패") || sectorMsg.includes("오류") ? C.down : C.dim, marginBottom: 12 }}>↻ {sectorMsg}</div>}

            {/* C1~C7 평가 기준 범례 */}
            <Card style={{ marginBottom: 14, background: C.panel2 }}>
              <div style={{ fontSize: 11, color: C.sub, fontWeight: 700, marginBottom: 8 }}>평가 기준 (C1~C7)</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px 14px" }}>
                {C_LEGEND.map((d, j) => (
                  <div key={j} style={{ display: "flex", gap: 6, fontSize: 10, color: C.dim, lineHeight: 1.45 }}>
                    <span style={{ color: C.brass, fontWeight: 700, flexShrink: 0 }}>C{j + 1}</span>
                    <span>{d}</span>
                  </div>
                ))}
              </div>
            </Card>

            {!sectorLive && !sectorMsg && (
              <Card style={{ textAlign: "center", color: C.dim, fontSize: 12.5, padding: "22px 16px" }}>
                '섹터 갱신'을 누르면 5개 섹터 ETF의 실시간 C1~C7 점수가 평가되어 충족률 순으로 표시됩니다.
              </Card>
            )}

            {sectorLive && Object.values(sectorLive)
              .sort((a, b) => (b.score / b.c.length) - (a.score / a.c.length))
              .map((s) => {
                const g = grade(s.score, s.c.length);
                const labels = ["C1 추세", "C2 풀백", "C3 베이스", "C4 수축", "C5 돌파", "C6 거래량", "C7 주도주"];
                return (
                  <Card key={s.sector} style={{ marginBottom: 12, borderColor: `${g.color}44` }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color }} />
                        <b style={{ fontSize: 15 }}>{s.sector}</b>
                        <span style={{ fontSize: 11, color: C.dim }}>{s.etf}</span>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <span style={{ fontSize: 20, fontWeight: 800, color: g.color, fontVariantNumeric: "tabular-nums" }}>{s.score}<span style={{ fontSize: 11, color: C.dim }}>/{s.c.length}</span></span>
                        <span style={{ fontSize: 11, color: g.color, fontWeight: 700, marginLeft: 7 }}>{g.dot} {g.label}</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.sub, marginBottom: 10 }}>
                      <span>현재가 ${s.close}</span>
                      <span style={{ color: s.dayChg >= 0 ? C.up : C.down }}>당일 {s.dayChg > 0 ? "+" : ""}{s.dayChg}%</span>
                      <span style={{ color: s.pull <= 0 ? C.down : C.up }}>고점대비 {s.pull > 0 ? "+" : ""}{s.pull}%</span>
                    </div>
                    {(s.combined || s.multiTrend) && (
                      <div style={{ display: "flex", gap: 14, fontSize: 10.5, color: C.dim, marginBottom: 10, flexWrap: "wrap" }}>
                        {s.combined && <span>10팩터 강도 <b style={{ color: g.color }}>{s.combined.strength}%</b> ({s.combined.plusCount}/{s.combined.totalFactors})</span>}
                        {s.multiTrend && <span>추세 <b style={{ color: s.multiTrend.phaseColor === "up" ? C.up : s.multiTrend.phaseColor === "down" ? C.down : C.dim }}>{s.multiTrend.phase}</b></span>}
                      </div>
                    )}
                    <div style={{ display: "grid", gridTemplateColumns: `repeat(${s.c.length},1fr)`, gap: 5 }}>
                      {s.c.map((v, j) => (
                        <div key={j} style={{ textAlign: "center", padding: "7px 1px", borderRadius: 7, background: v ? `${g.color}1A` : C.panel2, border: `1px solid ${v ? `${g.color}44` : C.line}` }}>
                          <div style={{ fontSize: 12, color: v ? g.color : C.dim }}>{v ? "✓" : "—"}</div>
                          <div style={{ fontSize: 7.5, color: C.dim, marginTop: 2 }}>{labels[j].split(" ")[0]}</div>
                        </div>
                      ))}
                    </div>
                    {/* 섹터 소속 종목 (저장된 실데이터 기준, 충족률 내림차순) */}
                    {(() => {
                      const members = allStocks
                        .filter((a) => a.sector === s.sector && a.analyzed && a.c)
                        .sort((x, y) => (y.score / y.c.length) - (x.score / x.c.length));
                      if (!members.length) return null;
                      return (
                        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.line}` }}>
                          <div style={{ fontSize: 10.5, color: C.dim, marginBottom: 8 }}>섹터 종목 ({members.length}) · 충족률순</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {members.map((st) => {
                              const mg = grade(st.score, st.c.length);
                              return (
                                <span key={st.t} title={st.note} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 9px", borderRadius: 8, background: C.panel2, border: `1px solid ${mg.color}33`, fontSize: 11.5, fontWeight: 600 }}>
                                  {st.live && <span style={{ width: 5, height: 5, borderRadius: 999, background: C.up }} />}
                                  {st.t} <span style={{ color: mg.color }}>{st.score}<span style={{ color: C.dim, fontSize: 9.5 }}>/{st.c.length}</span></span>
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </Card>
                );
              })}
          </>
        )}

        {/* ── 베이스 스캔 (랭킹) ── */}
        {tab === "scan" && (
          <>
            <SectionTitle icon={TrendingUp} sub="충족률(점수/만점) 내림차순 · C1~C7">베이스 스캔 하이라이트</SectionTitle>
            <div style={{ fontSize: 11.5, color: C.dim, margin: "0 2px 12px", fontStyle: "italic" }}>C1 정배열 · C2 ATR풀백 · C3 베이스 · C4 변동성수축 · C5 돌파 · C6 거래량 · C7 주도주RS (종목별 5~7항목)</div>
            {ranked.map((st, i) => {
              const g = grade(st.score, (st.c ? st.c.length : 5));
              return (
                <Card key={st.t} style={{ marginBottom: 8, padding: "13px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ fontSize: 11, color: C.dim, width: 22, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{i + 1}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                        <b style={{ fontSize: 14.5 }}>{st.t}</b>
                        <span style={{ fontSize: 10.5, color: st.color }}>{st.sector}</span>
                        {(() => {
                          const lp = scanLivePull[st.t];
                          const showPull = lp && lp.pull != null ? lp.pull : st.pull;
                          const isLive = lp && lp.pull != null;
                          return (
                            <>
                              <span style={{ fontSize: 11, color: showPull <= 0 ? C.down : C.up, fontVariantNumeric: "tabular-nums" }}>
                                풀백 {showPull > 0 ? "+" : ""}{showPull}%
                              </span>
                              {isLive && (
                                <span style={{ fontSize: 9.5, color: C.up, background: `${C.up}1A`, padding: "1px 6px", borderRadius: 999 }}>
                                  실시간 ${lp.px} ({lp.at})
                                </span>
                              )}
                              {lp && lp.error && (
                                <span style={{ fontSize: 9.5, color: C.down }}>갱신 실패</span>
                              )}
                              <button
                                onClick={() => refreshScanPull(st.t)}
                                disabled={scanLiveLoading[st.t]}
                                style={{ fontSize: 9.5, color: C.sub, background: "transparent", border: `1px solid ${C.line}`, borderRadius: 999, padding: "1px 8px", cursor: scanLiveLoading[st.t] ? "default" : "pointer" }}
                              >
                                {scanLiveLoading[st.t] ? "갱신 중…" : "↻ 실시간"}
                              </button>
                            </>
                          );
                        })()}
                      </div>
                      <div style={{ fontSize: 11.5, color: C.sub, marginTop: 3, lineHeight: 1.5 }}>{st.note}</div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: g.color, fontVariantNumeric: "tabular-nums" }}>{st.score}<span style={{ fontSize: 11, color: C.dim }}>/{st.c.length}</span></div>
                      <div style={{ display: "flex", gap: 2, justifyContent: "center", marginTop: 2 }}>
                        {st.c.map((v, j) => <span key={j} style={{ width: 5, height: 5, borderRadius: 1.5, background: v ? g.color : C.line }} />)}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </>
        )}

        {/* ── 이벤트 ── */}
        {tab === "calendar" && (
          <>
            <SectionTitle icon={Calendar} sub="오늘부터 30일 · 정기 이벤트 자동 생성 · 오름차순">매크로 캘린더 & 리스크</SectionTitle>
            <div style={{ fontSize: 10.5, color: C.dim, margin: "0 2px 12px", lineHeight: 1.5 }}>
              일정·예상치·실제치는 ForexFactory(Fair Economy) 이번 주 미국 경제 캘린더 기준입니다. 발표 완료 시 예상 vs 실제(서프라이즈), 발표 전이면 예상 vs 이전(예상 방향)으로 ±를 판정합니다. 영향도 High/Medium 위주로 표시.
              {eventBiasLoading ? " · 조회 중…" : eventBiasAt ? ` · 기준 ${new Date(eventBiasAt).toLocaleTimeString("ko-KR")}` : ""}
            </div>
            {newsMood && (
              <Card style={{ marginBottom: 12, background: C.panel2 }}>
                <div style={{ fontSize: 12, color: C.sub }}>
                  최근 3일 시장 뉴스 분위기: <b style={{ color: newsMood.mood === "우호적" ? C.up : newsMood.mood === "신중" ? C.down : C.sub }}>{newsMood.mood}</b>
                  <span style={{ fontSize: 10.5, color: C.dim }}> (긍정 {newsMood.pos}·부정 {newsMood.neg} 신호, 기사 {newsMood.n}건) · 보조 참고용</span>
                </div>
              </Card>
            )}
            {ffEvents ? (() => {
              const impLabel = { High: "매우 높음", Medium: "보통", Low: "낮음", Holiday: "휴장" };
              const fmtDate = (iso) => {
                try { const d = new Date(iso); return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`; }
                catch (e) { return iso; }
              };
              // Low 영향은 너무 많으니 High/Medium 우선 노출(나머지는 접어둠)
              const shown = ffEvents.filter((e) => e.impact === "High" || e.impact === "Medium");
              const list = shown.length ? shown : ffEvents;
              return list.map((e, i) => {
                const bc = e.bias === "plus" ? C.up : e.bias === "minus" ? C.down : C.sub;
                const bl = e.bias === "plus" ? "플러스 요인" : e.bias === "minus" ? "마이너스 요인" : "중립";
                const ic = e.impact === "High" ? C.down : e.impact === "Medium" ? C.amber : C.dim;
                return (
                  <Card key={i} style={{ marginBottom: 8, borderLeft: `3px solid ${bc}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, color: C.dim }}>{fmtDate(e.date)}</div>
                        <div style={{ fontSize: 14, fontWeight: 700, marginTop: 1 }}>{e.title}</div>
                        <div style={{ fontSize: 12, color: C.sub, marginTop: 4, display: "flex", gap: 12, flexWrap: "wrap" }}>
                          {e.previous != null && <span>이전 <b style={{ color: C.text }}>{e.previous}</b></span>}
                          {e.forecast != null && <span>예상 <b style={{ color: C.text }}>{e.forecast}</b></span>}
                          {e.actual != null && <span>실제 <b style={{ color: bc }}>{e.actual}</b></span>}
                        </div>
                        {e.why && <div style={{ fontSize: 11.5, color: C.dim, marginTop: 6, lineHeight: 1.6 }}>{e.label} · {e.why}</div>}
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <span style={{ padding: "3px 9px", borderRadius: 999, background: `${bc}22`, color: bc, fontSize: 11, fontWeight: 700 }}>{bl}</span>
                        <div style={{ fontSize: 10.5, color: ic, marginTop: 6 }}>영향 {impLabel[e.impact] || e.impact}</div>
                      </div>
                    </div>
                  </Card>
                );
              });
            })() : events.map((e, i) => {
              const bc = e.bias === "plus" ? C.up : e.bias === "minus" ? C.down : C.sub;
              const bl = e.bias === "plus" ? "플러스 요인" : e.bias === "minus" ? "마이너스 요인" : "중립";
              return (
                <Card key={i} style={{ marginBottom: 8, borderLeft: `3px solid ${bc}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, color: C.dim }}>{e.date}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, marginTop: 1 }}>{e.ev}</div>
                      <div style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>예상: {e.exp}</div>
                      <div style={{ fontSize: 11.5, color: C.dim, marginTop: 6, lineHeight: 1.6 }}>{e.why}</div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <span style={{ padding: "3px 9px", borderRadius: 999, background: `${bc}22`, color: bc, fontSize: 11, fontWeight: 700 }}>{bl}</span>
                      <div style={{ fontSize: 10.5, color: C.dim, marginTop: 6 }}>영향 {e.impact}</div>
                    </div>
                  </div>
                </Card>
              );
            })}
            <Card style={{ background: `${C.down}10`, borderColor: `${C.down}33` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <AlertTriangle size={15} color={C.down} /><b style={{ fontSize: 13, color: C.down }}>이벤트 활용법</b>
              </div>
              <div style={{ fontSize: 12.5, color: C.sub, marginTop: 6, lineHeight: 1.8 }}>
                일정·수치는 ForexFactory 기준으로 시간당 갱신됩니다. 발표 전 이벤트는 '예상 vs 이전'으로 방향만 참고하고, 발표 후 실제치가 나오면 서프라이즈(예상 대비)로 ±가 확정됩니다. <b style={{ color: C.text }}>영향 '매우 높음'</b>(CPI·고용·FOMC 등) 전후로는 변동성이 커지니 신규 진입에 유의하세요.
              </div>
            </Card>
          </>
        )}

        {/* ── 백테스트 ── */}
        {tab === "lookup" && (
          <>
            <SectionTitle icon={FlaskConical} sub="종목·기간·금액 입력 → 매수후보유 vs 전략 비교">백테스트</SectionTitle>

            <Card style={{ marginBottom: 14 }}>
              <div style={{ marginBottom: 12 }}>
                <span style={{ display: "block", fontSize: 11, color: C.sub, marginBottom: 6 }}>종목 티커</span>
                <input value={btTicker} onChange={(e) => { setBtTicker(e.target.value); setBtPicked(false); }} placeholder="예: NVDA (알파벳 입력 시 목록)"
                  style={{ width: "100%", boxSizing: "border-box", padding: "12px 14px", fontSize: 15, borderRadius: 10, border: `1px solid ${C.line}`, background: C.panel2, color: C.text, outline: "none", textTransform: "uppercase" }} />
                {/* 자동완성: 입력 중이고 아직 선택 안 했을 때 */}
                {(() => {
                  const q = btTicker.trim().toLowerCase();
                  if (!q || btPicked) return null;
                  const found = allStocks.filter((s) => s.t.toLowerCase().includes(q)).slice(0, 8);
                  if (found.length === 0) {
                    return <div style={{ fontSize: 10.5, color: C.dim, marginTop: 6 }}>"{btTicker.toUpperCase()}"는 수록 목록에 없습니다. 그대로 입력해 백테스트를 실행하면 실제 시세로 조회합니다.</div>;
                  }
                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 7 }}>
                      {found.map((s) => (
                        <button key={s.t} onClick={() => { setBtTicker(s.t); setBtPicked(true); }} style={{
                          display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, cursor: "pointer", textAlign: "left",
                          background: C.panel, border: `1px solid ${C.line}`,
                        }}>
                          <span style={{ width: 7, height: 7, borderRadius: 2, background: s.color || C.dim, flexShrink: 0 }} />
                          <span style={{ fontSize: 13, fontWeight: 700, color: C.text, minWidth: 48 }}>{s.t}</span>
                          <span style={{ fontSize: 10.5, color: C.sub, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name || s.sector}</span>
                          <ChevronRight size={14} color={C.dim} />
                        </button>
                      ))}
                    </div>
                  );
                })()}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                <div>
                  <span style={{ display: "block", fontSize: 11, color: C.sub, marginBottom: 6 }}>시작일</span>
                  <input type="date" value={btStart} onChange={(e) => setBtStart(e.target.value)}
                    style={{ width: "100%", boxSizing: "border-box", padding: "12px 12px", fontSize: 14, borderRadius: 10, border: `1px solid ${C.line}`, background: C.panel2, color: C.text, outline: "none" }} />
                </div>
                <div>
                  <span style={{ display: "block", fontSize: 11, color: C.sub, marginBottom: 6 }}>종료일</span>
                  <input type="date" value={btEnd} onChange={(e) => setBtEnd(e.target.value)}
                    style={{ width: "100%", boxSizing: "border-box", padding: "12px 12px", fontSize: 14, borderRadius: 10, border: `1px solid ${C.line}`, background: C.panel2, color: C.text, outline: "none" }} />
                </div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <span style={{ display: "block", fontSize: 11, color: C.sub, marginBottom: 6 }}>투자 금액 ($)</span>
                <input type="number" value={btAmount} onChange={(e) => setBtAmount(e.target.value)} placeholder="10000"
                  style={{ width: "100%", boxSizing: "border-box", padding: "12px 14px", fontSize: 15, borderRadius: 10, border: `1px solid ${C.line}`, background: C.panel2, color: C.text, outline: "none", fontVariantNumeric: "tabular-nums" }} />
              </div>
              <button onClick={runBT} style={{
                width: "100%", padding: "13px 0", borderRadius: 10, border: "none", cursor: "pointer",
                background: C.brass, color: C.bg, fontSize: 14, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}><FlaskConical size={16} /> 백테스트 실행</button>
              {btError && <div style={{ marginTop: 10, fontSize: 12, color: C.down }}>{btError}</div>}
              <div style={{ marginTop: 10, fontSize: 10, color: C.dim, lineHeight: 1.5 }}>
                ※ 백테스트는 실제 시세 API(/api/series)를 우선 사용하고, 실패 시 모의 시계열로 폴백합니다. 차트 우측 상단 배지에 데이터 출처(실제 API/모의)가 표시됩니다.
              </div>
            </Card>

            {btResult && (
              <>
                {/* 요약 카드 (레버리지 타이밍 포함 시 3개) */}
                <div style={{ display: "grid", gridTemplateColumns: btResult.levTiming ? "1fr 1fr 1fr" : "1fr 1fr", gap: 10, marginBottom: 12 }}>
                  {[
                    { key: "hold", title: "매수 후 보유", icon: Wallet, sub: "시작일 전액 매수 → 보유", r: btResult.hold, accent: C.blue },
                    { key: "strat", title: "전략 매매", icon: Target, sub: "C1~C5 점수: 4점↑매수·2점↓매도", r: btResult.strat, accent: C.brass },
                    ...(btResult.levTiming ? [{ key: "lev", title: "2배+200일선", icon: Zap, sub: "200일선 위에서만 2배 보유", r: btResult.levTiming, accent: C.violet }] : []),
                  ].map((b) => {
                    const up = b.r.profit >= 0;
                    const Icon = b.icon;
                    return (
                      <Card key={b.key} style={{ borderColor: `${b.accent}44`, padding: 15 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                          <Icon size={14} color={b.accent} /><b style={{ fontSize: 12.5, color: b.accent }}>{b.title}</b>
                        </div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: C.text, fontVariantNumeric: "tabular-nums", lineHeight: 1.1 }}>
                          ${b.r.finalValue.toLocaleString()}
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: up ? C.up : C.down, marginTop: 3, display: "flex", alignItems: "center", gap: 3 }}>
                          {up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{up ? "+" : ""}{b.r.retPct.toFixed(1)}% ({up ? "+" : ""}${b.r.profit.toLocaleString(undefined, { maximumFractionDigits: 0 })})
                        </div>
                        <div style={{ fontSize: 10, color: C.dim, marginTop: 8, lineHeight: 1.5 }}>
                          최대낙폭 {b.r.maxDD.toFixed(1)}%{b.key === "strat" ? ` · 매매 ${b.r.trades}회` : ""}{b.key === "lev" ? ` · 전환 ${b.r.switches}회` : ""}
                          {b.key === "strat" && (
                            <div style={{ marginTop: 3, fontSize: 9, color: C.dim, lineHeight: 1.5 }}>
                              손절 {b.r.stops || 0} · 추적손절 {b.r.trails || 0} · 익절 {b.r.takes || 0}
                              {(b.r.skipsRR || b.r.skipsEarn) ? ` · 진입거름(손익비 ${b.r.skipsRR || 0}/실적 ${b.r.skipsEarn || 0})` : ""}
                            </div>
                          )}
                          {b.key === "lev" && (
                            <div style={{ marginTop: 3, fontSize: 9, color: C.amber, lineHeight: 1.5 }}>
                              ⚠ 레버리지·단일종목 위험 큼 (참고용)
                            </div>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>

                {/* 승자 배너 */}
                {(() => {
                  const diff = btResult.strat.finalValue - btResult.hold.finalValue;
                  const stratWin = diff > 0;
                  const c = stratWin ? C.brass : C.blue;
                  return (
                    <Card style={{ marginBottom: 14, background: `${c}10`, borderColor: `${c}44` }}>
                      <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.7 }}>
                        <b style={{ color: c }}>{stratWin ? "전략 매매" : "매수 후 보유"}</b>가 이 기간 동안
                        <b style={{ color: c }}> ${Math.abs(diff).toLocaleString(undefined, { maximumFractionDigits: 0 })}</b> 더 우수했습니다.
                        {stratWin
                          ? " 전략이 하락 구간에서 현금화해 낙폭을 줄인 효과입니다."
                          : " 추세가 꾸준해 매매 전환 없이 보유하는 편이 나았던 구간입니다."}
                      </div>
                    </Card>
                  );
                })()}

                {/* 자산가치 추이 차트 */}
                <Card style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <span style={{ fontSize: 12, color: C.sub }}>자산가치 추이 ({btResult.tk})</span>
                    <span style={{ fontSize: 9.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
                      color: btResult.isReal ? C.up : C.amber, background: `${btResult.isReal ? C.up : C.amber}1A` }}>
                      {btResult.source || (btResult.isReal ? "실제 API" : "모의 데이터")}
                    </span>
                  </div>
                  <div style={{ width: "100%", height: 240 }}>
                    <ResponsiveContainer>
                      <LineChart data={btResult.chart} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid stroke={C.line} strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="date" tick={{ fill: C.dim, fontSize: 9 }} minTickGap={40} tickFormatter={(d) => d.slice(5)} stroke={C.line} />
                        <YAxis tick={{ fill: C.dim, fontSize: 9 }} width={48} stroke={C.line} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} domain={["auto", "auto"]} />
                        <Tooltip contentStyle={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 12, color: C.text }}
                          labelStyle={{ color: C.sub }} formatter={(v) => `$${Number(v).toLocaleString()}`} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Line type="monotone" dataKey="매수후보유" stroke={C.blue} dot={false} strokeWidth={2} />
                        {btResult.levTiming && (
                          <Line type="monotone" dataKey="2배+200일" stroke={C.violet} dot={false} strokeWidth={1.7} strokeDasharray="5 3" />
                        )}
                        <Line type="monotone" dataKey="전략" stroke={C.brass} strokeWidth={2}
                          dot={(props) => {
                            const { cx, cy, payload } = props;
                            if (!payload || !payload.sigType) return <g key={props.key} />;
                            const isBuy = payload.sigType === "buy";
                            const col = isBuy ? C.up : C.down;
                            return (
                              <g key={props.key}>
                                <circle cx={cx} cy={cy} r={4} fill={col} stroke={C.bg} strokeWidth={1.5} />
                              </g>
                            );
                          }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ fontSize: 10.5, color: C.dim, marginTop: 6, display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
                    <span><span style={{ color: C.up }}>●</span> 분할 매수</span>
                    <span><span style={{ color: C.down }}>●</span> 분할 매도(추세꺾임/추적손절)</span>
                    {btResult.levTiming && <span><span style={{ color: C.violet }}>┄</span> 2배+200일선</span>}
                    <span>총 {btResult.strat.trades}회 체결 (추적손절 {btResult.strat.trails})</span>
                  </div>
                  <div style={{ fontSize: 9.5, color: C.dim, marginTop: 4, textAlign: "center", lineHeight: 1.5 }}>
                    전략: 진입 50% + 고점대비 −5/−10/−15% 분할매수(MACD 반등확인) · 추세꺾임+C≤2 또는 추적손절 −25%에서 1/3씩 분할매도.
                    낙폭 방어 중심 — 강한 상승장에선 바이앤홀드가 더 유리할 수 있습니다.
                    {btResult.levTiming && (
                      <div style={{ marginTop: 4, color: C.amber }}>
                        2배+200일선: 종목을 2배로 추종하되 200일 이동평균선 위에서만 보유(아래면 현금). 백테스트상 위험대비 수익이 좋았으나, 단일 종목 레버리지는 변동성 끌림·갭하락 위험이 크고 과거 강세장 결과가 미래에 재현된다는 보장이 없습니다. 참고용입니다.
                      </div>
                    )}
                  </div>
                </Card>

                {/* 종목 전략 신호 (현재 시점) */}
                <div style={{ fontSize: 11, color: C.dim, margin: "4px 2px 8px" }}>참고: {btResult.tk}의 최근 베이스 스캔 신호와 전략 행동</div>
                <StockSignalCard st={btResult.meta} idxStates={{ NDX: ndx, SPX: spx }} conf={conf} />
              </>
            )}

            {!btResult && !btError && (
              <div style={{ fontSize: 12, color: C.dim, textAlign: "center", padding: "10px 0", lineHeight: 1.6 }}>
                종목·기간·금액을 입력하고 실행하면 <b style={{ color: C.sub }}>매수 후 보유</b>와 <b style={{ color: C.sub }}>전략 매매</b> 결과를 동시에 비교합니다.<br />
                수록 종목 {allStocks.length}개(NASDAQ 100 전체 포함) 중에서 선택하세요.
              </div>
            )}
          </>
        )}

        <div style={{ marginTop: 26, padding: "12px 14px", background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, fontSize: 10.5, color: C.dim, lineHeight: 1.6 }}>
          ⚠️ 본 대시보드는 첨부 리포트의 방법론을 구현한 분석 도구이며 투자 자문이 아닙니다. 지수·확인지표는 '지수·지표 갱신'으로, 종목·섹터·베이스스캔은 장 마감 후 자동 수집분으로, 이벤트 평가는 탭 진입 시 최신 뉴스로 갱신됩니다. 실제 매매 전 최신 데이터로 다시 검증하세요.
        </div>
      </div>
    </div>
  );
}
