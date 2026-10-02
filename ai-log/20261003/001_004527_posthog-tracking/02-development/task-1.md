## 읽을 것
- `ai-log/20261003/001_004527_posthog-tracking/01-planning/todo.md` (기획 승인본. "배경 사실", "상태 계약", TODO, "공식 로더", "하지 않을 일" 전부)
- `ai-log/20261003/001_004527_posthog-tracking/00-request/request.md` (확정 요구 R-1~R-15, 결정 목록)
- `tests/acceptance/analytics.test.js` (수용 테스트 AC-1~AC-11. 수정 금지)
- `app.js` (`select`, `readHash`, `bindBoard`, `renderDetail`, `setMapPickHandler` 콜백)
- `map.js` (`pick`, `setMapPickHandler`)
- `index.html` (`<footer class="foot">`, 끝의 스크립트 태그), `404.html`
- `styles.css` (`.foot`, `.sources`, 폰 미디어 블록 `@media (max-width: 47.99rem)`의 `.masthead, .foot { display: none; }`, `body.map-sheet-open`)
- `CLAUDE.md` Design 절(토큰만 쓰기, 문구 규칙)

## 개발 지시 (1회차)

`todo.md`의 DEV-001~DEV-007을 모두 구현하라. "상태 계약"이 기준이다.

- 항목을 끝낼 때마다 `todo.md`에서 해당 항목을 `[x]`로 바꾸고 바로 아래에 `  완료 근거: 파일 · 추가/변경한 요소` 한 줄을 넣는다. 항목 문구는 바꾸지 않는다.
- `analytics.js`는 일반 스크립트다. 수용 테스트가 `node:vm`으로 가짜 `window`·`document`·`location`·`navigator`를 주고 그대로 실행한다. "공식 로더"는 한 글자도 고치지 않고 넣는다.
- 코드는 짧게 쓴다. 설정 객체, 추상화, 대기열, 재시도 같은 것을 새로 만들지 않는다. 기존 파일의 주석 밀도와 문체를 따른다.
- 네트워크가 없으므로 PostHog SDK를 내려받아 확인하려 하지 않는다. SDK 동작은 `todo.md` 배경 사실을 사실로 둔다.
- 수용 테스트는 수정 금지. `node --test tests/acceptance/*.test.js`와 `npm test`가 모두 통과해야 한다. 개발용 단위 테스트는 필요하면 `lib/track.test.js`로 추가해도 된다(필수 아님. 수용 테스트와 같은 내용을 반복하지 않는다).
- 금지: `.crossgate/`, `ai-log/`(todo.md 체크·근거 제외), `tests/acceptance/`, `.github/`, `scripts/`, `functions/`, `lib/tiles.js`, `package.json`, `wrangler.toml`, `_headers`, `vendor/`. 새 의존성 금지. 비밀 파일 읽기 금지. 문서(`docs/`, `CLAUDE.md`, `README.md`, `AGENTS.md`)는 Wiki 단계에서 Master가 고치므로 건드리지 않는다.
- 임시 파일을 작업 트리에 남기지 않는다. 커밋은 하지 않는다(Master가 한다).
- 끝나면 바꾼 파일, DEV 항목별 상태, 두 테스트 명령 결과를 요약해 답하라. TODO가 요구와 충돌하거나 비어 보이는 곳이 있으면 편한 쪽으로 해석하지 말고 답변에 적는다.
