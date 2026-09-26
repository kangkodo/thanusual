판정: FAILED

복귀 단계: 개발(Q-1), 기획(Q-2: 안내 문구 영향 범위 누락)

## 검증 버전·환경

- 실행일: 2026-09-27 KST, 독립 QA 1회차.
- 변경 전: `a3ca3c43e084e36c618f97b8b488d273bc823b5f` (main, 점 표시).
- 개발 커밋: `7842888bcd0be4d8c230c2683ac72e54be6fbfeb`.
- 실제 검증 HEAD: `9ed58ab65a5762869d1e26649c5a208e566d1833` (`pipe/grid-squares`). 개발 커밋 이후 차이는 `ai-log/`의 QA 지시·판정 기록 3개뿐이다. 앱 코드는 동일하다.
- baseline의 화면 실행 관련 11개 파일을 기준 SHA와 바이트 비교해 일치를 확인했다. [버전 증거](captures/QA-version.json)
- macOS 26.5.2 / Darwin 25.5.0 / arm64 / Apple M5, Playwright Chromium **151.0.7922.34**, headless, 1280×800, deviceScaleFactor 1. 성능은 라이트 모드.
- 변경 전 `127.0.0.1:8766`, 변경 후 `127.0.0.1:8765`, 각각 `python3 -m http.server` 사용. 새 패키지 설치 없음.
- 고정 데이터: [grid-fixture.json](captures/grid-fixture.json), Master 제공 수신 시각 2026-09-27 00:04, 데이터 날짜 `20260922`. 전후 동일 바이트로 응답.
- fixture SHA-256: `ee96ee9f1b45519517525160c05e4aee4212048e6f57bb2fa0155e5f4bd45c5c`.
- 외부 요청은 차단했다. `grid.json` 요청은 네트워크 전송 없이 fixture로 응답하고, current.json은 각 서버의 `./data/current.json`으로 fallback했다. 배경 타일은 Python 서버에서 404이므로 캡처에 지도 실패 안내가 있다. 지정 환경의 예상 제한이며 제품 결함으로 세지 않았다. 실제 지도 타일과의 합성은 이번 검증 대상이 아니다.
- 소스·수용 테스트·TODO 수정 없음. 보고서와 git 제외 경로 `captures/`에만 산출물을 작성했다. 판정 레코드 기록·커밋·배포 없음.

## 루브릭

| 항목 | 판정 | 근거 |
|---|---|---|
| 수용 테스트 통과 | O | 11/11 통과, 실패·skip 0. 이번 격자 AC-1~4 포함 |
| 시나리오 수행(정상·실패 흐름) | X | QA-1~6 모두 수행했으나 QA-1 화면 기준 불충족(Q-1). 추가 안내 모순 Q-2 |
| 증거 존재(캡처·로그) | O | 시나리오별 PNG, 원시 측정 JSON, 실행 스크립트·로그 존재 |

미수행 시나리오 없음. 기하 수용 테스트 통과만으로 화면의 선 없는 렌더링을 보장하지는 않는다.

## 결함

### Q-1 — 같은 농도의 이웃 칸 사이에도 가는 선이 남음

- 위치: `map.js:236`~`241`, `01-planning/todo.md` QA-1 / DEV-002.
- 재현: 위 로컬 서버와 fixture를 사용 → 250m 상세 분포 → `12`시 → 중심 `(37.55, 126.98)` → 줌 13 또는 15 → 라이트·다크 각각 관찰.
- 실제: 같은 농도의 인접 칸 사이에 밝거나 어두운 가는 선이 보인다. 줌 15 라이트의 상세 캡처에서는 동일 회색 영역을 가르는 세로선·가로선이 명확하다. 줌 13·15 양 테마에서 관찰했다. 지정 중심의 줌 18에서는 같은 현상이 뚜렷하지 않았다.
- 기대: QA-1에 명시된 대로 칸이 맞물리고, 칸 사이에 가는 선이나 틈이 보이지 않아야 한다. 값 차이에 의한 면 색상 경계와 별개로 같은 농도 사이에 선이 생기면 안 된다.
- 원인 추정: **개발 결함**. 공유 좌표 자체는 AC-2를 통과한다. 각 폴리곤의 독립적인 반투명 채움·`weight: 0.5`, `opacity: opacity / 4` 선을 Canvas에 합성하는 과정의 안티앨리어싱/중첩이 남는 것으로 추정한다. 렌더링 옵션을 수정해 원인을 확정하는 실험은 하지 않았다.
- 증거: [라이트 z15 원본](captures/QA-1-light-z15.png), [상세](captures/QA-1-light-z15-detail.png), [상세 4배 확대](captures/Q-1-light-z15-enlarged.png), [다크 z15](captures/QA-1-dark-z15.png), [다크 z13 상세](captures/QA-1-dark-z13-detail.png). 4배 이미지는 원본 상세 캡처를 픽셀 보간 없이 확대한 관찰용 증거다.

