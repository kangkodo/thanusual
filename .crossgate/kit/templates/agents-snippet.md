<!-- crossgate:start -->
## AI 교차검수 파이프라인

이 저장소는 crossgate을 따른다(버전: `.crossgate/config.json`). 규칙은 `.crossgate/kit/CROSSGATE.md`에 있다.

- Claude: `/crossgate` 스킬로 Master 역할을 한다. 사용자와 대화하는 창구는 Master 하나다.
- Codex: Master가 `crossgate codex <역할>`로 부를 때 해당 역할 카드(`.crossgate/kit/roles/`)만 따른다.
- 개발 역할은 `.crossgate/`, `ai-log/`, 수용 테스트를 수정하지 않는다.
- 이 저장소의 기존 작업 절차와 겹치면, `/crossgate`으로 시작한 작업만 이 파이프라인 절차를 따른다. 그 밖의 작업은 기존 절차를 그대로 따른다.
<!-- crossgate:end -->
