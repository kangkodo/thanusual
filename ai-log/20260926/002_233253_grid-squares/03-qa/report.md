판정: PASSED

독립 QA 2회차 · 2026-09-27 KST. 차단 결함 0건, 미검증 0건. 판정 대상은 아래 커밋의 앱 코드와 지정된 로컬 시험 범위다.

## 이전 지적 해결 확인

| ID | 판정 | 확인 근거 |
|---|---|---|
| Q-1 | **해결** | 1회차와 동일한 z15 라이트 상세 영역에서 같은 농도 사이의 가는 선이 사라졌다. z13·15·18 양 테마 및 z18 추가 지점에서 선·틈·진한 중첩선이 관찰되지 않았다. 같은 농도 공유 변의 Canvas 알파값 검사도 불일치 0. [이전 상세](captures/QA-1-light-z15-detail.png), [현재 상세](captures/round-2/QA-1-light-z15-main-detail.png), [4배 확대](captures/round-2/Q-1-light-z15-enlarged.png) |
| Q-2 | **해결** | 하단 “데이터 출처와 한계”를 실제 펼쳐 `250m 칸은 서울시 격자 경계입니다.`를 확인했다. app.js·map.js·index.html에서 `250m 점`/`경계가 아`/`중심점` 옛 설명 검색 결과 0건. [펼친 화면](captures/round-2/QA-4-footer.png), [추출 문구](captures/round-2/QA-recovery.json) `footer` |

1회차 보고서는 내용 변경 없이 [report-1.md](report-1.md)로 보존했다. 신규 결함 없음.

## 버전·환경

- 변경 전 기준 SHA: `a3ca3c43e084e36c618f97b8b488d273bc823b5f` (main, 점 표시). Master 제공 `captures/baseline/` 사용. 앱·스타일·Leaflet·격자·현재 자료 등 명시한 10개 파일을 기준 SHA와 바이트 비교해 모두 일치했다.
- 복구 커밋: `73a0b142a40e025701bef9fb54bb382e0bec17d9`.
- 실제 검증 HEAD: `217da9d423e90e58f8aa3d15d20f14514e4ab295`, 브랜치 `pipe/grid-squares`. 복구 커밋 이후 차이는 `ai-log/`의 지시·판정 기록 3개뿐이며 앱 코드는 같다. 시작 시 작업 트리는 깨끗했다. [버전 증거](captures/round-2/QA-version.json)
- macOS **26.5.2**, Darwin **25.5.0**, arm64, **Apple M5**. 기존 설치 Playwright Chromium **151.0.7922.34**, headless, **1280×800 / deviceScaleFactor 1**. 성능 측정은 라이트. 새 패키지 설치 없음.
- 전: `python3 -m http.server 8766 --bind 127.0.0.1 --directory …/captures/baseline`. 후: 저장소 루트에서 `python3 -m http.server 8765 --bind 127.0.0.1`.
- 고정 자료: [grid-fixture.json](captures/grid-fixture.json), Master 제공 수신 시각 2026-09-27 00:04, 자료 날짜 `20260922`. 전후 동일 파일로 grid.json 요청을 응답했다. SHA-256: `ee96ee9f1b45519517525160c05e4aee4212048e6f57bb2fa0155e5f4bd45c5c`.
- grid.json은 요청 가로채기로 응답하고, 그 밖의 외부 요청은 모두 차단했다. current.json 등은 각 폴더의 로컬 data 경로로 fallback했다. Python 서버는 지도 타일을 제공하지 않아 타일 404 안내가 보인다. 이는 지정 시험 환경의 예상 제한이다. 운영 타일과의 합성이나 배포 상태를 판정한 결과가 아니다.
- 소스·수용 테스트·TODO 수정 없음. 보고서와 git 제외 `captures/round-2/`에만 새 산출물을 작성했다. 판정 레코드 기록·커밋·배포 없음.

## 루브릭

