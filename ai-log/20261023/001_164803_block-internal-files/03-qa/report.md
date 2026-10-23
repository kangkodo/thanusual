판정: PASSED

검증 커밋: `70c9e0e30de276eaf2e0e35d9fc584e13dafd791`  
검증일: 2026-10-23 KST. C-14의 로컬 범위 판정. 시작 시 변경은 ai-log usage.jsonl뿐이었다. 소스·수용 테스트·TODO 수정 없음. Master의 verdict 기록은 수행하지 않았다.

## 루브릭

| 항목 | 판정 | 근거 |
|---|---|---|
| 수용 테스트 통과 | O | acceptance.log: AC-1~5 모두 통과; npm-test.log: Node 47개, Python 10개 통과 |
| 시나리오 수행(정상·실패) | O | AC-6 HTTP 전 경로, 홈 렌더링, 차단 화면, 반복 빌드, 누락 파일 실패, 임시 파일 차단 |
| 증거 존재 | O | captures/의 테스트·HTTP·브라우저 로그 및 home.png, blocked.png |

## 시나리오별 결과

| 기준/시나리오 | 결과 | 증거(이 보고서 기준 상대 경로) |
|---|---|---|
| AC-1 허용 목록 31개 정확 일치·이전 잔여물 제거 | PASS | captures/acceptance.log |
| AC-2 내부 파일 및 테스트 제외 | PASS | captures/acceptance.log |
| AC-3 HTML/JS/CSS/manifest 참조 자산 존재 | PASS | captures/acceptance.log |
| AC-4 허용 파일 누락 시 실패 | PASS | captures/acceptance.log; 임시 복제에서 index.html을 제외하는 수용 테스트로 확인. 저장소 원본 삭제 없음 |
| AC-5 빌드·dev·dist 설정 | PASS | captures/acceptance.log |
| 전체 회귀 테스트 | PASS | captures/npm-test.log |
| 연속 npm run build | PASS | captures/build-first.log, captures/build-second.log. 잔여물 제거는 AC-1의 stale.md/lib/tiles.js 주입 시험으로도 확인 |
| 서버 실행 중 루트 qa-probe.md 추가 후 재빌드 | PASS | captures/probe-build.log, captures/probe-result.json, captures/probe.body. 404 본문 일치, 출력 31개 및 파일 해시 동일. 임시 파일 제거 완료 |
| AC-6 정상 자산·데이터 폴백 파일 | PASS | 아래 HTTP 표 및 captures/http-results.json |
| AC-6 차단 경로 본문 | PASS | 16개 모두 원본 404.html과 바이트 일치 |
| AC-6 vendor Cache-Control | PASS | captures/http-03.headers: public, max-age=86400 |
| AC-6 타일 Function 연결 | PASS | captures/http-25.headers, captures/http-25.body: 503, 정적 404 본문 아님 |
| AC-6 실제 홈 화면 | PASS | captures/home.png, captures/browser.log. 119/121곳 집계 목록·Leaflet 지도 컨트롤·원형 오버레이 표시. 키가 없어 배경 타일은 표시되지 않고 지도 오류 안내가 나타남(C-14 예상 상태) |
| AC-6 브라우저 오류 | PASS | captures/browser.log. 타일 요청 20개 503 외 콘솔 오류 없음, 홈 로컬 자산 404 없음. 공개 GitHub current.json GET 200 |
| 실패 URL 실제 화면 | PASS | captures/blocked.png, captures/browser.log. /qa-probe.md에서 '없는 주소입니다' 표시 |
| AC-7 운영 배포 후 확인·실제 CARTO 타일 성공 | 미실행 | C-14에 따라 이번 판정 범위 밖. 운영 검증이나 배포 완료를 뜻하지 않음 |

## AC-6 HTTP 전체 경로

상태 확인: `curl -s -o /dev/null -w '%{http_code}' http://localhost:8788<경로>`. 별도 GET으로 헤더·본문을 저장했다.

