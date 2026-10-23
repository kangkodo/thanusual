# 개발 TODO

문구는 기획만, 체크와 완료 근거는 개발만 바꾼다.

- [ ] DEV-001 `scripts/build-site.mjs`를 만든다. Node 표준 라이브러리만 쓴다. `node scripts/build-site.mjs [출력 폴더]`(기본: 저장소 루트의 `dist`, 원본 경로는 스크립트 위치 기준 저장소 루트)로 실행하면 출력 폴더를 지우고 새로 만든 뒤, request C-2의 허용 목록 파일 31개만 같은 상대 경로로 복사한다. 허용 목록은 디렉터리가 아니라 파일 경로 배열이다. 항목이 하나라도 없으면 아무것도 덜 복사된 채 끝나지 않게 0이 아닌 종료 코드로 실패한다(C-6). 목록 위에 「브라우저가 받는 파일만. 새 사이트 파일은 여기에 넣는다」는 주석 한 줄.
  확인 방법: tests/acceptance/site-build.test.js AC-1~AC-4
- [ ] DEV-002 `package.json` scripts: `build`는 `node scripts/build-site.mjs`, `dev`는 빌드 뒤 `wrangler pages dev`(디렉터리 인자 없이, `wrangler.toml`의 출력 폴더를 따름). `test`가 수용 테스트 `tests/acceptance/site-build.test.js`도 돌게 한다(R-4). 방법은 루트에 그 파일을 import하는 `site-build.test.js` 한 줄 파일을 두거나 `test` 글롭에 그 파일을 추가하는 것 중 하나. 다른 수용 테스트는 `npm test`에 넣지 않는다.
  확인 방법: AC-5, `npm test` 출력에 AC-1~AC-5가 보임
- [ ] DEV-003 `wrangler.toml`: `pages_build_output_dir = "dist"`. 위에 「Pages 대시보드 빌드 명령은 `npm run build`」 주석 한 줄. 기존 CARTO 주석은 그대로.
  확인 방법: AC-5
- [ ] DEV-004 `.gitignore`에 `dist/`를 추가한다.
  확인 방법: AC-5, 빌드 뒤 `git status`에 `dist/`가 안 보임

## 수용 기준
| ID | 기준 | 확인 방식 |
|---|---|---|
| AC-1 | 출력 폴더의 파일 목록이 C-2 허용 목록 31개와 정확히 같고, 이전 빌드 잔여물이 남지 않는다 | 자동: tests/acceptance/site-build.test.js |
| AC-2 | 내부 파일(`AGENTS.md`, `CLAUDE.md`, `README.md`, `ai-log/`, `.crossgate/`, `.agents/`, `.claude/`, `.cursor/`, `.github/`, `docs/`, `scripts/`, `tests/`, `functions/`, `package.json`, `skills-lock.json`, `wrangler.toml`, `.gitignore`, `places.json`, `.dev.vars`, `lib/tiles.js`, `GeistMono-Variable.woff2`)과 모든 `*.test.js`가 출력에 없다 | 자동: 같은 파일 |
| AC-3 | `index.html`·`404.html`의 로컬 src/href, 출력 JS의 상대 import와 `./…` 자산 경로, CSS `url()`, manifest 아이콘이 모두 출력에 있다 | 자동: 같은 파일 |
| AC-4 | 허용 목록 파일이 없으면 빌드가 실패한다 | 자동: 같은 파일 |
| AC-5 | `wrangler.toml` 출력 폴더가 `dist`, `npm run build`가 빌드 스크립트, `npm run dev`가 빌드를 거침, `.gitignore`에 `dist/` | 자동: 같은 파일 |
| AC-6 | 로컬 `npm run dev`에서 `/`, `/app.js`, `/lib/layers.js`, `/vendor/leaflet/leaflet.js`, `/icons/icon.svg`, `/data/current.json`, `/manifest.webmanifest`, `/robots.txt`는 200, `/AGENTS.md`, `/CLAUDE.md`, `/README.md`, `/ai-log/20260926/001_212957_pin-places/timeline.md`, `/.crossgate/kit/VERSION`, `/.agents/skills/ponytail/SKILL.md`, `/.github/workflows/collect.yml`, `/docs/INDEX.md`, `/scripts/baseline.py`, `/shared.test.js`, `/lib/layers.test.js`, `/package.json`, `/wrangler.toml`, `/places.json`는 404(본문은 `404.html`), `/lib/tiles.js`, `/vendor/geist/GeistMono-Variable.woff2`도 404. `/vendor/leaflet/leaflet.js` 응답에 `_headers`의 `Cache-Control: public, max-age=86400`. `/data/grid.json` 200. `/tiles/light/12/3493/1586.png`는 정적 404가 아니라 타일 Function이 응답한다(키 없이 503). 브라우저로 `/`를 열면 목록과 지도가 뜨고 콘솔에 로컬 자산 404가 없다 | 관찰: curl 상태 코드·헤더, 브라우저 |
| AC-7 | 배포 뒤 운영 주소에서 AC-6과 같은 결과, 실제 타일 성공 | 관찰: 사용자가 배포한 뒤 curl. C-14에 따라 이번 실행 범위 밖, 미실행으로 보고하고 명령을 남김 |

## 영향 문서
- `CLAUDE.md` Map 절: 「Local tiles need `npx wrangler pages dev .`」 → `npm run dev`. 「Never run `wrangler pages deploy .` from the repo root…」 → 출력 폴더가 `dist/`이고 빌드 허용 목록이 사이트 파일만 내보낸다는 사실로 고쳐 쓴다. Product locks의 Pages 배포 줄 근처에 「새 사이트 파일은 `scripts/build-site.mjs` 허용 목록과 수용 테스트 목록에 넣는다」. Deploy Configuration 절의 「push to `main` = 배포」 설명을 `release` 기준으로 고친다(C-15). Design 절의 Geist Mono 줄은 「vendored but unused, not published」로.
- `README.md` 11행: 출력 디렉터리 설명을 `dist`(빌드 허용 목록)로. main/배포 설명이 있으면 `release` 기준으로(C-15).
- `.crossgate/config.json` `qa.serve`: `npm run build && npx wrangler pages dev --port 8788` (Master가 고친다).
- `docs/인수인계.md`: 마지막 작업·다음 할 일(대시보드 빌드 명령 설정, 배포 뒤 확인)·열린 문제(옛 배포 고유 주소, 검색 색인).
- `docs/plans/osm-leaflet-eng.md` 12행: 갱신 불필요. 과거 기획 기록이다.

## 하지 않을 일
- 저장소 파일 이동·이름 변경, `functions/`·`lib/tiles.js`·`robots.txt`·`_headers` 수정.
- 의존성 추가.
- Pages 대시보드 변경, `release` 변경, 배포.
