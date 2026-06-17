# 시장 추세 분석 대시보드 (웹 배포판)

이 폴더는 Claude로 만든 대시보드를 **실제 주가 API와 연결된 웹사이트**로 배포하기 위한 프로젝트입니다.
코딩을 몰라도 됩니다. 아래 순서대로 "복사 → 붙여넣기 → 클릭"만 따라 하세요.

---

## 준비물 (모두 무료)
1. Twelve Data API 키 — 이미 발급받으셨습니다.
2. GitHub 계정 — 코드를 저장하는 곳.
3. Vercel 계정 — 웹사이트로 만들어 주는 곳.

---

## 1단계. GitHub에 코드 올리기

1. https://github.com 에 가입/로그인합니다.
2. 오른쪽 위 **+ → New repository** 클릭.
3. Repository name에 `market-dashboard` 입력 → **Create repository** 클릭.
4. 다음 화면에서 **"uploading an existing file"** 링크 클릭.
5. 이 폴더(`market-dashboard-web`) 안의 **모든 파일과 폴더를 드래그해서 업로드**합니다.
   - `pages` 폴더, `styles` 폴더, `package.json`, `next.config.js` 등 전부.
   - ⚠️ `node_modules` 폴더는 올리지 마세요 (없을 겁니다).
6. 아래 **Commit changes** 버튼 클릭.

---

## 2단계. Vercel로 배포하기

1. https://vercel.com 에서 **"Continue with GitHub"** 로 가입/로그인.
2. **Add New… → Project** 클릭.
3. 방금 만든 `market-dashboard` 저장소 옆 **Import** 클릭.
4. 화면에 **Environment Variables**(환경 변수) 항목이 있습니다. 여기에 API 키를 숨겨서 넣습니다:
   - Name(이름): `TWELVE_DATA_API_KEY`
   - Value(값): 발급받은 본인 API 키 붙여넣기
   - **Add** 클릭.
5. **Deploy** 버튼 클릭.
6. 1~2분 기다리면 "Congratulations!" 화면과 함께 **웹사이트 주소(URL)** 가 나옵니다.

---

## 3단계. 완성 & 사용

- 그 URL이 회원님만의 대시보드 주소입니다. 즐겨찾기에 추가하거나 휴대폰 홈 화면에 추가하세요.
- 대시보드 우측 상단 **"실데이터 갱신"** 버튼을 누르면 실제 주가를 불러와 점수를 다시 계산합니다.

---

## 자주 묻는 질문

**Q. 갱신 버튼을 눌렀는데 "갱신 실패"가 떠요.**
- Vercel 환경 변수 `TWELVE_DATA_API_KEY`가 정확히 입력됐는지 확인하세요.
- Twelve Data 무료 플랜은 분당/일일 호출 제한이 있습니다. 잠시 후 다시 시도하세요.

**Q. 무료 한도가 얼마인가요?**
- Twelve Data 무료: 하루 800회. 이 앱은 갱신 1회당 종목 8개 × 1회 = 8회 정도 사용합니다.

**Q. 코드를 고치고 싶어요.**
- GitHub에서 파일을 수정하면 Vercel이 자동으로 다시 배포합니다.

---

## 기술 메모 (몰라도 됩니다)
- Next.js(React) + Vercel 서버리스 함수 구조.
- API 키는 `pages/api/quote.js` 서버 라우트에서만 사용되어 브라우저에 노출되지 않습니다.
- 베이스 스캔 C1~C5는 실제 종가/MA200/MA20/52주 고점으로 서버에서 계산됩니다.
