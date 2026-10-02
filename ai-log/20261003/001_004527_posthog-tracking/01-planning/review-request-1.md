## 읽을 것
- `ai-log/20261003/001_004527_posthog-tracking/00-request/request.md` (확정 요구 R-1~R-15, 결정 목록 C-1~C-29, 허락 범위)
- `ai-log/20261003/001_004527_posthog-tracking/01-planning/todo.md` (검수 대상)
- `tests/acceptance/analytics.test.js` (검수 대상: 수용 테스트 AC-1~AC-11)
- `docs/숫자-기록.md` ("평소보다" 절, 1~2장)
- `app.js` (`select`, `readHash`, `bindBoard`, `renderDetail`, `setMapPickHandler` 콜백, `load`, `hashchange`·`visibilitychange` 리스너)
- `map.js` (`pick`, `setMapPickHandler`)
- `index.html` (`<footer class="foot">`, 스크립트 태그), `404.html`
- `styles.css` (`.foot`, `.sources`, 폰 미디어 블록 `@media (max-width: 47.99rem)`)
- `.crossgate/config.json` (`forbidden`, `protected`, `gate`), `package.json`(`test` 스크립트가 도는 경로)

## 할 일
`roles/plan-reviewer.md`대로 기획 루브릭 6개 항목을 판정한다. 1회차다.

참고:
- PostHog 설정 이름과 SDK 동작은 네트워크 없이 확인할 수 없다. `todo.md` "배경 사실"의 실제 SDK 확인 결과(2026-10-03, posthog-js 1.435.7)를 사실로 둔다.
- 수용 테스트는 아직 구현이 없어 지금 실행하면 실패한다(`analytics.js`, `lib/track.js` 없음). 기획 단계에서 임시 구현으로 11개 통과를 확인했다.
- 적용 지점 검색어는 `todo.md` 배경 사실에 있다: `select(`, `state.selected =`.