| 경로 | 기대 | 실제 | 404 본문 일치 | 증거 |
|---|---:|---:|---|---|
| `/` | 200 | 200 | 해당 없음 | captures/http-00.headers · captures/http-00.body |
| `/app.js` | 200 | 200 | 해당 없음 | captures/http-01.headers · captures/http-01.body |
| `/lib/layers.js` | 200 | 200 | 해당 없음 | captures/http-02.headers · captures/http-02.body |
| `/vendor/leaflet/leaflet.js` | 200 | 200 | 해당 없음 | captures/http-03.headers · captures/http-03.body |
| `/icons/icon.svg` | 200 | 200 | 해당 없음 | captures/http-04.headers · captures/http-04.body |
| `/data/current.json` | 200 | 200 | 해당 없음 | captures/http-05.headers · captures/http-05.body |
| `/manifest.webmanifest` | 200 | 200 | 해당 없음 | captures/http-06.headers · captures/http-06.body |
| `/robots.txt` | 200 | 200 | 해당 없음 | captures/http-07.headers · captures/http-07.body |
| `/data/grid.json` | 200 | 200 | 해당 없음 | captures/http-08.headers · captures/http-08.body |
| `/AGENTS.md` | 404 | 404 | O | captures/http-09.headers · captures/http-09.body |
| `/CLAUDE.md` | 404 | 404 | O | captures/http-10.headers · captures/http-10.body |
| `/README.md` | 404 | 404 | O | captures/http-11.headers · captures/http-11.body |
| `/ai-log/20260926/001_212957_pin-places/timeline.md` | 404 | 404 | O | captures/http-12.headers · captures/http-12.body |
| `/.crossgate/kit/VERSION` | 404 | 404 | O | captures/http-13.headers · captures/http-13.body |
| `/.agents/skills/ponytail/SKILL.md` | 404 | 404 | O | captures/http-14.headers · captures/http-14.body |
| `/.github/workflows/collect.yml` | 404 | 404 | O | captures/http-15.headers · captures/http-15.body |
| `/docs/INDEX.md` | 404 | 404 | O | captures/http-16.headers · captures/http-16.body |
| `/scripts/baseline.py` | 404 | 404 | O | captures/http-17.headers · captures/http-17.body |
| `/shared.test.js` | 404 | 404 | O | captures/http-18.headers · captures/http-18.body |
| `/lib/layers.test.js` | 404 | 404 | O | captures/http-19.headers · captures/http-19.body |
| `/package.json` | 404 | 404 | O | captures/http-20.headers · captures/http-20.body |
| `/wrangler.toml` | 404 | 404 | O | captures/http-21.headers · captures/http-21.body |
| `/places.json` | 404 | 404 | O | captures/http-22.headers · captures/http-22.body |
| `/lib/tiles.js` | 404 | 404 | O | captures/http-23.headers · captures/http-23.body |
| `/vendor/geist/GeistMono-Variable.woff2` | 404 | 404 | O | captures/http-24.headers · captures/http-24.body |
| `/tiles/light/12/3493/1586.png` | 503 | 503 | 해당 없음 | captures/http-25.headers · captures/http-25.body |

## 실행 및 종료

- `node --test tests/acceptance/*.test.js`: 종료 코드 0.
- `npm test`: 종료 코드 0.
- `npm run build && npx --no-install wrangler pages dev --port 8788`: 설치 방지 옵션만 추가. Wrangler 4.152.0, Worker 컴파일 및 헤더 규칙 2개 적용 확인(captures/server.log).
- 최초 sandbox의 브라우저 포트 열기 실패는 권한 확장 실행으로 해소했다. 최종 검증에 환경 차단 없음.
- 브라우저는 gstack browse 사용. 최종 증거는 captures/browser.log이며 페이지 로딩 후 #board li 표시를 기다렸다.
- captures/와 dist/는 git 제외 확인. 서버 종료 완료. 기존 usage.jsonl 변경 보존.

## 운영 확인 명령(미실행)

사용자가 배포한 뒤 아래 명령으로 위 표 경로를 운영 주소에서 반복한다. 타일은 로컬과 달리 성공 응답을 확인해야 한다.

```sh
python3 - <<'CHECK'
import json, subprocess
from pathlib import Path
rows=json.loads(Path('ai-log/20261023/001_164803_block-internal-files/03-qa/captures/http-results.json').read_text())
for row in rows:
    url='https://thanusual.pages.dev'+row['path']
    code=subprocess.check_output(['curl','-s','-o','/dev/null','-w','%{http_code}',url],text=True)
    print(row['path'], code, 'expected', 200 if row['path'].startswith('/tiles/') else row['expected'])
CHECK
curl -sS -D - -o /dev/null https://thanusual.pages.dev/vendor/leaflet/leaflet.js
curl -sS https://thanusual.pages.dev/AGENTS.md -o /tmp/thanusual-production-404.html
cmp 404.html /tmp/thanusual-production-404.html
```

결함: 없음. 배포 전 대시보드 빌드 명령 설정, 옛 배포 사본·검색 색인 처리는 사용자/Master 후속 범위다.

## 동시 작업 주의

최종 git status에서 CLAUDE.md, README.md, docs/인수인계.md의 외부 변경이 추가로 관찰됐다(captures/final-status.log). QA는 이 파일들을 수정하지 않았으며 해당 문서 변경은 검수 범위가 아니다. 위 판정은 명시한 커밋의 구현에 대한 결과이고, Master는 새 변경을 커밋한 상태에서 버전 고정 규칙에 맞춰 verdict를 기록해야 한다.
