판정: PASSED

독립 QA 1회차. 차단 결함 0건, 미수행 0건. 수용 테스트 AC-1~7 및 브라우저 시나리오 QA-1~10 통과.

## 검증 대상과 환경

- 브랜치: `pipe/pin-places`
- 커밋: `e1e272eec435a36e16ea584227eafbb940ec5b4f` (`pipeline: dev approved, QA task 1`)
- 검증일: 2026-09-26 KST
- 시작 시 작업 트리는 깨끗했으며, 종료 시 소스·수용 테스트·TODO 변경 없음. 이번 산출물은 `03-qa/` 안에만 저장했다.
- 서버: 저장소 루트에서 `python3 -m http.server 8788 --bind 127.0.0.1`, URL `http://127.0.0.1:8788/`.
- Node `v22.23.1`, 설치되어 있던 Playwright의 Chromium `145.0.7632.6`. 패키지 설치 없음.
- gstack `/browse`는 로컬 페이지 접근에 성공했지만 다음 호출에서 새 브라우저로 초기화됐다. 시나리오 실행에는 지시에서 허용한 기존 Playwright를 사용했다.
- 외부 데이터 요청을 브라우저에서 차단하여 실제 앱의 `./data/current.json` 대체 경로를 사용했다. 원본은 121곳 모두 `fresh`, `generated_at=2026-09-03 01:46:07`. 이 오래된 로컬 자료는 UI 검증용이며 최신 서울시 데이터 검증이 아니다.
- 지도 타일 404와 그 안내 문구는 지정된 Python 서버의 예상 동작이며 이번 범위에서 제외했다. 지도 선택·이동은 로컬 Leaflet 화면에서 확인했다.
- 브라우저 오류 이벤트(`pageerror`) 0건. [실행 로그](captures/QA-browser.log), [시나리오 결과](captures/QA-results.json), [검증 스크립트](captures/QA-runner.mjs).

## 루브릭

| 항목 | 판정 | 근거 |
|---|---|---|
| 수용 테스트 통과 | O | 지정 명령 종료 코드 0, 7개 통과, 실패·건너뜀 0개 |
| 시나리오 수행: 정상·실패 흐름 | O | QA-1~10 순서대로 실행. 결과 없음 검색, 저장소 예외, 자료 누락 포함 |
| 증거 존재: 캡처·로그 | O | 각 QA의 PNG·JSON, 전체 실행 로그, 수용 테스트 로그 저장. 파일 목록·SHA-256은 `captures/QA-manifest.json` |

## 수용 테스트

명령: `node --test tests/acceptance/*.test.js`

증거: [QA-acceptance.log](captures/QA-acceptance.log)

| 기준 | 결과 | 확인한 항목 |
|---|---|---|
| AC-1 | 통과 | 추가·해제 및 입력 Set 불변 |
| AC-2 | 통과 | 지정 키의 저장·읽기 왕복 |
| AC-3 | 통과 | 저장소 부재·예외 처리 |
| AC-4 | 통과 | 손상된 JSON·배열 아닌 값·문자열 아닌 원소 처리 |
| AC-5 | 통과 | 없는 이름 무시, non-fresh·누락 장소의 자료 없음 행 및 이름순 |
| AC-6 | 통과 | warming 전·후 아래 목록과 동일한 정렬 |
| AC-7 | 통과 | 일부 스냅숏에서도 원본 기준 소속 유지, 빈 원본·스냅숏 처리 |

## 화면 시나리오

| ID | 결과 | 수행·관찰 | 증거 |
|---|---|---|---|
| QA-1 | 통과 | 빈 브라우저 저장소로 첫 방문. 고정 행 0개, `#pinned` 숨김 | [로그](captures/QA-1.json), [화면](captures/QA-1-empty.png) |
| QA-2 | 통과 | DDP 고정 후 공원 탭 → `한강` 검색 → 존재하지 않는 이름 검색. 아래 목록 0개에서도 고정 1개 유지 | [로그](captures/QA-2.json), [공원](captures/QA-2-park.png), [검색 0개](captures/QA-2-zero-search.png) |
| QA-3 | 통과 | 순위 1·51·121위 고정 후 일부 해제. 아래 121개 행의 이름·순위 배열이 최초와 완전히 동일 | [전후 배열](captures/QA-3.json), [화면](captures/QA-3-rank.png) |
| QA-4 | 통과 | 두 구역의 별 클릭 시 선택·URL 해시·지도 변환 불변. 행 본문 클릭 시 대림역 선택·상세 표시·해시 변경·해당 위치 확대 | [로그](captures/QA-4.json), [선택·지도 화면](captures/QA-4-row-selected.png) |
| QA-5 | 통과 | Tab·Enter·Space로 아래 목록 고정·해제 및 고정 구역 해제. `aria-pressed`/장소 포함 이름 확인. 같은 버튼 유지 → 다른 구역의 같은 버튼 → 같은 구역 인접 버튼 → `#q` 대체를 확인 | [로그](captures/QA-5.json), [검색 포커스](captures/QA-5-focus-search.png), [인접 버튼 로그](captures/QA-5-nearest.json), [인접 버튼 포커스](captures/QA-5-nearest-remaining-pin-focus.png) |
| QA-6 | 통과 | 고정 후 실제 reload로 유지 확인. 초기화 스크립트에서 `Storage.prototype.getItem/setItem`을 SecurityError로 바꾼 뒤 reload. 목록 표시·고정·필터 유지·해제 성공. `window.localStorage` 접근 자체가 예외인 경우도 성공 | [로그](captures/QA-6.json), [새로고침 유지](captures/QA-6-persist.png), [저장소 차단](captures/QA-6-blocked-storage.png) |
| QA-7 | 통과 | 상세에서 고정 → 고정 구역에서 해제 → 아래 목록에서 고정 → 상세에서 해제. 세 버튼의 상태 동기화, 선택한 장소 유지 | [로그](captures/QA-7.json), [화면](captures/QA-7-detail-sync.png) |
| QA-8 | 통과 | 375×812·1280×800, 1곳·121곳, light·dark 조합 모두 두 목록의 마지막 행까지 마우스 휠로 도달. 수평 넘침 없음, 고정 버튼 44×44px. 휴대폰 목록 열기·닫기 및 행 선택 시 접힘 확인 | [치수·스크롤·색상 로그](captures/QA-8.json), 아래 캡처 표 |
| QA-9 | 통과 | Tab으로 고정 구역·아래 목록·상세의 별 버튼 및 두 구역의 행 버튼에 포커스. 수동 render 후 같은 구역·장소·종류로 복원됨. 이전 DOM 노드가 실제로 분리됐음도 확인 | [전후 포커스 로그](captures/QA-9.json), [화면](captures/QA-9-render-focus.png) |
| QA-10 | 통과 | 과거·예측에서 관측·예측 없는 DDP, 평소에서 non-fresh 가락시장이 자료 없음 행으로 남음. 매 모드에서 최근 집계로 돌아오면 DDP 최신 값 1,750 복귀, 고정 3곳 유지 | [로그](captures/QA-10.json), [과거](captures/QA-10-history.png), [예측](captures/QA-10-forecast.png), [평소](captures/QA-10-usual.png), [복귀](captures/QA-10-restored.png) |

