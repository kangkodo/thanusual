판정: PASSED

검증 버전: `cf4c37fe7d0061f2775cd0fff548e70bfea83f35` (`pipe/posthog-tracking`). 시작 시 작업 트리는 깨끗했다. 비교 대상은 Master가 제공한 `captures/baseline/`(main `64c0a467`)이다. 2026-10-03 독립 QA 1회차이며, 소스·수용 테스트·TODO는 수정하지 않았다.

루브릭: 수용 테스트 통과 **O** / 시나리오 수행(정상·실패) **O** / 증거 존재(캡처·로그) **O**.
차단 결함 없음. 이 판정은 AC-1~AC-11, QA-1~QA-8 범위다. 실제 SDK 검증 S-1~S-5는 지시대로 실행하지 않았으며 이 판정에 포함하지 않는다. 배포 및 운영 수집 확인도 포함하지 않는다.

## 실행 환경과 수용 테스트

- 설치된 Playwright `/Users/doyun/.claude/skills/gstack/node_modules/playwright/index.mjs` 및 Chromium 사용. 새 설치 없음.
- 변경 후: `python3 -m http.server 8891 --bind 127.0.0.1`, 변경 전: 같은 명령의 8892 포트 및 `--directory .../captures/baseline`.
- `127.0.0.1`, `thanusual.localhost` 외 모든 요청은 browser context route에서 `abort()`했다. PostHog SDK 요청도 전송 전에 차단했다. SDK는 공식 로더 대기열 상태로 유지했다. 앱은 저장소의 오래된 `data/current.json`으로 표시했다.
- `node --test tests/acceptance/*.test.js`: 22/22 통과. 이 중 analytics AC-1~AC-11 모두 통과. [로그](captures/AC-acceptance.log)
- `npm test`: JS 42/42, Python unittest 10/10 및 grid/timeline 검사 통과. [로그](captures/AC-npm-test.log)
- 최종 브라우저 세션 15개 모두 `pageerror` 0건. 타일 404 및 차단된 외부 요청의 네트워크 진단은 예상 결과다.

## 시나리오 결과

| 시나리오 | 결과와 관찰 | 증거 |
|---|---|---|
| QA-1 | 로컬에서 PostHog 객체 없음, PostHog 요청 시도 0건. 장소 선택·상세·닫기·고정·검색 성공. 불일치 검색의 빈 결과 안내 확인. 쿠키 차단을 초기 스크립트로 모사한 공개 호스트에서도 동일 | [로컬 로그](captures/QA-1-local.json), [캡처](captures/QA-1-local.png), [쿠키 차단 로그](captures/QA-1-cookies-blocked.json), [캡처](captures/QA-1-cookies-blocked.png) |
| QA-2 | SDK 실패 상태에서 초기화 1회. capture 누계: 첫 로드 0 → 목록 1 → 같은 행 1 → 가까운 장소 2 → 실제 지도 원 클릭 3 → 닫기 3 → 같은 장소 다시 열기 4 → 고정 버튼 4 → 다른 고정 행 5. 모든 capture는 정확히 `core_action`, `{action:"place_open"}` | [단계별 대기열](captures/QA-2.json), [지도](captures/QA-2-map.png), [고정 목록](captures/QA-2-pinned.png) |
| QA-3 | 이태원역 주소 복원, 같은 행 선택, 강남역 hashchange 복원, 새로고침, 고정·분류·검색·시간 모드·레이어·시트 조작 모두 capture 0. 새로고침은 visible 상태에서 `visibilitychange`를 dispatch하고 실제 current.json 재요청 응답을 기다려 확인 | [단계별 대기열](captures/QA-3.json), [캡처](captures/QA-3.png) |
| QA-4 | 첫 행 Enter 후 1건, 다른 행 Space 후 2건 | [대기열](captures/QA-4.json), [캡처](captures/QA-4.png) |
| QA-5 | 1280×800 라이트·다크. 접힌 새 제목, 펼친 기존 출처 뒤 고지 문단 확인. 기존 출처 문단 동일. 접힌 상태 rail/masthead/main/목록의 좌표·크기 동일. 펼친 상태는 추가 문단만큼 목록 높이가 줄어듦 | [라이트 측정](captures/QA-5-light.json), [다크 측정](captures/QA-5-dark.json), 캡처 `QA-5-{light,dark}-{before,after}-{collapsed,expanded}.png` |
| QA-6 | 375×812 및 320×568, 라이트·다크. 접으면 footer 숨김, 펼치면 시트 하단 표시. 안내 펼친 뒤 footer 내부를 스크롤해 고지 끝까지 확인, 다시 접기 성공. 목록은 별도 스크롤 영역으로 유지. 페이지·footer 가로 넘침 없음 | 측정 `QA-6-{375,320}-{light,dark}.json`, 전후 캡처 `QA-6-{375,320}-{light,dark}-{before,after}-{collapsed,sheet-open,notice-open}.png`, 고지 하단 `QA-6-{375,320}-{light,dark}-after-notice-bottom.png` |
| QA-7 | 404 공개 호스트에서 초기화 1회, 로컬에서는 객체 없음. 쿠키 문구 없음. 라이트·다크 및 두 호스트의 변경 전후 PNG 파일이 각각 바이트 단위 동일 | [라이트 로그](captures/QA-7-light.json), [다크 로그](captures/QA-7-dark.json), 캡처 `QA-7-{light,dark}-{before,after}-{local,public}.png` |
| QA-8 | 실제 지도 원 클릭으로 가산디지털단지역 선택. 선택 행·포커스·해시 일치, 목록 scrollTop 2772, 포커스 행이 목록 안에 들어옴. 지도 zoom 13 유지, 재중앙 이동 없음. 변경 전후 관찰 steps 전체 동일. 시간 모드 다섯과 고정 목록 확인 | [변경 전 로그](captures/QA-8-before.json), [변경 후 로그](captures/QA-8-after.json), 캡처 `QA-8-{before,after}-{map,now,history,forecast,usual,grid}.png` |