### Q-2 — 하단 설명이 새 사각형 표시와 모순됨

- 위치: `index.html:52`; `01-planning/todo.md` DEV-003·DEV-005 / 영향 문서 절의 변경 대상 누락.
- 재현: 250m 상세 분포로 진입 → 왼쪽 하단 **데이터 출처와 한계** 펼치기.
- 실제: `250m 점은 격자 중심이며 경계가 아닙니다.`가 그대로 표시된다. 현재 화면은 격자 경계를 계산한 사각형이며, 툴팁과 상단 안내는 이미 새 표시를 설명한다.
- 기대: 사용자가 펼쳐 읽는 데이터 한계 설명도 현재 사각형 표시와 일치해야 한다. 원본 GeoJSON이 중심점 데이터라는 사실을 설명하려면 화면의 사각형 경계와 구별해야 한다.
- 원인 추정: **요구 오류(기획 누락)**. 승인된 TODO는 툴팁과 `app.js` 안내를 지정했지만 `index.html`의 같은 의미 문구를 포함하지 않았다. 기존에는 맞았던 설명이 이번 동작 변경으로 틀린 설명이 됐다.
- 증거: [하단 설명을 펼친 실제 화면](captures/QA-copy-footer.png), [추출 문구](captures/QA-followup.json)의 `footer`.
- 처리: Master가 기획에 문구 영향 범위를 보완한 뒤 개발로 전달한다. QA에서 소스를 고치지 않았다.

## 시나리오별 결과

| ID | 결과 | 수행·관찰 | 증거 |
|---|---|---|---|
| AC-1~4 | O | 전체 10,125칸 중심 오차, 인접 모서리 일치, 변 길이 허용치, 잘못된 ID 검사 통과 | [AC-acceptance.log](captures/AC-acceptance.log) |
| QA-1 | X | z13·15·18 × 라이트·다크 6조건 캡처. 사각형으로 맞물리지만 z13·15에 선이 남음(Q-1) | 아래 6조건 캡처 표 |
| QA-2 | O | 공통 2,603칸의 색·fillOpacity 전후 비교 불일치 0. 값 있음 0.20/0.36/0.52/0.68/0.84, 비식별·누락은 중립색 0.12. 비식별 칸 툴팁에 0명으로 표시하지 않음 | [색 화면](captures/QA-2-colors.png), [QA-followup.json](captures/QA-followup.json) `bandComparison`, [비식별 툴팁](captures/QA-4-centered-missing.png) |
| QA-3 | O | 초기 화면과 동쪽 이동 3지점에서 이동 정착 후 화면과 교차하는 격자 누락 0. 도형 수 2,816/2,803/2,511/2,199 | [QA-followup.json](captures/QA-followup.json) `edgeSettled`, `captures/QA-3-settled-{0,1,2,3}.png` |
| QA-4 | O | 실제 마우스 가리키기·클릭. `다사54005000`: 2026-09-22 12:00 KST, 3,245.69명. `다사54505025`: 비식별/자료 없음. fixture 값과 일치. 끝 문구 `250m 격자`, 안내 `칸을 누르면` 확인. 하단 설명 모순은 별도 Q-2 | [값 툴팁](captures/QA-4-centered-value.png), [비식별 툴팁](captures/QA-4-centered-missing.png), [QA-followup.json](captures/QA-followup.json) `tooltips` |
| QA-5 | O | 변경 전 먼저 측정. 아래 성능 세 기준 모두 통과. 300px 끌기 3회·z13→15→13의 longtask 목록 전후 모두 빈 배열 | [QA-results.json](captures/QA-results.json), [변경 전](captures/QA-5-before.png), [변경 후](captures/QA-5-after.png) |
| QA-6 | O | z12 격자 0개. 12→00시 변경 시 관찰한 180칸 중 81칸 농도 변경. now/history/forecast/usual의 목록·안내·도형 비교 전후 일치. 보조 레이어 정상·실패 전후 일치. grid 응답 실패·geometry 응답 실패·선택 slice 없음에서 격자 0개 | 아래 실패·회귀 증거 |