| 항목 | 판정 | 근거 |
|---|---|---|
| 수용 테스트 통과 | O | `node --test tests/acceptance/*.test.js`: 11/11 pass, fail 0, skip 0, exit 0 |
| 시나리오 수행(정상·실패 흐름) | O | QA-1~6 수행. 복구, 화면, 공유 변 툴팁, 성능 및 정상·실패 회귀 기준 충족 |
| 증거 존재(캡처·로그) | O | 시나리오 PNG, 원시 측정 JSON, 브라우저 사건 로그, 재실행 스크립트 및 서버 로그 저장 |

## 시나리오 결과

| ID | 판정 | 수행·관찰 | 증거 |
|---|---|---|---|
| AC-1~4 | O | 10,125칸 중심 오차, 공유 모서리 ===, 250m ±0.5m 변 길이, 잘못된 ID 계약 통과. 기존 고정 장소 수용 테스트 7개도 통과 | [수용 로그](captures/round-2/AC-acceptance.log) |
| QA-1 | O | z13·15·18 × 라이트·다크, 1회차 z15 상세, z18 기본·동·북·남과 공유 변 3지점. 같은 농도 선·틈 관찰 없음. 농도 차이의 면 경계는 정상 | 아래 캡처·픽셀 표 |
| QA-2 | O | 전후 공통 2,603칸의 실제 채움 색·투명도 불일치 0. 값은 0.20/0.36/0.52/0.68/0.84, 비식별·누락은 중립색 0.12. 후는 투명 히트 영역의 기본 스타일 대신 그 칸을 포함하는 실제 채움 링의 스타일을 읽었다 | [색 화면](captures/round-2/QA-2-colors.png), [비교 로그](captures/round-2/QA-followup.json) `bandComparison`, [원시 색](captures/round-2/QA-results.json) `colors` |
| QA-3 | O | 이동 정착 후 4지점, 도형 2,816/2,803/2,511/2,199개. 화면과 교차하는 격자의 누락 각각 0 | [원시 비교](captures/round-2/QA-followup.json) `edgeSettled`, `captures/round-2/QA-3-settled-{0,1,2,3}.png` |
| QA-4 | O | 값·비식별 칸 가리키기/누르기, 날짜·시각·ID·인원 및 `250m 격자` 확인. 안내 `칸을 누르면` 확인. 공유 변 30지점 검사에서 가리키기·누르기 모두 단일 툴팁이며 값은 fixture와 일치. Q-2도 해결 | 아래 공유 변 표, [값 툴팁](captures/round-2/QA-4-centered-value.png), [비식별 툴팁](captures/round-2/QA-4-centered-missing.png) |
| QA-5 | O | 변경 전 먼저 측정. 최초 5회, 이후 20회. 채움 경로와 히트 영역을 모두 포함해 세 성능 기준 충족. 300px 끌기 3회·z13→15→13에서 longtask 목록 전후 `[]` | 아래 성능 표, [원시 결과](captures/round-2/QA-results.json) |
| QA-6 | O | z12 격자 0, 12→00시에서 180칸 중 81칸 농도 변경. now/history/forecast/usual 전후 일치. 다른 레이어 정상·실패 전후 일치. grid/geometry 실패 및 선택 slice 없음에서 격자 0 | 아래 실패·회귀 증거 |

## QA-1 화면과 공유 변

기본 중심 `(37.55,126.98)`, 12시. 상세 캡처는 1회차와 동일한 화면 `(x=680,y=270,w=360,h=300)`다.

| 테마 | 줌 | 전체 | 상세 |
|---|---:|---|---|
| 라이트 | 13 | [화면](captures/round-2/QA-1-light-z13-main.png) | [상세](captures/round-2/QA-1-light-z13-main-detail.png) |
| 라이트 | 15 | [화면](captures/round-2/QA-1-light-z15-main.png) | [상세](captures/round-2/QA-1-light-z15-main-detail.png) |
| 라이트 | 18 | [화면](captures/round-2/QA-1-light-z18-main.png) | [상세](captures/round-2/QA-1-light-z18-main-detail.png) |
| 다크 | 13 | [화면](captures/round-2/QA-1-dark-z13-main.png) | [상세](captures/round-2/QA-1-dark-z13-main-detail.png) |
| 다크 | 15 | [화면](captures/round-2/QA-1-dark-z15-main.png) | [상세](captures/round-2/QA-1-dark-z15-main-detail.png) |
| 다크 | 18 | [화면](captures/round-2/QA-1-dark-z18-main.png) | [상세](captures/round-2/QA-1-dark-z18-main-detail.png) |