QA-5 추가 확인: 공원 탭에서 아래 목록에 없는 대림역·DDP를 고정한 뒤 대림역을 Space로 해제하면 같은 고정 구역의 DDP 별 버튼으로 이동했다. 이어 Enter로 마지막 DDP를 해제하면 `#q`로 이동했다. [추가 실행 스크립트](captures/QA-supplement.mjs), [로그](captures/QA-supplement.log).

QA-9는 지시에서 허용한 수동 render 방식이다. 포커스를 움직이지 않고 `#time-slider`에 `input` 이벤트를 전달해 앱의 기존 render 경로를 실행했다. 5분 경과를 기다리는 자동 갱신은 별도로 수행하지 않았다.

QA-10은 누락 상태를 재현하기 위해 브라우저 응답만 주입했다. 저장소 파일은 변경하지 않았다. 로컬 원본에서 DDP의 예측을 제거하고 가락시장을 stale로 설정했으며, 과거 프레임은 DMC 관측만 포함했다. DDP·DMC는 버튼으로 고정했고, 아래 목록에 없는 stale 가락시장은 저장소에 미리 고정된 상태로 넣고 reload했다. 입력과 이름은 [fixture 설명](captures/QA-10-fixture.json), 전체 재현 코드는 [검증 스크립트](captures/QA-runner.mjs)에 있다. 실제 외부 과거 데이터 공급 여부는 이 판정의 대상이 아니다.

### QA-8 캡처

모든 행의 마지막 장소는 `노들섬`. 1곳 고정 상태의 고정 구역 마지막 장소는 `대림역`. 121곳 고정은 저장소 일괄 주입 없이 아래 목록의 별 버튼을 121개 클릭했다.

| 화면·고정 수 | light: 고정 구역 끝 / 아래 목록 끝 | dark: 고정 구역 끝 / 아래 목록 끝 |
|---|---|---|
| 375×812 · 1곳 | [고정](captures/QA-8-375-1-light-pinned-list-end.png) / [목록](captures/QA-8-375-1-light-board-end.png) | [고정](captures/QA-8-375-1-dark-pinned-list-end.png) / [목록](captures/QA-8-375-1-dark-board-end.png) |
| 375×812 · 121곳 | [고정](captures/QA-8-375-121-light-pinned-list-end.png) / [목록](captures/QA-8-375-121-light-board-end.png) | [고정](captures/QA-8-375-121-dark-pinned-list-end.png) / [목록](captures/QA-8-375-121-dark-board-end.png) |
| 1280×800 · 1곳 | [고정](captures/QA-8-1280-1-light-pinned-list-end.png) / [목록](captures/QA-8-1280-1-light-board-end.png) | [고정](captures/QA-8-1280-1-dark-pinned-list-end.png) / [목록](captures/QA-8-1280-1-dark-board-end.png) |
| 1280×800 · 121곳 | [고정](captures/QA-8-1280-121-light-pinned-list-end.png) / [목록](captures/QA-8-1280-121-light-board-end.png) | [고정](captures/QA-8-1280-121-dark-pinned-list-end.png) / [목록](captures/QA-8-1280-121-dark-board-end.png) |

다크 모드는 실제 `prefers-color-scheme: dark` 에뮬레이션으로 확인했다. 별 버튼의 계산된 색은 light `rgb(23, 23, 23)`, dark `rgb(237, 237, 237)`이며 캡처에서 ☆/★를 구분할 수 있다.

## 결함 및 기록 경계

- 차단 결함: 없음. Q-n 발급 없음.
- 미수행·미검증 수용 항목: 없음.
- 소스 코드·수용 테스트·TODO·판정 레코드 수정 없음. 커밋·병합·배포 없음.
- 이 문서는 독립 QA 결과다. Master의 증거 표본 확인과 `pipeline verdict` 기록은 수행하지 않았다.
- `captures/`는 `git check-ignore`로 제외 상태를 확인했다.
