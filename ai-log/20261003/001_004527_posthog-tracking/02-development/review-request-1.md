## 읽을 것
- `ai-log/20261003/001_004527_posthog-tracking/raw/dev-diff-1.patch` (검수 대상: 코드 diff 전체)
- `ai-log/20261003/001_004527_posthog-tracking/01-planning/todo.md` (기획 승인본: 상태 계약, DEV-001~007, 수용 기준, 하지 않을 일)
- `ai-log/20261003/001_004527_posthog-tracking/00-request/request.md` (확정 요구 R-1~R-15, 결정 목록)
- `tests/acceptance/analytics.test.js` (수용 테스트 AC-1~AC-11)
- 바뀐 파일의 현재 상태: `analytics.js`, `lib/track.js`, `app.js`(`select`, `setMapPickHandler` 콜백, `readHash`, `bindBoard`, `renderDetail`), `map.js`(`pick`), `index.html`, `404.html`, `styles.css`(폰 미디어 블록)
- `.crossgate/config.json` (`forbidden`, `protected`)
- `CLAUDE.md` Design 절(토큰만 쓰기)

## 할 일
`roles/dev-reviewer.md`대로 개발 루브릭 4개 항목(TODO 구현, 근거 일치, 범위 준수, 부작용)을 판정한다. 1회차다.

- gate(`npm test`, 수용 테스트 22개)는 통과했다(로그 `raw/gate-1.log`).
- PostHog SDK 동작(설정 이름, 첫 페이지뷰의 `service`, 자동 수집 꺼짐)은 `todo.md` 배경 사실을 사실로 둔다. 네트워크로 확인하려 하지 않는다.
- 특히 볼 것: `map.js` `pick`이 `state.selected`·`state.focus`를 직접 쓰지 않게 바뀐 뒤 지도 선택의 기존 동작이 유지되는지, `select`를 거치지 않는 선택 경로(`readHash`)에 기록이 걸리지 않았는지, 폰 footer 규칙이 접힌 시트와 데스크톱 배치를 바꾸지 않는지.
- 문서(`docs/`, `CLAUDE.md` 등)는 Wiki 단계에서 고친다. 이 diff에 없어도 지적하지 않는다.
