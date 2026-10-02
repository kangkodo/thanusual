## 읽을 것
- `ai-log/20261003/001_004527_posthog-tracking/00-request/request.md` (검수 대상)
- `docs/숫자-기록.md` ("평소보다" 절, 1~2장: 이 서비스의 요구사항과 이벤트 계약 사본)
- `docs/인수인계.md`
- `CLAUDE.md` (Product locks, Design, jelly-studio 공통 규칙 절)
- `index.html` (footer `.foot`, `<details class="sources">`), `404.html`
- `app.js` (`select`, `readHash`, `bindBoard`, `renderDetail`, `setMapPickHandler` 콜백, `load`, `hashchange` 리스너)
- `map.js` (`pick`, `setMapPickHandler`)
- `styles.css` (`.foot`, `.sources`, 폰 미디어 블록 `@media (max-width: 47.99rem)`의 `.masthead, .foot { display: none; }`)
- `_headers`, `.crossgate/config.json` (`forbidden`)
- `docs/crossgate-pilot.md` (운영 관련 사실)

## 할 일
`roles/request-reviewer.md`대로 `request.md`의 결정 목록을 검수한다. 1회차다.

참고: 교차 서비스 계약 원문(`../../jelly-studio/docs/contracts.md` 2장)은 이 저장소 밖에 있다. 내용은 `docs/숫자-기록.md` 1~2장과 같다. PostHog 설정 이름은 네트워크 없이 확인할 수 없으므로 `request.md` "조사한 사실"의 PostHog 항목(2026-10-03 공식 문서 확인)을 사실로 둔다.
