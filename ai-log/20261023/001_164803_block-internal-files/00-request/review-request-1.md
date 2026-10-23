## 읽을 것
- `ai-log/20261023/001_164803_block-internal-files/00-request/request.md` (검수 대상)
- `wrangler.toml`, `package.json`, `.gitignore`, `_headers`, `robots.txt`
- `index.html`, `404.html` (src/href), `app.js`·`shared.js`·`lib/layers.js` (fetch·import 경로), `manifest.webmanifest`
- `functions/tiles/[[path]].js` (`../../lib/tiles.js` import)
- `CLAUDE.md` (Map 절의 wrangler 관련 줄, Deploy Configuration 절), `README.md` 11행
- `.crossgate/config.json` (`forbidden`, `qa.serve`)

## 할 일
`roles/request-reviewer.md`대로 `request.md`의 결정 목록을 검수한다. 1회차다.

참고: Cloudflare 문서 확인 사실(Pages에 무시 파일 없음, Functions는 프로젝트 루트에서 읽힘)과 운영 주소 curl 결과는 네트워크 없이 다시 확인할 수 없으므로 "조사한 사실"을 사실로 둔다.