QA-3의 최초 빠른 계측에서는 지도 maxBounds 보정이 진행 중인 시점에 61칸 누락처럼 관찰됐다(`QA-results.json`의 마지막 edges 항목). 이동이 정착한 뒤 별도 재현한 4지점은 모두 누락 0이어서 지속되는 누락 결함으로 판정하지 않았다. 원시 로그는 그대로 보존했다.

### QA-1 캡처

| 테마 | 줌 | 전체 화면 | 상세 |
|---|---:|---|---|
| 라이트 | 13 | [화면](captures/QA-1-light-z13.png) | [상세](captures/QA-1-light-z13-detail.png) |
| 라이트 | 15 | [화면](captures/QA-1-light-z15.png) | [상세](captures/QA-1-light-z15-detail.png) |
| 라이트 | 18 | [화면](captures/QA-1-light-z18.png) | [상세](captures/QA-1-light-z18-detail.png) |
| 다크 | 13 | [화면](captures/QA-1-dark-z13.png) | [상세](captures/QA-1-dark-z13-detail.png) |
| 다크 | 15 | [화면](captures/QA-1-dark-z15.png) | [상세](captures/QA-1-dark-z15-detail.png) |
| 다크 | 18 | [화면](captures/QA-1-dark-z18.png) | [상세](captures/QA-1-dark-z18-detail.png) |

### QA-5 성능

지도 설정값 `(37.55,126.98)`, 줌 13, 최초 시각 `12`. Leaflet 픽셀 반올림 후 실제 중심은 전후 동일한 `(37.55002139332707,126.97998046875001)`이었다. 변경 전 5회 완료 후 변경 후 5회를 실행했다. 매 최초 진입은 새 브라우저 context/page를 열어 모듈·칸 캐시를 비웠다.

최초 진입은 실제 select `change` 직전부터 데이터 로드·첫 도형 생성 후 rAF 두 번까지 측정했다. 앱 기본 선택이 마지막 조각 `21`이므로, 시험 중 `state.timeAt` 접근자로 최초 선택값만 `12`로 고정하고 첫 그리기 후 해제했다. 첫 생성 도형의 slice가 매번 `12`임을 기록했다. 기하·렌더 함수는 변경하지 않았다. Leaflet map 참조를 얻는 init hook과 첫 도형 생성 시점을 읽는 wrapper만 브라우저 메모리에 계측했다.

이후 측정은 5번째 새 페이지에서 `12↔15`를 20회 오가며 slider `input` dispatch 직전부터 연속 rAF 두 번까지 측정했다. `clearLayers`·새 도형·Canvas redraw를 포함한다. 중앙값은 가운데 두 값 평균, p90은 정렬한 20개 중 18번째 값이다.

| 지표 | 변경 전 | 변경 후 |
|---|---:|---:|
| 도형 수 | 2,603 | 2,816 |
| 최초 진입 5회 (ms) | 99.1, 110.7, 99.5, 99.4, 99.1 | 113.7, 112.8, 107.4, 106.6, 106.8 |
| 최초 진입 중앙값 (ms) | 99.40 | 107.40 |
| 이후 20회 중앙값 (ms) | 28.45 | 32.30 |
| 이후 20회 p90 (ms) | 30.30 | 34.00 |
| 끌기·줌 longtask 전체 목록 | `[]` | `[]` |
| 200ms 초과 longtask | 0 | 0 |

