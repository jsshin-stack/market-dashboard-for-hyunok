import { useState, useMemo } from "react";
import {
  TrendingUp, Activity, Layers, Calendar, Search, ShieldCheck,
  AlertTriangle, ChevronDown, ChevronUp, ChevronRight, Gauge, ArrowUpRight, ArrowDownRight, Minus, Target,
  FlaskConical, Wallet, RefreshCw,
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

/* ── 설계 토큰: 트레이딩 터미널의 차분한 정밀함 ───────────────── */
const C = {
  bg: "#0E1420", panel: "#161E2D", panel2: "#1D2738", line: "#2A3548",
  text: "#E8EDF4", sub: "#8B97A8", dim: "#5C6878",
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
    { t: "NVDA", pull: -10.2, c: [0,1,1,0,0], note: "$212.45 / 52wH $236.54 → -10.2% 풀백. MA200($215.15) 약간 하회로 추세 신호 미달." },
    { t: "AVGO", pull: -20.2, c: [1,0,0,0,0], note: "$394.82 / 52wH $495 → -20.2%. 풀백 폭이 베이스 기준(-18%) 초과로 과도." },
    { t: "AMD",  pull:  0.0, c: [1,0,0,0,1], note: "52주 신고가 경신(MEXT 인수+Ryzen AI). 돌파·추세 충족, 풀백 없음." },
    { t: "MU",   pull:  0.0, c: [1,0,0,0,1], note: "신 52주 고점, +11% 급등. 추세·돌파 강함, 베이스 미형성." },
    { t: "ASML", pull: -3.0, c: [1,0,0,1,1], note: "52주 범위 상단·MA200 상회. 신고가 근접, 얕은 풀백으로 MA20 수렴." },
    { t: "LRCX", pull: -2.0, c: [1,0,0,1,1], note: "+21% 급등(Q3 호실적). 고점 근접, 추세·돌파 충족." },
    { t: "KLAC", pull: -3.0, c: [1,0,0,1,1], note: "장비주 강세·ETF 유입. 신고가 근접 모멘텀." },
    { t: "AMAT", pull: -4.0, c: [1,0,1,1,1], note: "장비 수주 회복. 고점 근접, 얕은 조정으로 베이스·돌파 동시." },
    { t: "QCOM", pull: -8.0, c: [1,1,1,1,0], note: "건전한 -8% 풀백, MA200 상회. 베이스·MA20 수렴 양호." },
    { t: "TXN",  pull: -6.0, c: [1,1,1,1,0], note: "안정적 -6% 풀백. 추세 유지, 베이스 형성 구간." },
    { t: "ARM",  pull:  0.0, c: [1,0,0,0,1], note: "+5% 강세, 고점권. 모멘텀 강하나 풀백 없음." },
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
const NDX_TICKERS = new Set(NDX100.map((s) => s.t));

const EVENTS = [
  { date: "6/16 (화)", ev: "FOMC Day 1", exp: "—", impact: "높음", bias: "neutral",
    why: "회의 시작일, 직접 결정 없음. 관망 우위." },
  { date: "6/17 (수)", ev: "FOMC 금리 결정 + 기자회견", exp: "동결 (3.50~3.75%)", impact: "매우 높음", bias: "neutral",
    why: "동결 거의 확실(시장 반영 완료). 신임 Warsh 의장 첫 회의 — 매파 톤이면 마이너스." },
  { date: "6/17 (수)", ev: "FOMC 점도표 (dot plot)", exp: "연내 인하 축소/동결", impact: "시장 방향키", bias: "minus",
    why: "Warsh 의장 매파 성향. 인하 기대 후퇴 시 성장주 압박 → 마이너스 가능성." },
  { date: "6/18 (목)", ev: "신규 실업수당 청구건수", exp: "안정적", impact: "중간", bias: "neutral",
    why: "노동시장 견조 확인이면 중립. 급증 시에만 변수." },
  { date: "6/19 (금)", ev: "Juneteenth (미국 공휴일)", exp: "휴장", impact: "—", bias: "neutral",
    why: "증시 휴장. 거래 없음." },
];

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
function grade(s) {
  if (s >= 4) return { label: "1순위 매수 후보", color: C.up, dot: "🟢" };
  if (s === 3) return { label: "관찰 / 부분 매수", color: C.brass, dot: "🟡" };
  if (s === 2) return { label: "관망", color: C.amber, dot: "🟠" };
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
  const anchors = REAL_ANCHORS[ticker];
  if (anchors) {
    // 실제 앵커 기반: 주 변동성을 약간 가미해 자연스럽게 (앵커는 정확히 통과)
    const rand = rng(seedFromTicker(ticker));
    const anchorDates = new Set(anchors.map((a) => a.date));
    return days.map((d) => {
      const base = interpAnchor(anchors, d);
      // 앵커 당일은 실값 그대로, 사이 구간은 소폭 노이즈(±0.8%)
      const noise = anchorDates.has(d) ? 0 : (rand() - 0.5) * 0.016;
      return { date: d, close: +(base * (1 + noise)).toFixed(2), real: true };
    });
  }
  // 폴백: 모의 시계열
  const rand = rng(seedFromTicker(ticker));
  const score = meta?.score ?? 2;
  const drift = (score - 2) * 0.0006 + 0.0002;
  const vol = 0.012 + Math.abs(meta?.pull ?? 8) / 1000;
  let price = 100 + (seedFromTicker(ticker) % 300);
  const series = [];
  for (let i = 0; i < days.length; i++) {
    const shock = (rand() + rand() + rand() - 1.5) * 2 * vol;
    price = Math.max(1, price * (1 + drift + shock));
    series.push({ date: days[i], close: +price.toFixed(2), real: false });
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

/* === 백테스트 실행 ===
   strategyEnabled=false → 시작일 전액 매수 후 보유(Buy&Hold)
   strategyEnabled=true  → 전략 규칙으로 매수/보유/매도 전환
     규칙(모멘텀 근사): 종가>20일선 & 점수>=3 → 매수/보유,
     종가<20일선 또는 약세 → 현금 청산. (베이스 스캔 정신을 일별로 근사)
*/
function runBacktest(series, capital, meta, strategyEnabled) {
  if (series.length < 2) return null;
  const start = series[0].close;
  let cash = capital, shares = 0, inPos = false;
  let trades = 0;
  const equity = [];
  let peak = capital, maxDD = 0;

  for (let i = 0; i < series.length; i++) {
    const px = series[i].close;
    if (!strategyEnabled) {
      if (i === 0) { shares = capital / px; cash = 0; inPos = true; }
    } else {
      const ma = sma(series, i, 20);
      const bullish = ma != null && px > ma;
      const strongName = (meta?.score ?? 0) >= 3;
      const want = bullish && strongName;
      if (want && !inPos) { shares = cash / px; cash = 0; inPos = true; trades++; }
      else if (!want && inPos) { cash = shares * px; shares = 0; inPos = false; trades++; }
    }
    const val = cash + shares * px;
    peak = Math.max(peak, val);
    maxDD = Math.max(maxDD, (peak - val) / peak);
    equity.push({ date: series[i].date, value: +val.toFixed(0) });
  }
  const endVal = equity[equity.length - 1].value;
  return {
    startPrice: start, endPrice: series[series.length - 1].close,
    finalValue: endVal, profit: endVal - capital,
    retPct: ((endVal - capital) / capital) * 100,
    maxDD: maxDD * 100, trades, equity,
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
            <div style={{ fontSize: 11, color: C.dim }}>6/15 종가</div>
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
  const g = grade(st.score);
  const labels = ["C1 추세", "C2 풀백", "C3 베이스", "C4 MA20수렴", "C5 돌파"];
  const indices = stockIndices(st.t);
  return (
    <Card style={{ borderColor: `${g.color}44` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 12, color: st.color }}>{st.sector}</div>
          <div style={{ fontSize: 19, fontWeight: 800, color: C.text }}>{st.t}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: g.color, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
            {st.score}<span style={{ fontSize: 13, color: C.dim }}>/5</span>
          </div>
          <div style={{ fontSize: 11.5, color: g.color, fontWeight: 700, marginTop: 3 }}>{g.dot} {g.label}</div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "center", margin: "14px 0", padding: "10px 0", borderTop: `1px solid ${C.line}`, borderBottom: `1px solid ${C.line}` }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 10, color: C.dim, marginBottom: 3, letterSpacing: "0.04em" }}>고점 대비 풀백</div>
          <div style={{ color: st.pull <= 0 ? C.down : C.up, fontSize: 15, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
            {st.pull > 0 ? "+" : ""}{st.pull}%
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 6 }}>
        {st.c.map((v, j) => (
          <div key={j} style={{ textAlign: "center", padding: "8px 2px", borderRadius: 8, background: v ? `${g.color}1A` : C.panel2, border: `1px solid ${v ? `${g.color}44` : C.line}` }}>
            <div style={{ fontSize: 14, color: v ? g.color : C.dim }}>{v ? "✓" : "—"}</div>
            <div style={{ fontSize: 9, color: C.dim, marginTop: 2 }}>{labels[j]}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.7, marginTop: 12, padding: "10px 12px", background: C.panel2, borderRadius: 9 }}>{st.note}</div>

      {/* 지수별 전략 행동 */}
      {idxStates && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 10.5, color: C.dim, letterSpacing: "0.08em", marginBottom: 7, display: "flex", alignItems: "center", gap: 5 }}>
            <Target size={12} color={C.brass} /> 지수 환경별 전략 행동
            <span style={{ marginLeft: "auto", color: conf && conf.allPass ? C.up : C.down, fontSize: 9.5, fontWeight: 700 }}>
              {conf ? (conf.allPass ? "확인지표 ✓ 전부 통과" : "확인지표 ⚠ 일부 미달") : ""}
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: indices.length > 1 ? "1fr 1fr" : "1fr", gap: 7 }}>
            {indices.map((ix) => {
              const regime = idxStates[ix].state;
              const sg = stockStrategy(st.score, regime, conf, ix);
              return (
                <div key={ix} style={{ padding: "10px 11px", borderRadius: 9, background: `${sg.color}10`, border: `1px solid ${sg.color}33` }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontSize: 11, color: C.sub, fontWeight: 600 }}>{ix} <span style={{ color: STATE_COLOR[regime], fontSize: 10 }}>· {regime}</span></span>
                    <span style={{ fontSize: 12.5, fontWeight: 800, color: sg.color, display: "inline-flex", alignItems: "center", gap: 3 }}>
                      {sg.downgraded && <ArrowDownRight size={11} />}{sg.action}
                    </span>
                  </div>
                  {sg.fails.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 4 }}>
                      {sg.fails.map((f) => (
                        <span key={f} style={{ fontSize: 8.5, color: C.down, background: `${C.down}1A`, padding: "1px 5px", borderRadius: 4 }}>{f}</span>
                      ))}
                    </div>
                  )}
                  <div style={{ fontSize: 10.5, color: C.sub, lineHeight: 1.55 }}>{sg.note}</div>
                </div>
              );
            })}
          </div>
          {indices.length === 1 && (
            <div style={{ fontSize: 10, color: C.dim, marginTop: 6 }}>※ {st.t}는 NASDAQ 100 비편입(금융·에너지 등) → SPX 기준만 적용.</div>
          )}
        </div>
      )}
    </Card>
  );
}

