## 읽을 것
- `ai-log/20261003/001_004527_posthog-tracking/04-wiki/summary.md` (갱신 요약, 등록 문서 검수 대상 목록)
- 갱신된 문서: `docs/숫자-기록.md`, `docs/인수인계.md`, `CLAUDE.md`(첫머리 Usage stats 단락, Design의 Fonts 줄, jelly-studio 절), `README.md`(마지막 문단), `docs/crossgate-pilot.md`("실행 기록"), `docs/INDEX.md`(새 파일)
- 등록 문서(변경 없음, 이번에 처음 검수): `docs/아이디어.md`, `AGENTS.md`의 jelly-studio 절
- 이번 변경의 코드: `analytics.js`, `lib/track.js`, `app.js`(`select`, `readHash`, `setMapPickHandler` 콜백), `map.js`(`pick`), `index.html`(footer), `404.html`, `styles.css`(폰 미디어 블록의 `.foot`)
- 기준: `ai-log/20261003/001_004527_posthog-tracking/00-request/request.md`(R-1~R-15, 결정 목록, 사용자 확인 기록), `ai-log/20261003/001_004527_posthog-tracking/01-planning/todo.md`("영향 문서")
- 검증 기록: `ai-log/20261003/001_004527_posthog-tracking/03-qa/report.md`, `ai-log/20261003/001_004527_posthog-tracking/03-qa/sdk-check.md`
- 문서 diff 범위: `git diff main..HEAD -- docs CLAUDE.md AGENTS.md README.md` (등록 문서 포함 전체)

## 할 일
`roles/wiki-reviewer.md`대로 Wiki 루브릭 4개 항목(관련성, 정확성, 비관련 불변, 목차·링크)을 판정한다. 1회차다.

- 등록 문서(`jelly/register`에서 온 것)도 정확성 대상이다. 문서가 말하는 사실이 지금 코드·설정과 맞는지, 서로 모순이 없는지 본다.
- `docs/숫자-기록.md` 1~3장은 jelly-studio 계약(`../../jelly-studio/docs/contracts.md` 2장, 이 저장소 밖)의 사본이다. 원문과의 대조는 하지 않아도 된다. 같은 문서의 "평소보다" 절과 모순되는지만 본다.
- PostHog SDK 동작에 관한 서술은 `03-qa/sdk-check.md`와 `todo.md` 배경 사실을 근거로 본다. 네트워크로 확인하려 하지 않는다.
- `docs/crossgate-pilot.md` 실행 기록 줄은 PR이 아직 없어 PR 칸에 브랜치 이름을 적었다.