z18에서는 같은 농도의 공유 변이 실제 화면 안에 오도록 다음 세 지점을 추가로 중앙에 놓았다. 중앙 shared edge 외에 주변 같은 농도 공유 변도 함께 검사했다.

| 지점 | 공유하는 칸 ID | 중심 (위도, 경도) | 라이트 | 다크 |
|---|---|---|---|---|
| edge0 | 다사53504975 / 다사53754975 | (37.547050212, 126.976424398) | [화면](captures/round-2/QA-1-light-z18-edge0.png) | [화면](captures/round-2/QA-1-dark-z18-edge0.png) |
| edge1 | 다사56505225 / 다사56755225 | (37.569729032, 127.010237417) | [화면](captures/round-2/QA-1-light-z18-edge1.png) | [화면](captures/round-2/QA-1-dark-z18-edge1.png) |
| edge2 | 다사51254775 / 다사51504775 | (37.528908139, 126.951086357) | [화면](captures/round-2/QA-1-light-z18-edge2.png) | [화면](captures/round-2/QA-1-dark-z18-edge2.png) |

Canvas 픽셀 보조 검사: 같은 색·농도 인접 칸의 공유 변 25%·50%·75% 지점에서 변 수직 방향 -2…+2px의 알파값을 읽었다. 실제 화면 범위에 든 표본만 사용했다. 다섯 픽셀의 최대-최소 차 ≤1/255, 중앙 알파와 기대 `round(fillOpacity×255)` 차 ≤1/255를 확인했다. 원본 캡처 관찰과 함께 판정했다.

| 테마별 검사 | 라이트 표본 | 다크 표본 | 불일치 |
|---|---:|---:|---:|
| 기본 z13 | 3,323 | 3,323 | 0 |
| 기본 z15 | 200 | 200 | 0 |
| z18 남쪽 추가 지점 | 3 | 3 | 0 |
| z18 edge0 / edge1 / edge2 | 5 / 5 / 9 | 5 / 5 / 9 | 0 |

기본 z18과 동·북 지점에는 필터를 만족하는 같은 농도 공유 변 표본이 0개라 픽셀 통과 근거로 세지 않았다. 화면 관찰 및 위 edge0~2 검사를 추가했다. 로그: [QA-recovery.json](captures/round-2/QA-recovery.json), [QA-seams.json](captures/round-2/QA-seams.json). 전체 유효 표본 7,090개, 불일치 0.

## QA-4 공유 변과 칸별 값

지도 컨테이너의 화면 오프셋을 포함해 실제 마우스를 이동했다. z18, 세 공유 변 × 두 테마 × 수직 오프셋 `-3,-1,0,+1,+3px` = 30지점. 각 지점에서 hover와 click을 모두 실행했다. 오프셋 부호는 +가 서쪽 칸 내부다.

| 공유 변 | 동쪽 내부 -3/-1px | 정확한 변 0px | 서쪽 내부 +1/+3px |
|---|---|---|---|
| edge0 | 다사53754975 | 다사53504975 | 다사53504975 |
| edge1 | 다사56755225 | 다사56505225 | 다사56505225 |
| edge2 | 다사51504775 | 다사51254775 | 다사51254775 |

두 테마·hover·click 결과가 위 표와 동일하다. 정확한 변은 이 표본에서 서쪽 칸 하나를 선택했으며, 양쪽 1px 지점부터 각 칸으로 전환됐다. 선택한 ID·숫자를 fixture와 대조해 일치했다. 경계에서 어느 쪽을 우선해야 한다는 별도 요구는 없다.