/* ── 메인 앱 ─────────────────────────────────────────────────── */
export default function Dashboard() {
  const [tab, setTab] = useState("overview");
  const [ovQuery, setOvQuery] = useState("");
  const [ovSelected, setOvSelected] = useState(null);
  // 백테스트 입력 상태
  const [btTicker, setBtTicker] = useState("NVDA");
  const [btStart, setBtStart] = useState("2025-06-23");
  const [btEnd, setBtEnd] = useState("2026-06-15");
  const [btAmount, setBtAmount] = useState("10000");
  const [btResult, setBtResult] = useState(null);
  const [btError, setBtError] = useState("");
  // 실시간 갱신 상태
  const [live, setLive] = useState({});        // { NVDA: {close, c, score, pull, ...}, ... }
  const [loading, setLoading] = useState(false);
  const [liveMsg, setLiveMsg] = useState("");
  // 지수·확인지표 실시간 덮어쓰기 상태 (없으면 기본 IDX/CONFIRM 사용)
  const [liveIdx, setLiveIdx] = useState(null);     // { NDX:{...}, SPX:{...} }
  const [liveConf, setLiveConf] = useState(null);   // { vix, vixPrev, hyg20 }
  const idxData = useMemo(() => {
    const base = { NDX: { ...IDX.NDX }, SPX: { ...IDX.SPX } };
    if (liveIdx) {
      ["NDX", "SPX"].forEach((k) => {
        if (liveIdx[k] && !liveIdx[k].error) base[k] = { ...base[k], ...liveIdx[k] };
      });
    }
    return base;
  }, [liveIdx]);
  const confData = useMemo(() => ({ ...CONFIRM, ...(liveConf || {}) }), [liveConf]);
  const conf = useMemo(() => calcConfirm(confData), [confData]);
  const ndx = calcIndex(idxData.NDX), spx = calcIndex(idxData.SPX);

  // 실제 API에서 데이터 갱신 (서버 라우트 호출 → 키는 서버에 숨김)
  async function refreshLive(symbols) {
    setLoading(true);
    setLiveMsg("최신 데이터를 불러오는 중… (지수·지표·종목)");
    let stockOk = 0, macroOk = false;
    // 1) 지수·확인지표 갱신
    try {
      const mResp = await fetch("/api/macro");
      const mJson = await mResp.json();
      if (mResp.ok && mJson.ok) {
        if (mJson.idx) setLiveIdx(mJson.idx);
        if (mJson.confirm && Object.keys(mJson.confirm).length) setLiveConf(mJson.confirm);
        macroOk = true;
      }
    } catch (e) { /* 지수 갱신 실패는 무시하고 종목만 진행 */ }

    // 2) 종목 갱신 (8개씩 끊어서 순차 호출 → 무료 한도 보호)
    try {
      const merged = { ...live };
      for (let i = 0; i < symbols.length; i += 8) {
        const batch = symbols.slice(i, i + 8);
        const resp = await fetch(`/api/quote?symbols=${encodeURIComponent(batch.join(","))}`);
        const json = await resp.json();
        if (resp.ok && json.data) {
          Object.entries(json.data).forEach(([sym, d]) => { if (!d.error) { merged[sym] = d; stockOk++; } });
        }
        setLive({ ...merged });
        setLiveMsg(`갱신 중… 종목 ${stockOk}개 완료`);
      }
      setLiveMsg(`갱신 완료 · 종목 ${stockOk}개${macroOk ? " · 지수/지표 포함" : " (지수/지표는 플랜 제한으로 생략됨)"} · ${new Date().toLocaleTimeString("ko-KR")}`);
    } catch (e) {
      setLiveMsg("갱신 실패: " + e.message + " — API 키/한도를 확인하세요.");
    } finally {
      setLoading(false);
    }
  }

  const allStocks = useMemo(() => {
    // 분석값(C1~C5)이 있는 종목 맵
    const analyzed = {};
    SECTORS.forEach((s) => s.stocks.forEach((st) => {
      analyzed[st.t] = { ...st, sector: s.sector, color: s.color, score: stockScore(st.c), analyzed: true };
    }));
    // 실시간 데이터가 있으면 해당 종목의 c/score/pull을 실제값으로 덮어쓰기
    Object.entries(live).forEach(([sym, d]) => {
      if (analyzed[sym]) {
        analyzed[sym] = { ...analyzed[sym], c: d.c, score: d.score, pull: d.pull, close: d.close, live: true };
      } else {
        analyzed[sym] = { t: sym, sector: "기타", color: "#8B97A8", c: d.c, score: d.score, pull: d.pull, close: d.close, note: "실시간 데이터 기반 계산.", analyzed: true, live: true };
      }
    });
    // NDX100 전체를 기준으로 병합 (분석값 있으면 사용, 없으면 미분석)
    const merged = NDX100.map((m) => {
      if (analyzed[m.t]) return { ...analyzed[m.t], name: m.n, px: m.px };
      return {
        t: m.t, name: m.n, sector: m.sec, color: SECTOR_COLOR[m.sec] || "#8B97A8",
        pull: null, c: null, score: null, note: "미분석 종목 — 베이스 스캔(C1~C5) 데이터가 아직 없습니다. 백테스트는 가능합니다.",
        analyzed: false, px: m.px,
      };
    });
    // NDX100에 없지만 분석된 종목(HD, XOM 등 SPX 종목)도 추가
    Object.values(analyzed).forEach((a) => {
      if (!NDX_TICKERS.has(a.t)) merged.push(a);
    });
    return merged;
  }, [live]);
  const ranked = useMemo(() => [...allStocks].filter((s) => s.analyzed).sort((a, b) => b.score - a.score), [allStocks]);
  const ovFound = ovQuery.trim()
    ? allStocks.filter((s) => s.t.toLowerCase().includes(ovQuery.trim().toLowerCase()))
    : [];
  const ovSelectedStock = ovSelected ? allStocks.find((s) => s.t === ovSelected) : null;

  const TABS = [
    { id: "overview", label: "종합", icon: Gauge },
    { id: "confirm", label: "확인지표", icon: ShieldCheck },
    { id: "sectors", label: "섹터", icon: Layers },
    { id: "scan", label: "베이스 스캔", icon: TrendingUp },
    { id: "calendar", label: "이벤트", icon: Calendar },
    { id: "lookup", label: "백테스트", icon: FlaskConical },
  ];

  // 백테스트 실행 핸들러 — 실제 API 시계열 우선, 실패 시 모의 데이터 폴백
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
      if (json.ok && json.values && json.values.length >= 2) {
        series = json.values;       // [{date, close}]
        source = "실제 API";
      }
    } catch (e) { /* 폴백으로 진행 */ }

    // API 실패 시 기존 모의/앵커 시계열로 폴백
    if (!series) {
      series = fetchPriceSeries(tk, btStart, btEnd, meta);
      source = REAL_ANCHORS[tk] ? "실제 앵커(보간)" : "모의";
    }
    setBtError("");
    if (!series || series.length < 2) { setBtError("해당 기간에 거래일이 부족합니다."); setBtResult(null); return; }

    const hold = runBacktest(series, amt, meta, false);
    const strat = runBacktest(series, amt, meta, true);
    const chart = series.map((p, i) => ({
      date: p.date, "매수후보유": hold.equity[i].value, "전략": strat.equity[i].value,
    }));
    setBtResult({ tk, meta, amt, series, hold, strat, chart, isReal: source === "실제 API", source });
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
            onClick={() => {
              // 분석 대상 종목 중 점수 상위 24개를 갱신 (8개씩 3배치, 무료 한도 내)
              const targets = ranked.slice(0, 24).map((s) => s.t);
              refreshLive(targets.length ? targets : ["NVDA", "AAPL", "MSFT", "GOOGL", "AMZN", "META", "AVGO", "COST"]);
            }}
            disabled={loading}
            title="실제 API로 최신 데이터 갱신"
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "9px 13px", borderRadius: 10, cursor: loading ? "wait" : "pointer",
              background: loading ? C.line : C.brass, color: loading ? C.sub : C.bg, border: "none", fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap",
            }}
          >
            <RefreshCw size={14} style={loading ? { animation: "spin 1s linear infinite" } : undefined} /> {loading ? "갱신 중…" : "실데이터 갱신"}
          </button>
        </div>
        <div style={{ fontSize: 12, color: C.dim, marginBottom: 6 }}>기준일 2026-06-15 종가 · 실제 시세 검증 반영 · 매크로 신호 + 베이스 스캔</div>
        <div style={{ fontSize: 10.5, color: liveMsg.includes("실패") ? C.down : C.dim, marginBottom: 18, lineHeight: 1.5, padding: "8px 11px", background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8 }}>
          {liveMsg
            ? <>↻ {liveMsg}</>
            : <>↻ <b style={{ color: C.sub }}>실데이터 갱신</b> 버튼을 누르면 Twelve Data API에서 지수(NDX·SPX), 확인지표(VIX·HYG), 상위 24개 종목의 실제 시세를 가져와 점수를 다시 계산합니다. (무료 한도 보호를 위해 8개씩 순차 처리)</>}
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
            <SectionTitle icon={Gauge} sub="gap·slope·vol 점수 → 상태 → 액션">지수 신호 변화</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 12 }}>
              <IndexCard k="NDX" d={idxData.NDX} /><IndexCard k="SPX" d={idxData.SPX} />
            </div>

            {/* 지수 전체 전략 행동 — 지수 카드 바로 아래 */}
            <Card style={{ marginTop: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <Minus size={15} color={C.blue} /><b style={{ fontSize: 14 }}>지수 전략 행동: 포지션 변경 불필요</b>
              </div>
              <div style={{ fontSize: 12.5, color: C.sub, lineHeight: 1.8 }}>
                NDX는 vol20 {idxData.NDX.vol20}%로 디리스크 임계(25%)를 초과해 BASE 유지(HOLD-{ndx.streak}). SPX는 LEVERAGE 3단계 고착(HOLD-{spx.streak}).
                두 지수 모두 추세는 강하나 변동성·매크로 이벤트(FOMC)를 앞두고 신규 레버리지 확대보다 <b style={{ color: C.text }}>기존 포지션 유지</b>가 합리적입니다.
              </div>
            </Card>
            <Card style={{ marginTop: 12, borderColor: conf.allPass ? `${C.up}55` : `${C.down}55` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <ShieldCheck size={16} color={conf.allPass ? C.up : C.down} />
                <b style={{ fontSize: 14, color: conf.allPass ? C.up : C.down }}>
                  {conf.allPass ? "전지표 통과 — 거시 환경 강세 신호 유효" : "확인지표 일부 미달 — 주의"}
                </b>
              </div>
              <div style={{ fontSize: 12, color: C.sub, marginTop: 6 }}>VIX {CONFIRM.vix} (리스크온 구간), HYG +{CONFIRM.hyg20}% (신용 양호). 상세는 확인지표 탭 참고.</div>
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
                티커를 입력하면 일치하는 종목 목록이 나오고, 그중 하나를 선택하면 해당 종목의 신호와 지수 환경별 전략 행동이 표시됩니다.
              </div>
            )}
            {ovQuery.trim() !== "" && ovFound.length === 0 && (
              <Card style={{ textAlign: "center", color: C.dim, fontSize: 13 }}>
                "{ovQuery.toUpperCase()}" 종목을 찾을 수 없습니다. 수록 종목 중에서 검색해 주세요.
              </Card>
            )}

            {/* 후보 목록 (미선택 상태에서만 노출) */}
            {ovQuery.trim() !== "" && ovFound.length > 0 && !ovSelected && (
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {ovFound.map((st) => {
                  const g = grade(st.score);
                  return (
                    <button key={st.t} onClick={() => setOvSelected(st.t)} style={{
                      display: "flex", alignItems: "center", gap: 11, padding: "11px 14px", borderRadius: 10, cursor: "pointer", textAlign: "left",
                      background: C.panel, border: `1px solid ${C.line}`,
                    }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: st.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 14, fontWeight: 700, color: C.text, minWidth: 52 }}>{st.t}</span>
                      <span style={{ fontSize: 11, color: C.sub, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{st.name || st.sector}</span>
                      {st.analyzed
                        ? <span style={{ fontSize: 14, fontWeight: 800, color: g.color }}>{st.score}<span style={{ fontSize: 10, color: C.dim }}>/5</span></span>
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
                <button onClick={() => setOvSelected(null)} style={{
                  display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 10, padding: "6px 12px", borderRadius: 8, cursor: "pointer",
                  background: "transparent", border: `1px solid ${C.line}`, color: C.sub, fontSize: 12,
                }}>← 목록으로</button>
                <StockSignalCard st={ovSelectedStock} idxStates={{ NDX: ndx, SPX: spx }} conf={conf} />
              </>
            )}
          </>
        )}

        {/* ── 확인지표 ── */}
        {tab === "confirm" && (
          <>
            <SectionTitle icon={ShieldCheck} sub="C1 추세 · C2 변동성 · C3 신용">확인 지표 (Confirmation)</SectionTitle>
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
                VIX {CONFIRM.vix}는 전주 {CONFIRM.vixPrev}에서 급락 — 불안심리 해소, 20 이하 리스크온 구간. HYG +{CONFIRM.hyg20}%는 신용 스프레드 축소로 기업 신뢰 양호. 12M ROC 양수로 장기 추세 상방.
              </div>
            </Card>
          </>
        )}

        {/* ── 섹터 ── */}
        {tab === "sectors" && (
          <>
            <SectionTitle icon={Layers} sub="섹터별 베이스 스캔 점수 (C1~C5, 5점 만점)">섹터 리포트</SectionTitle>
            {SECTORS.map((s) => {
              const avg = (s.stocks.reduce((a, b) => a + stockScore(b.c), 0) / s.stocks.length).toFixed(1);
              const top = [...s.stocks].sort((a, b) => stockScore(b.c) - stockScore(a.c))[0];
              return (
                <Card key={s.sector} style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 3, background: s.color }} />
                      <b style={{ fontSize: 15 }}>{s.sector}</b>
                    </div>
                    <div style={{ fontSize: 12, color: C.sub }}>평균 <b style={{ color: s.color }}>{avg}</b>/5 · 최강 {top.t}</div>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                    {s.stocks.map((st) => {
                      const sc = stockScore(st.c), g = grade(sc);
                      return (
                        <span key={st.t} title={st.note} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 8, background: C.panel2, border: `1px solid ${g.color}33`, fontSize: 12, fontWeight: 600 }}>
                          {st.t} <span style={{ color: g.color }}>{sc}</span>
                        </span>
                      );
                    })}
                  </div>
                </Card>
              );
            })}
          </>
        )}

        {/* ── 베이스 스캔 (랭킹) ── */}
        {tab === "scan" && (
          <>
            <SectionTitle icon={TrendingUp} sub="C1 추세+C2 풀백+C3 베이스+C4 MA20+C5 돌파">베이스 스캔 하이라이트</SectionTitle>
            <div style={{ fontSize: 11.5, color: C.dim, margin: "0 2px 12px", fontStyle: "italic" }}>전략 기준 — C1: 추세 · C2: 풀백(-5%~-18%) · C3: 베이스 횡보 · C4: MA20 수렴 · C5: 돌파</div>
            {ranked.map((st, i) => {
              const g = grade(st.score);
              return (
                <Card key={st.t} style={{ marginBottom: 8, padding: "13px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ fontSize: 11, color: C.dim, width: 22, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{i + 1}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <b style={{ fontSize: 14.5 }}>{st.t}</b>
                        <span style={{ fontSize: 10.5, color: st.color }}>{st.sector}</span>
                        <span style={{ fontSize: 11, color: st.pull <= 0 ? C.down : C.up, fontVariantNumeric: "tabular-nums" }}>풀백 {st.pull > 0 ? "+" : ""}{st.pull}%</span>
                      </div>
                      <div style={{ fontSize: 11.5, color: C.sub, marginTop: 3, lineHeight: 1.5 }}>{st.note}</div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: g.color, fontVariantNumeric: "tabular-nums" }}>{st.score}</div>
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
            <SectionTitle icon={Calendar} sub="다음 주 핵심 이벤트 · 시장 영향 방향">매크로 캘린더 & 리스크</SectionTitle>
            {EVENTS.map((e, i) => {
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
                <AlertTriangle size={15} color={C.down} /><b style={{ fontSize: 13, color: C.down }}>핵심 리스크</b>
              </div>
              <div style={{ fontSize: 12.5, color: C.sub, marginTop: 6, lineHeight: 1.8 }}>
                6/17 FOMC는 동결이 거의 확실하나, 신임 Warsh 의장의 첫 회의로 <b style={{ color: C.text }}>점도표(dot plot)와 기자회견 톤</b>이 방향키입니다. 매파적이면 성장주 단기 조정 가능 — 신규 레버리지보다 현 포지션 유지 권고.
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
                <input value={btTicker} onChange={(e) => setBtTicker(e.target.value)} placeholder="예: NVDA"
                  style={{ width: "100%", boxSizing: "border-box", padding: "12px 14px", fontSize: 15, borderRadius: 10, border: `1px solid ${C.line}`, background: C.panel2, color: C.text, outline: "none", textTransform: "uppercase" }} />
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
                ※ NVDA는 웹에서 수집한 실제 주가 앵커(2025-06~2026-06)를 주별 보간한 데이터입니다. 그 외 종목은 모의 시계열이며, 실 시세 API 연동 시 fetchPriceSeries()만 교체하면 됩니다.
              </div>
            </Card>

            {btResult && (
              <>
                {/* 요약 카드 2개 */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                  {[
                    { key: "hold", title: "매수 후 보유", icon: Wallet, sub: "시작일 전액 매수 → 보유", r: btResult.hold, accent: C.blue },
                    { key: "strat", title: "전략 매매", icon: Target, sub: "20일선·점수 기반 매수/보유/매도", r: btResult.strat, accent: C.brass },
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
                          최대낙폭 {b.r.maxDD.toFixed(1)}%{b.key === "strat" ? ` · 매매 ${b.r.trades}회` : ""}
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
                        <Line type="monotone" dataKey="전략" stroke={C.brass} dot={false} strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                {/* 종목 전략 신호 (현재 시점) */}
                <div style={{ fontSize: 11, color: C.dim, margin: "4px 2px 8px" }}>참고: {btResult.tk}의 현재(6/15 기준) 베이스 스캔 신호와 전략 행동</div>
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
          ⚠️ 본 대시보드는 첨부 리포트의 방법론을 구현한 분석 도구이며 투자 자문이 아닙니다. 모든 수치는 2026-06-15 기준이며 실제 매매 전 최신 데이터로 검증하세요. 데이터를 갱신하려면 코드 상단의 IDX·CONFIRM·SECTORS·EVENTS 값을 수정하면 전 화면이 자동 재계산됩니다.
        </div>
      </div>
    </div>
  );
}
