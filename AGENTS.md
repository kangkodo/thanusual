# Agent notes

Read `CLAUDE.md` first. It is the source of truth for product locks, deploy, and gstack.

This is a live static site (Cloudflare Pages). Prefer small diffs. Do not rewrite the ranking board while adding a map.

Sprint: /office-hours → /autoplan → implement one slice → /review → /qa → /ship.
Do not mix those roles in one prompt.

Web browsing: gstack `/browse`. Not Chrome MCP.

<!-- crossgate:start -->
## AI 교차검수 파이프라인

이 저장소는 crossgate을 따른다(버전: `.crossgate/config.json`). 규칙은 `.crossgate/kit/CROSSGATE.md`에 있다.

- Claude: `/crossgate` 스킬로 Master 역할을 한다. 사용자와 대화하는 창구는 Master 하나다.
- Codex: Master가 `crossgate codex <역할>`로 부를 때 해당 역할 카드(`.crossgate/kit/roles/`)만 따른다.
- 개발 역할은 `.crossgate/`, `ai-log/`, 수용 테스트를 수정하지 않는다.
- 이 저장소의 기존 작업 절차와 겹치면, `/crossgate`으로 시작한 작업만 이 파이프라인 절차를 따른다. 그 밖의 작업은 기존 절차를 그대로 따른다.
<!-- crossgate:end -->

<!-- jelly-studio:start -->
## jelly-studio 공통 규칙

- 이 서비스는 jelly-studio 목록에 있고 id는 `thanusual`다. 단계는 jelly-studio가 관리한다(확인: jelly-studio 루트에서 `python3 bin/jelly resume thanusual`).
- 개발은 `/crossgate`로 한다(Claude PM, Codex 구현, Claude 읽기 전용 검수). 작업 등급(가벼움·보통·무거움)은 크로스게이트 규칙대로 Master가 추천하고 사용자가 정한다. 이 문서는 등급 기준을 따로 정하지 않는다.
- 작업을 마칠 때마다 `docs/인수인계.md`의 세 절(마지막 작업·다음 할 일·열린 문제)을 갱신한다.
- 숫자 기록은 `docs/숫자-기록.md` 약속을 따른다. PostHog에 개인정보를 보내지 않는다. PostHog를 처음 넣는 개발에서 쿠키 고지를 함께 넣는다(문구 예시는 `docs/숫자-기록.md`).
- AI를 부르는 서비스는 호출마다 `ai_cost`를 서버에서 기록하고, 서비스 전용 AI 키를 쓴다. AI 기능을 처음 배포하기 전에, 그 키에 업체 쪽 월 한도가 걸려 있는지 사용자에게 확인받는다. 확인 전에는 배포를 제안하지 않는다.
- 배포와 push는 사용자가 지시할 때만 한다.
- 단계가 `maintenance`이면 새 기능 요청을 받았을 때 먼저 단계를 바꿀지 사용자에게 묻는다. `paused`·`closing`·`retired`이면 개발하지 않는다.
<!-- jelly-studio:end -->