- [경계 원시 로그](captures/round-2/QA-4-boundary.json), [동쪽 1px](captures/round-2/QA-4-boundary-light-edge0--1.png), [정확한 변](captures/round-2/QA-4-boundary-light-edge0-0.png), [서쪽 1px](captures/round-2/QA-4-boundary-light-edge0-1.png). 전체 PNG는 `QA-4-boundary-{light,dark}-edge{0,1,2}-{-3,-1,0,1,3}.png`.
- 별도 z15 값 칸 `다사54005000`: `2026-09-22 12:00 KST`, `3,245.69명`. 비식별 칸 `다사54505025`: `비식별/자료 없음`. 0명으로 치환하지 않았다. [툴팁 원시 로그](captures/round-2/QA-followup.json) `tooltips`.

## QA-5 성능

변경 전 5회 완료 후 변경 후 5회 실행했다. 매 최초 진입은 새 context/page에서 모듈·칸 캐시가 빈 상태로 실행했다. 지정 중심은 `(37.55,126.98)`이며 Leaflet 픽셀 반올림 후 실제 중심은 전후 동일한 `(37.55002139332707,126.97998046875001)`이었다. 줌 13, 시각 12.

최초 진입은 select의 실제 change 이벤트 직전부터 자료 로드·첫 도형 생성 및 연속 rAF 두 번 종료까지 측정했다. 앱 기본 시각이 마지막 조각이므로 브라우저 메모리의 `state.timeAt` 접근자로 첫 선택만 12로 고정하고 곧바로 복원했다. 모든 최초 생성의 slice=12를 로그에 남겼다. 지도 init 참조 획득 hook과 첫 도형 생성 관찰 wrapper만 주입했고 기하·그리기 구현은 변경하지 않았다.

이후는 다섯 번째 페이지에서 `12↔15`를 20회 오갔다. slider input dispatch 직전부터 연속 rAF 두 번 종료까지 측정해 기존 clearLayers, 새 히트 영역·채움 경로 생성, Canvas redraw를 포함했다. 중앙값은 가운데 두 값 평균, p90은 정렬한 20개 중 18번째다. 측정 중 다른 QA 브라우저 작업은 실행하지 않았다.

| 지표 | 변경 전 점 | 변경 후 사각형 |
|---|---:|---:|
| 표시 칸 | 2,603 | 2,816 |
| 실제 채움 경로 | 2,603 원 | 6 다중 링 폴리곤 |
| 별도 투명 히트 영역 | 0 | 2,816 |
| 전체 L.Path | 2,603 | 2,822 |
| 최초 진입 5회 (ms) | 113.7, 113.0, 101.3, 99.1, 103.4 | 117.2, 113.6, 113.1, 115.7, 113.7 |
| 최초 진입 중앙값 (ms) | 103.40 | 113.70 |
| 이후 20회 중앙값 (ms) | 30.10 | 35.40 |
| 이후 20회 p90 (ms) | 31.70 | 38.20 |
| 끌기·줌 longtask 전체 목록 | `[]` | `[]` |
| 200ms 초과 긴 작업 | 0 | 0 |

| 성능 판정 | 계산 | 결과 |
|---|---|---|
| 이후 중앙값 | 35.40 ≤ max(30.10×1.5, 30.10+50) = **80.10ms** | O |
| 이후 p90 | 38.20 ≤ **300ms** | O |
| 최초 진입 중앙값 | 113.70 ≤ **600ms** | O |

끊김 검사는 PerformanceObserver('longtask')를 켜고 300px 실제 마우스 끌기 3회, 줌 13→15→13을 했다. 전후 긴 작업 없음. [원시 수치·동작 시각·longtask](captures/round-2/QA-results.json) `runs`, [전 화면](captures/round-2/QA-5-before.png), [후 화면](captures/round-2/QA-5-after.png).

## QA-6 정상·실패 회귀

