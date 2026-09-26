# 개발 지시 (1회차)

`ai-log/20260926/001_212957_pin-places/01-planning/todo.md`의 DEV-001~DEV-008을 모두 구현하라. "상태 계약" 절이 동작의 기준이다.

- 먼저 `todo.md` 전체와 `tests/acceptance/pins.test.js`, `CLAUDE.md`, `app.js`, `shared.js`, `index.html`, `styles.css`를 읽는다.
- 항목을 끝낼 때마다 `todo.md`에서 해당 항목을 `[x]`로 바꾸고, 그 항목 바로 아래에 `  완료 근거: 파일 · 추가/변경한 요소` 한 줄을 넣는다. 항목 문구는 바꾸지 않는다.
- 수용 테스트(`tests/acceptance/pins.test.js`)는 수정 금지다. 이 테스트와 기존 테스트(`npm test`)가 모두 통과해야 한다: `node --test tests/acceptance/*.test.js` 와 `npm test`.
- `lib/pins.js`에 대한 개발용 단위 테스트가 필요하면 `lib/pins.test.js`로 추가해도 된다(기존 `npm test` 패턴에 포함됨).
- 금지: `map.js`, `package.json`, `functions/`, `lib/tiles.js`, `.github/`, `scripts/`의 수집기, `wrangler.toml`, `_headers`, `.pipeline/`, `ai-log/`(todo.md 체크·근거 제외), 수용 테스트. 새 의존성 금지. 비밀 파일 읽기 금지.
- 기존 코드 스타일(순수 ES 모듈, 작은 함수, 주석 밀도)을 따른다.
- 끝나면 바꾼 파일 목록, DEV 항목별 상태, 두 테스트 명령의 결과를 요약해 답하라.
