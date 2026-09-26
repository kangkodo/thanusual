# 개발 지시 (1회차)

`ai-log/20260926/002_233253_grid-squares/01-planning/todo.md`(기획 3회차, 승인)의 DEV-001~DEV-005를 모두 구현하라. "배경 사실", "상태 계약", "측정 절차" 절이 기준이다.

- 먼저 `todo.md` 전체, `tests/acceptance/grid-cells.test.js`, `CLAUDE.md`, `map.js`, `app.js`, `lib/layers.js`를 읽는다.
- 항목을 끝낼 때마다 `todo.md`에서 해당 항목을 `[x]`로 바꾸고 바로 아래에 `  완료 근거: 파일 · 추가/변경한 요소` 한 줄을 넣는다. 항목 문구는 바꾸지 않는다.
- 수용 테스트는 수정 금지. `node --test tests/acceptance/*.test.js`와 `npm test`가 모두 통과해야 한다.
- `lib/grid-cells.js`의 개발용 단위 테스트가 필요하면 `lib/grid-cells.test.js`로 추가해도 된다.
- DEV-004 측정은 "측정 절차"를 따르되 대략이면 된다(변경 전은 `git stash` 또는 기준 커밋에서). 측정 스크립트·임시 파일은 커밋하지 않는다(작업 트리에 남기지 말 것).
- 금지: `package.json`, `functions/`, `lib/tiles.js`, `.github/`, `scripts/`, `wrangler.toml`, `_headers`, `vendor/`, `.pipeline/`, `ai-log/`(todo.md 체크·근거 제외), 수용 테스트. 새 의존성 금지. 비밀 파일 읽기 금지.
- 끝나면 바꾼 파일, DEV 항목별 상태, 두 테스트 명령 결과, DEV-004 대략 수치를 요약해 답하라.