- 줌 12: 격자 0개. [화면](captures/round-2/QA-6-z12.png). slider 12→00시: 관찰한 180칸 중 81칸 농도 변경. [화면](captures/round-2/QA-6-slider.png), [로그](captures/round-2/QA-results.json) `slider`.
- now/history/forecast/usual: 목록·안내·도형이 전후 일치. history는 로컬 timeline 자료가 없는 빈 자료 흐름, forecast는 로컬 current의 예측값 흐름이다. [비교 로그](captures/round-2/QA-followup.json) `modeComparison`, `QA-6-mode-{now,history,forecast,usual}.png`.
- 레이어 실패: 동네·지하철·거리·오늘의 로컬 자료 없음 → 체크 해제·오류 안내·도형 수가 전후 일치. [비교 로그](captures/round-2/QA-followup.json) `layers`/`layerComparison`, `QA-6-{before,after}-layer-{dong,metro,street,today}.png`.
- 레이어 정상: [최소 시험 fixture](captures/round-2/QA-6-controlled-fixtures.json)를 전후 동일하게 주입하고 실제 체크박스를 켰다. 동네 427 / 지하철 1 / 거리 2 / 오늘 1 도형, 좌표·색·투명도·툴팁·안내 일치. 운영 피드 검증이 아닌 렌더링 회귀 증거다. [비교 로그](captures/round-2/QA-6-layer-normal.json), `QA-6-{before,after}-normal-{dong,metro,street,today}.png`.
- grid.json 503: 격자 0, 자료 실패 안내. [화면](captures/round-2/QA-6-failure-grid.png). geometry 503: 같은 동작. [화면](captures/round-2/QA-6-failure-geo.png). 원시 로그 `QA-results.json`의 `failures`.
- 존재하지 않는 선택 slice를 브라우저 상태에 넣고 실제 syncMap 실행: 격자 0. [화면](captures/round-2/QA-6-missing-slice.png), [로그](captures/round-2/QA-followup.json) `missingSlice`.
- 기록한 브라우저 pageerror 0. 외부 요청 차단, 타일·없는 로컬 자료 404, 의도한 503 관련 console 오류는 원시 로그에 보존했다.

## 실행 증거와 해석 주의

모든 신규 캡처·스크립트·로그는 git 제외 `captures/round-2/`에 있다. 1회차 캡처와 fixture/baseline은 그대로 보존했다.

- [수용 로그](captures/round-2/AC-acceptance.log).
- [주 실행 스크립트](captures/round-2/QA-run.mjs), [실행 로그](captures/round-2/QA-run.log), [결과](captures/round-2/QA-results.json).
- [회귀·툴팁·정착 가장자리 스크립트](captures/round-2/QA-followup.mjs), [로그](captures/round-2/QA-followup.log), [결과](captures/round-2/QA-followup.json).
- [레이어 정상 스크립트](captures/round-2/QA-layers.mjs), [로그](captures/round-2/QA-layers.log).
- [기본 복구 스크립트](captures/round-2/QA-recovery.mjs), [로그](captures/round-2/QA-recovery.log); [z18 공유 변 스크립트](captures/round-2/QA-seams.mjs), [로그](captures/round-2/QA-seams.log).
- [실제 마우스 공유 변 스크립트](captures/round-2/QA-4-boundary.mjs), [로그](captures/round-2/QA-4-boundary.log), [결과](captures/round-2/QA-4-boundary.json).
- [전 서버 로그](captures/round-2/QA-server-before.log), [후 서버 로그](captures/round-2/QA-server-after.log), [검증 요약](captures/round-2/QA-summary.json).

`QA-seams-initial.*`의 초기 마우스 탐색은 지도 컨테이너 오프셋을 누락해 다른 칸을 가리킨 로그다. 제품 결함 근거로 사용하지 않았고 원시 기록은 보존했다. 최종 경계 판정은 오프셋을 반영한 `QA-4-boundary.*`만 사용한다. 픽셀 판정은 최종 `QA-recovery.json`과 `QA-seams.json`만 사용한다. `QA-results.json`의 즉시 이동 edges보다, 정착 후 별도 측정한 `QA-followup.json`의 edgeSettled를 QA-3 근거로 사용했다.

확인한 항목: AC-1~4 및 기존 수용 7개, QA-1~6, Q-1·Q-2 해결, 공유 변 단일 칸 선택, 5단계 농도·비식별 표시, 화면 가장자리, 성능 세 기준·긴 작업, 다른 모드·레이어 정상/실패와 grid/geometry/slice 실패 흐름.
