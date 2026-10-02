## 읽을 것
- `ai-log/20261003/001_004527_posthog-tracking/01-planning/todo.md` ("배경 사실", "상태 계약", "수용 기준"의 AC-1~AC-11, QA-1~QA-8)
- `ai-log/20261003/001_004527_posthog-tracking/00-request/request.md` (확정 요구 R-1~R-15)
- `tests/acceptance/analytics.test.js`
- `analytics.js`, `lib/track.js`, `app.js`(`select`, `readHash`, `bindBoard`, `renderDetail`, `setMapPickHandler` 콜백), `map.js`(`pick`), `index.html`, `404.html`, `styles.css`(폰 미디어 블록)
- 이전 QA 실행 스크립트 예시: `ai-log/20260926/002_233253_grid-squares/03-qa/captures/QA-run.mjs` (Playwright 불러오는 경로)

## 독립 QA 지시 (1회차)

이번 변경: PostHog 기록 추가. 새 파일 `analytics.js`(조건부 공식 로더, 초기화 설정, 주소 자르기), `lib/track.js`(`trackPlaceOpen`), `app.js`·`map.js`(장소 선택 시 기록, 지도 선택이 이름을 콜백으로 넘김), `index.html`(쿠키 고지, 접힌 안내 제목), `404.html`(스크립트 태그), `styles.css`(폰에서 시트를 펼치면 footer 표시). 기준은 `todo.md`의 AC-1~AC-11과 QA-1~QA-8이다. S-1~S-5(실제 SDK)는 Master가 따로 한다. 하지 않는다.

### 준비물 (Master가 미리 둠, git 제외 경로)
- 변경 전 코드: `ai-log/20261003/001_004527_posthog-tracking/03-qa/captures/baseline/` (`main`, 64c0a467)
- 변경 후 코드: 저장소 루트 (브랜치 `pipe/posthog-tracking`)

### 실행
- 수용 테스트: `node --test tests/acceptance/*.test.js`, 그리고 `npm test`
- 화면: 변경 후는 저장소 루트에서, 변경 전은 `baseline/`에서 각각 `python3 -m http.server <포트> --bind 127.0.0.1`.
- 로컬 주소는 `http://127.0.0.1:<포트>/`, 로컬이 아닌 호스트는 `http://thanusual.localhost:<포트>/`로 연다(Chromium은 `*.localhost`를 내 컴퓨터로 푼다. `analytics.js`의 로컬 목록에는 없으므로 PostHog 로더가 실행된다).
- 네트워크가 없다. 외부 요청(서울 데이터 호스트, 타일, PostHog)은 모두 브라우저에서 막거나 실패하게 둔다. 앱은 `./data/current.json` 대체 경로로 읽힌다(오래된 자료다. UI 검증용). **PostHog 호스트(`us.i.posthog.com`, `us-assets.i.posthog.com`)로는 어떤 요청도 실제로 나가면 안 된다.** 요청 시도는 기록만 한다.
- PostHog SDK(`array.js`)를 못 받으므로 `window.posthog`는 공식 로더의 대기열 배열로 남는다. 호출은 `Array.from(window.posthog)`에 `["capture","core_action",{"action":"place_open"}]` 꼴로 쌓이고, 초기화 인자는 `window.posthog._i[0]`에 있다. 단계마다 이 대기열을 JSON으로 떠서 건수를 센다.
- 쿠키 차단 브라우저는 `navigator.cookieEnabled`가 `false`가 되도록 초기 스크립트로 흉내 낸다(AC-8의 화면 확인용, QA-1에 덧붙인다).
- 로컬에 있는 Playwright Chromium을 쓴다. 새 패키지 설치가 필요하면 설치하지 말고 BLOCKED.
- 타일 404와 그 안내, 외부 요청 실패에 따른 브라우저의 네트워크 진단 줄은 예상된 것이다. 통과 기준은 `pageerror` 0건과 기능 장애 없음이다(R-10).

### 수행
- QA-1~QA-8을 순서대로. 정상 흐름과 실패 흐름(로더 실패, 쿠키 차단, 로컬 주소) 모두.
- QA-2·QA-3·QA-4는 단계별 대기열 덤프를 남긴다. 지도 선택은 실제 지도 위의 점·핀을 클릭한다(확대해서 핀이 보이는 줌에서, 또는 원을 좌표로 클릭).
- QA-5·QA-6·QA-7은 변경 전·후 캡처를 같은 크기로 남긴다. QA-6은 375×812와 320×568, 라이트·다크. 시트를 접은 상태, 펼친 상태, 안내를 펼친 상태를 각각 찍고, footer와 목록의 실제 높이(px), 가로 스크롤 여부(`scrollWidth > clientWidth`)를 기록한다.
- QA-8은 지도 선택 뒤 선택 표시, 행 스크롤·포커스, `#p=` 갱신, 지도가 다시 가운데로 옮겨지지 않는지를 변경 전과 비교한다. 시간 모드 다섯을 한 번씩 고른다(자료가 없는 모드는 안내 문구가 나오면 된다).

### 산출물
- 캡처·로그·스크립트: `ai-log/20261003/001_004527_posthog-tracking/03-qa/captures/` (파일명 앞에 시나리오 ID)
- 보고서: `ai-log/20261003/001_004527_posthog-tracking/03-qa/report.md` — 시나리오별 결과, 증거 경로, 루브릭(수용 테스트 통과 / 시나리오 수행 / 증거 존재)
- 소스·수용 테스트·`todo.md` 수정 금지. 판정 첫 줄: `판정: PASSED | FAILED | BLOCKED`
