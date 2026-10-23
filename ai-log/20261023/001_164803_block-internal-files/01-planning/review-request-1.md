## 읽을 것
- `ai-log/20261023/001_164803_block-internal-files/00-request/request.md` (승인된 요구·결정 목록, 특히 C-2·C-6·C-10·C-14·C-15)
- `ai-log/20261023/001_164803_block-internal-files/01-planning/todo.md` (검수 대상)
- `tests/acceptance/site-build.test.js` (검수 대상, 수용 테스트 AC-1~AC-5)
- `wrangler.toml`, `package.json`, `.gitignore`, `.crossgate/config.json` (`qa.serve`)
- `index.html`, `404.html`, `styles.css`, `vendor/leaflet/leaflet.css`, `lib/*.js`, `functions/tiles/[[path]].js`
- `CLAUDE.md` (Product locks, Map, Design, Deploy Configuration 절), `README.md` 7·11행, `docs/인수인계.md`

## 할 일
`roles/plan-reviewer.md`대로 기획을 검수한다. 1회차다.

참고: 빌드 스크립트는 아직 없다. Master가 임시 스크립트로 수용 테스트를 돌려 AC-1~AC-4가 통과하고 AC-5만(설정 미변경으로) 실패함을 확인한 뒤 지웠다. 네트워크 사실은 request.md "조사한 사실"을 따른다.
