<!-- ai-pipeline-kit:start -->
## AI 교차검수 파이프라인

이 저장소는 ai-pipeline-kit을 따른다(버전: `.pipeline/config.json`). 규칙은 `.pipeline/kit/PIPELINE.md`에 있다.

- Claude: `/pipeline` 스킬로 Master 역할을 한다. 사용자와 대화하는 창구는 Master 하나다.
- Codex: Master가 `pipeline codex <역할>`로 부를 때 해당 역할 카드(`.pipeline/kit/roles/`)만 따른다.
- 개발 역할은 `.pipeline/`, `ai-log/`, 수용 테스트를 수정하지 않는다.
- 이 저장소의 기존 작업 절차와 겹치면, `/pipeline`으로 시작한 작업만 이 파이프라인 절차를 따른다. 그 밖의 작업은 기존 절차를 그대로 따른다.
<!-- ai-pipeline-kit:end -->
