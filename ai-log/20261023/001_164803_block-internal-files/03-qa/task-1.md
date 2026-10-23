## 읽을 것
- `ai-log/20261023/001_164803_block-internal-files/01-planning/todo.md` (수용 기준 AC-1~AC-7)
- `ai-log/20261023/001_164803_block-internal-files/00-request/request.md` (C-2 허용 목록, C-14 완료 기준, 허락 범위)
- `tests/acceptance/site-build.test.js`, `scripts/build-site.mjs`, `wrangler.toml`, `package.json`, `404.html`, `_headers`

## 변경 요약
Pages가 저장소 루트 대신 `dist/`를 배포한다. `npm run build`(`scripts/build-site.mjs`)가 브라우저용 파일 31개만 `dist/`로 복사한다. 타일 Function(`functions/`)은 프로젝트 루트에서 그대로 번들된다.

## 할 일
1. `node --test tests/acceptance/*.test.js`와 `npm test`를 돌린다.
2. `npm run build && npx wrangler pages dev --port 8788`(`config.qa.serve`)로 로컬 서버를 백그라운드로 띄운다. 이 worktree에는 `.dev.vars`가 없어 타일 Function은 키 없이 503을 돌려준다(정상, C-14). 끝나면 서버를 종료한다.
3. AC-6 경로 목록 전체를 `curl -s -o /dev/null -w '%{http_code}'`로 확인하고 표로 적는다. 막힌 경로의 본문이 `404.html`과 같은지, `/vendor/leaflet/leaflet.js`의 `Cache-Control`을 확인한다.
4. 실패 흐름: (a) `npm run build`를 두 번 연속 돌려 잔여물이 없는지, (b) 허용 목록 파일 하나가 없을 때 빌드가 실패하는지는 저장소 파일을 지우지 말고 AC-4 결과로 갈음한다, (c) 서버를 띄운 채 저장소 루트에 임시 파일 `qa-probe.md`를 만들고 다시 `npm run build` 뒤 `/qa-probe.md`가 404인지 확인한 다음 그 파일을 지운다.
5. 브라우저를 쓸 수 있으면 `http://localhost:8788/`을 열어 목록이 뜨는지, 콘솔에 타일 503 외 로컬 자산 오류가 없는지 캡처한다. 쓸 수 없으면 그렇게 적는다(외부 공개 데이터 GET은 허락됨).
6. 결과를 `03-qa/report.md`에, 로그·캡처를 `03-qa/captures/`에 남긴다. AC-7(배포 뒤 운영 확인)은 C-14에 따라 미실행으로 적는다.