## 폰 실측

단위 px. 라이트·다크 값 동일. 각 셀은 `footer 높이 / 목록(.board-scroll) 높이`다. 모든 상태에서 페이지 가로 스크롤 없음.

| 화면 | 버전 | 시트 접힘 | 시트 펼침·안내 접힘 | 안내 펼침 |
|---|---|---:|---:|---:|
| 375×812 | 변경 전 | 0 / 99.77 | 0 / 392.09 | 0 / 392.09 |
| 375×812 | 변경 후 | 0 / 99.77 | 46.19 / 345.91 | 189.70 / 202.39 |
| 320×568 | 변경 전 | 0 / 0 | 0 / 181.47 | 0 / 181.47 |
| 320×568 | 변경 후 | 0 / 0 | 46.19 / 135.28 | 132.61 / 48.86 |

변경 전 폰은 footer가 항상 숨겨져 있어 안내를 화면에서 펼칠 수 없다. 전후 상태 캡처를 맞추기 위해 변경 전의 `notice-open`만 DOM의 details.open을 설정했다. 변경 후는 클릭으로 열고 닫았다. 320px에서 안내를 펼친 동안 목록이 약 49px로 줄지만 스크롤 가능하며 시트 밖으로 넘치지 않는다. 고지 문단은 footer를 아래로 스크롤하면 읽을 수 있다.

## 지도·시간 모드 관찰

- 지도 클릭은 애플리케이션 선택 함수를 호출하지 않고 Playwright `mouse.click(x,y)`로 수행했다. Leaflet init hook으로 얻은 지도 참조는 좌표와 중심 관찰에만 사용했다.
- 클릭 전후 지도 중심 위도는 `37.49266855368577 → 37.492702604052376`, 경도는 `126.89552307128908`로 유지됐다. 변경 전후에 정확히 같은 1픽셀 미만 반올림이며 장소로의 재중앙 이동은 없다. map-pane transform도 동일했다.
- 최근 집계: 서울시 집계 약 30분 지연 안내.
- 지난 48시간: 과거 자료 수집 전 안내, 고정 행은 `이 시각 자료 없음`으로 유지.
- 시간별 예측: `2026-09-03 03:00 예측 · 관측값 아님`.
- 평소 대비: 같은 요일·30분대 평균 및 표본 부족 안내.
- 250m: `20260908 · 21시 · 내국인 생활인구 추정(실시간 아님)` 표시.

## 증거와 실행 이력

- [최종 결과](captures/QA-results.json), [재실행 가능한 스크립트](captures/QA-run.mjs).
- [첫 브라우저 실행](captures/QA-browser-run.log), [지도 클릭 조정 후 실행](captures/QA-map-rerun.log), [최종 회귀 실행](captures/QA-regression-rerun.log).
- 최초 Chromium 실행은 macOS sandbox의 MachPort 권한 오류로 실패했다([환경 로그](captures/QA-run.log)). 권한 검토를 거친 동일 로컬 브라우저 실행으로 해소됐다.
- 첫 스크립트는 붐빔 핀만 찾았으나 제공 데이터에는 보통·여유 장소만 있어 QA-2/8을 완료하지 못했다. 실제 표시된 원 클릭으로 수정했다. 이후 QA-8의 중심 좌표 완전 일치 단언도 변경 전후에 같은 반올림을 관찰해 1픽셀 미만 허용 및 전후 결과 비교로 조정했다. 이들은 QA 도구 문제이며 제품 결함으로 세지 않는다. 초기 실패 로그·캡처는 이력으로 보존했다. 최종 JSON과 마지막 회귀 로그가 최종 결과다.
- 지정된 이전 `QA-run.mjs` 예시는 이 작업 트리에 없었다. 이미 설치된 Playwright 경로는 Master가 둔 S-sdk-check.mjs의 import에서 확인했으며 해당 S 스크립트를 실행하지 않았다.
- `captures/`는 git 제외됨을 확인했다. 판정 레코드 기록·커밋·push·배포는 하지 않았다.
