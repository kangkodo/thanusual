# Crossgate 파일럿 (이 저장소)

범용 규칙은 설치된 Crossgate 킷(`.crossgate/kit/CROSSGATE.md`)과 설계 명세(`crossgate-spec`)에 있다. 이 문서는 **이 저장소에만 해당하는** 결정과 진행 기록이다.

## 파일럿 방식 (2026-09-26 결정)
- 한 저장소에서 두 상황을 브랜치로 비교한다.
  - 기존 프로젝트: `main`, 폴더 `/thanusual`
  - 새 프로젝트: 기록을 공유하지 않는 독립 브랜치 `next`, git worktree로 `/thanusual_new`에 꺼낸다. 핵심 아이디어와 데이터 출처만 가져와 처음부터 개발하고, 데이터는 같은 저장소의 `data` 브랜치를 읽는다.
- 기존(`main`)을 먼저 한다. 나중에 더 나은 쪽을 고른다: `next`가 나으면 `main`을 교체하는 전환 작업을 하고, `main`이 나으면 `next`를 지운다.
- 비교 시점과 기준: `next`가 핵심 기능(121곳 순위 + 지도)을 따라잡은 시점. 승인 후 결함, 테스트 범위, 코드 양, 작업당 비용·시간, 반려 횟수를 본다.

## 운영 관련 사실
- Cloudflare Pages 운영 브랜치는 `release`다(2026-09-26 `main`에서 변경). `main` 병합은 배포가 아니다. 배포는 사용자가 지시하면 `crossgate deploy`로 `main`을 `release`에 올린다.
- 수집은 GitHub Actions가 서울시 API로 하고 `data` 브랜치에 쓴다. 인증키는 Actions Secrets에 있다. 예약 실행 워크플로는 기본 브랜치(`main`)의 정의로만 돈다. 그래서 `next`의 변경은 전환 전까지 운영 수집에 영향이 없고, `main`에 병합된 수집기 변경은 다음 실행부터 운영에 반영된다.
- 공개 저장소라 보호 브랜치(Ruleset `main`)를 쓴다. 필수 검사는 `node`, `merge-check`이고 관리자는 우회할 수 있다. `next`를 만들면 같은 규칙을 건다.
- 금지 경로(`.crossgate/config.json`): 워크플로, 수집기, `wrangler.toml`, `_headers`, `package.json`, `functions/`, `lib/tiles.js`, 비밀 파일.

## 실행 기록
| 실행 | 작업 | 결과 | PR |
|---|---|---|---|
| `ai-log/20260926/001_212957_pin-places` | 관심 장소 고정 | 기획 1회 반려, Wiki 1회 반려 뒤 자동 병합 | #15 |
| `ai-log/20260926/002_233253_grid-squares` | 250m 칸을 정사각형으로 | 기획 2회 반려, QA 1회 실패 후 복구, 자동 병합 | #17 |

## 이 파일럿에서 나온 킷 개선
- 0.1.2: `todo.md` 체크 오탐 제거, Codex 토큰 기록, 검수 대체 절차
- 0.1.3: `usage.jsonl` 보호 경로 오탐 수정, 읽기 전용 Claude 검수 명령, 복사본 봉인(해시), 태그에서만 설치
- 0.2.0: 이름을 Crossgate로(`crossgate` 명령, `/crossgate` 스킬, `.crossgate/` 폴더)
