# 독립 QA 지시 (2회차, 복구 확인)

이번 변경: 250m 모드의 칸을 점에서 정확한 250m 사각형 폴리곤으로(`lib/grid-cells.js`, `map.js` drawGrid), 툴팁·안내 문구. 기준: `01-planning/todo.md`(3회차 승인)의 AC-1~4, QA-1~6, **"측정 절차" 절**.

## 준비물 (Master가 미리 둠, git 제외 경로)
- 고정 데이터: `ai-log/20260926/002_233253_grid-squares/03-qa/captures/grid-fixture.json` (운영 data 브랜치 grid.json, 받은 시각 2026-09-27 00:04)
- 변경 전 코드: `ai-log/20260926/002_233253_grid-squares/03-qa/captures/baseline/` (기준 커밋 `a3ca3c43e084e36c618f97b8b488d273bc823b5f` = main, 점 표시)
- 변경 후 코드: 저장소 루트 (브랜치 pipe/grid-squares, 커밋 7842888)

## 실행
- 수용 테스트: `node --test tests/acceptance/*.test.js`
- 화면: 변경 전은 `baseline/`에서, 변경 후는 저장소 루트에서 각각 `python3 -m http.server <포트> --bind 127.0.0.1`. 외부 요청은 막고, 앱이 grid.json을 요청하면 두 경우 모두 grid-fixture.json으로 응답한다. current.json 등은 각 폴더의 `./data/` 대체 경로로 읽힌다.
- 로컬에 있는 Playwright Chromium을 쓴다. 새 패키지 설치가 필요하면 설치하지 말고 BLOCKED.

## 수행
- QA-1~QA-6. QA-1은 줌 13·15·18 × 라이트·다크 캡처(칸 사이 틈, 선 겹침으로 생기는 진한 경계선이 있는지 확대 캡처 포함).
- QA-5는 "측정 절차"를 그대로: 변경 전을 먼저, 같은 fixture·영역. 도형 수, 최초 진입 5회 중앙값, 이후 20회 중앙값·p90, 긴 작업 목록. 판정 세 가지 계산 결과를 표로.
- 보고서에 기준 SHA, Chromium 버전, 기기(OS·CPU)를 적는다.

## 산출물
- 캡처·로그: `ai-log/20260926/002_233253_grid-squares/03-qa/captures/` (파일명 앞에 시나리오 ID)
- 보고서: `ai-log/20260926/002_233253_grid-squares/03-qa/report.md` — 시나리오별 결과, 증거 경로, 루브릭, 성능 표
- 소스·수용 테스트·todo.md 수정 금지. 판정 첫 줄: PASSED | FAILED | BLOCKED

## 2회차 추가 지시
- 1회차 보고서 `03-qa/report.md`의 Q-1, Q-2가 해결됐는지 먼저 판정하라(해결 / 미해결 / 재발). 1회차 보고서는 `03-qa/report-1.md`로 이름을 바꿔 보존하고, 새 보고서를 `03-qa/report.md`로 쓴다.
- 변경 후 코드는 저장소 루트(커밋 73a0b14 이후)다. 준비물(fixture, baseline)은 1회차와 같다.
- 특히 다음을 다시 본다: QA-1 전체(Q-1이 재현됐던 z15 라이트 상세 영역 포함, z18은 여러 지점), QA-4(공유 변 위 커서가 어느 칸을 잡는지, 칸 단위 툴팁), QA-5 재측정(채움 경로 + 히트 영역 구성), QA-6 회귀, Q-2(하단 "데이터 출처와 한계" 펼친 화면).
