# 요청 명세

등급: 무거움 · 근거: 배포 구성을 바꾸며 금지 경로 `wrangler.toml`·`package.json`을 반드시 고친다(CROSSGATE.md 10장 승격 조건). 사용자는 보통을 골랐으나 금지 경로 때문에 Master가 승격했고 사용자에게 알렸다 · 사용자 확정: 2026-10-23 (방법 A, 등급은 규칙에 따라 무거움으로 승격)

## 사용자 목표
공개 Pages 사이트(https://thanusual.pages.dev)에서 저장소 내부 파일(크로스게이트 킷·실행 기록, 에이전트 지시, 문서, 스크립트, 테스트, 설정)이 열리지 않게 한다. 새 파일이 생겨도 다시 새지 않도록 허용 목록 방식으로 한다.

## 조사한 사실 (2026-10-23)
- `wrangler.toml`이 `pages_build_output_dir = "."`이고 저장소 루트 전체가 배포된다. Pages 대시보드 빌드 명령은 비어 있는 것으로 보인다(빌드 산출물 없음).
- 운영 주소에서 200으로 열리는 내부 파일: `/AGENTS.md`, `/CLAUDE.md`, `/README.md`, `/docs/*`, `/ai-log/**`, `/.crossgate/**`, `/.agents/skills/**`, `/.github/workflows/*`, `/scripts/*.py`, `/*.test.js`, `/lib/*.test.js`, `/package.json`, `/skills-lock.json`, `/wrangler.toml`, `/.gitignore`, `/places.json`. 이미 404: `/_headers`, `/functions/**`, `/.git/*`.
- 사이트가 실제로 쓰는 파일(`index.html`·`404.html`의 src/href, JS import·fetch로 확인): `index.html`, `404.html`, `app.js`, `map.js`, `map-radius.js`, `shared.js`, `analytics.js`, `styles.css`, `manifest.webmanifest`, `robots.txt`, `_headers`, `lib/{grid-cells,layers,pins,tiles,track}.js`, `vendor/**`, `icons/**`, `data/**`(`./data/current.json`, `./data/grid.json` 폴백). `places.json`은 `scripts/collect.py`·`scripts/poller.py`만 읽는다.
- Cloudflare Pages에는 사용자가 설정하는 무시 파일이 없다. `.assetsignore`는 Workers 정적 자산 전용이고, Pages는 `node_modules`·`.DS_Store`·`.git`만 자동 제외한다(developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/).
- Pages Functions(`functions/`)는 출력 폴더가 아니라 프로젝트 루트에서 읽힌다. `wrangler.toml`이 있으면 그 파일이 출력 폴더의 기준이다. 빌드 명령은 `wrangler.toml`로 정할 수 없고 대시보드에서 정한다.
- GitHub 저장소 `kangkodo/thanusual`은 공개다. 이 작업은 서비스 도메인에서 내리는 것이지 비밀 보호가 아니다.
- `data` 브랜치 미리보기(`data.thanusual.pages.dev`)는 2026-09-06 이후 갱신되지 않는다(이미 빌드되지 않음).
- `npm test`의 글롭은 `'*.test.js' 'lib/*.test.js' 'functions/**/*.test.js'`다.

## 확정 요구사항
- R-1: 빌드 단계가 허용 목록에 있는 사이트 파일만 출력 폴더로 복사하고, Pages는 그 폴더만 배포한다.
- R-2: 허용 목록 밖의 파일은 출력 폴더에 들어가지 않는다. 허용 목록 디렉터리 안이라도 `*.test.js`는 넣지 않는다.
- R-3: 사이트 동작(지도 타일 Function, 404 페이지, `_headers` 캐시, 데이터 폴백)은 그대로다.
- R-4: 허용 규칙이 맞는지 보여 주는 테스트가 `npm test`에서 돈다.
- R-5: 로컬 `wrangler pages dev`로 막힌 경로(404)와 정상 페이지를 둘 다 확인한다.
- R-6: 로컬 개발 명령과 문서가 새 구조를 따른다.

## 하지 않을 일
- 저장소 파일 이동(경로 변경). main 원래 checkout의 커밋 안 된 작업과 충돌하지 않게 한다.
- Pages 대시보드 설정 변경, 옛 배포 삭제, Search Console 삭제 요청: 사용자가 직접 할 일로 안내만 한다.
- `release` 브랜치 변경과 배포.
- `robots.txt` 내용 변경, `functions/`·`lib/tiles.js` 수정.
- 열린 PR #30(크로스게이트 0.9.1) 관련 파일.

## 결정 목록
| ID | 결정 | 처리 | 근거 · 답 |
|---|---|---|---|
| C-1 | 막는 방법 | 사용자 | 빌드 단계 허용 목록 복사(방법 A). B(미들웨어)·C(폴더 이동)는 기각 |
| C-2 | 허용 목록 내용 | 도출 | "조사한 사실"의 사이트 사용 파일. `places.json`·`README.md`·문서·스크립트·테스트는 제외 |
| C-3 | 허용 디렉터리 안의 테스트 파일 | 도출 | R-2. `lib/*.test.js`는 사이트가 쓰지 않음 |
| C-4 | 출력 폴더 이름과 git | 조정값 | `dist/`, `.gitignore`에 추가. 빌드마다 비우고 새로 만든다 |
| C-5 | 빌드 스크립트 위치·형식 | 조정값 | `scripts/build-site.mjs`(Node 표준 라이브러리만), `npm run build`로 실행. 의존성 추가 없음 |
| C-6 | 허용 목록 파일이 없을 때 | 조정값 | 빌드 실패(0 아닌 종료 코드). 조용히 빠진 채 배포되지 않게 한다 |
| C-7 | `wrangler.toml` 출력 폴더 | 도출 | `pages_build_output_dir = "dist"` (C-1) |
| C-8 | 로컬 개발 명령 | 도출 | `npm run dev`가 빌드 뒤 `wrangler pages dev`(출력 폴더는 `wrangler.toml`을 따름). `.crossgate/config.json` `qa.serve`도 같은 방식으로 Master가 맞춘다 |
| C-9 | `.dev.vars` 위치 | 도출 | 프로젝트 루트에 그대로 둔다. 출력 폴더가 `dist/`가 되므로 CLAUDE.md의 「`.dev.vars`가 출력 폴더에 있다」 경고는 고쳐 쓴다 |
| C-10 | 대시보드 빌드 명령 | 도출 | `npm run build`. 사용자가 다음 배포(`release` fast-forward) 전에 설정한다. 출력 폴더가 아직 `.`인 지금 설정해도 사이트에는 영향이 없다. 설정이 빠지면 빌드가 출력 폴더 없음으로 실패해 이전 배포가 유지된다(새지 않는 쪽으로 실패) |
| C-11 | 테스트 범위 | 조정값 | 임시 폴더에 빌드해 허용 파일이 있고 내부 파일(`AGENTS.md`, `ai-log/`, `.crossgate/`, `docs/`, `scripts/`, `package.json`, `wrangler.toml`, `*.test.js` 등)이 없음을 확인. 루트 `*.test.js`로 두어 `npm test`가 돈다 |
| C-12 | 이미 공개된 사본 | 해당 없음 | 옛 배포 고유 주소·검색 색인은 코드로 못 지운다. 보고에 사용자 할 일로 적는다. 응답이 `max-age=0`이라 CDN 캐시는 남지 않는다 |
| C-13 | `data` 브랜치 빌드 | 해당 없음 | 이미 빌드되지 않는다(조사한 사실) |

## 허락 범위
- 작업 브랜치 push와 PR 생성: 허락(세션 위임 범위).
- main 병합: 금지 경로를 건드려 자동 병합 불가. 병합 전에 사용자에게 묻는다.
- `release` 변경·배포, Cloudflare 대시보드 변경: 하지 않는다.
- 설치: 없음(`npx wrangler`는 이미 쓰던 로컬 개발 도구).

## 사용자 확인 기록
- 2026-10-23 · C-1 · 방법 A(빌드 허용 목록) 선택
- 2026-10-23 · 등급 · 보통 선택 → 금지 경로 때문에 규칙대로 무거움으로 승격, 사용자에게 알림