| 판정 항목 | 계산 | 결과 |
|---|---|---|
| 이후 중앙값 | 32.30 ≤ max(28.45×1.5, 28.45+50) = **78.45ms** | O |
| 이후 p90 | 34.00 ≤ **300ms** | O |
| 최초 진입 중앙값 | 107.40 ≤ **600ms** | O |

도형 수 증가 213개를 포함한 측정이다. longtask 관찰은 300px 마우스 끌기 3회와 줌 13→15→13 구간 전체에서 수행했다. 원시 20회 수치·동작 시작 시각·긴 작업 목록은 [QA-results.json](captures/QA-results.json) `runs.before/after`에 있다.

### QA-6 실패·회귀 증거

- 줌 제한·슬라이더: [z12](captures/QA-6-z12.png), [시간 변경](captures/QA-6-slider.png).
- grid 요청 503: [화면](captures/QA-6-failure-grid.png). geometry 요청 503: [화면](captures/QA-6-failure-geo.png). 모두 자료를 불러오지 못했다는 안내와 격자 0개 확인.
- 존재하지 않는 선택 slice를 브라우저 상태에 주입하고 실제 `syncMap` 실행: [화면](captures/QA-6-missing-slice.png), 격자 0개.
- 다른 시간 모드: `captures/QA-6-mode-{now,history,forecast,usual}.png`. 전후 일치 결과는 [QA-followup.json](captures/QA-followup.json) `modeComparison`. history는 로컬 timeline 자료가 없어 빈 자료 흐름을 비교했다. forecast는 로컬 current의 실제 예측값 흐름을 실행했다.
- 보조 레이어 실패: 동네·지하철·거리·오늘을 실제 체크했으나 로컬 데이터 없음 → 체크 해제·안내·도형 0개가 전후 동일. `captures/QA-6-{before,after}-layer-{dong,metro,street,today}.png`.
- 보조 레이어 정상: 운영 데이터가 없는 보조 레이어에는 [명시적인 최소 시험 fixture](captures/QA-6-controlled-fixtures.json)를 전후 동일 응답으로 주입하고 실제 체크박스로 켰다. 동네 427개 / 지하철 1개 / 거리 2개 / 오늘 1개 도형, 좌표·색·투명도·툴팁·안내 모두 전후 일치. 이는 렌더링 회귀 검증이며 운영 피드 검증은 아니다. [비교 로그](captures/QA-6-layer-normal.json), `captures/QA-6-{before,after}-normal-{dong,metro,street,today}.png`.
- 브라우저 `pageerror` 0. 차단한 외부 요청, 타일·없는 로컬 자료 404, 의도한 503 관련 console 오류는 로그에 남겼다.

## 실행 증거

- 수용 명령: `node --test tests/acceptance/*.test.js` → exit 0, 11 pass. [로그](captures/AC-acceptance.log)
- 주 실행: [QA-run.mjs](captures/QA-run.mjs), [로그](captures/QA-run.log), [결과](captures/QA-results.json).
- 정착 후 재관찰·회귀: [QA-followup.mjs](captures/QA-followup.mjs), [로그](captures/QA-followup.log), [결과](captures/QA-followup.json).
- 보조 레이어 정상·확대 증거: [QA-layers.mjs](captures/QA-layers.mjs), [로그](captures/QA-layers.log).
- 로컬 서버: [변경 전 로그](captures/QA-server-before.log), [변경 후 로그](captures/QA-server-after.log).

확인한 항목: AC-1~4와 기존 고정 장소 AC 7개, 6가지 줌·테마, 5단계 농도·비식별 표시, 이동 정착 후 가장자리, 값/비식별 툴팁, 세 성능 기준과 끌기·줌 긴 작업, 줌 제한·시간 변경·다른 모드/레이어·자료 실패 흐름.
