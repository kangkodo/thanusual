# 개발 TODO — PostHog 기록 추가

문구는 기획만, 체크와 완료 근거는 개발만 바꾼다.

## 배경 사실 (기획 단계에서 확인함)

- 아래 초기화 설정은 2026-10-03에 저장소 밖 임시 폴더에서 실제 SDK(posthog-js 1.435.7, 공식 로더)로 확인했다. 전송 요청은 전부 가로채 실제로는 보내지 않았다. 결과: 첫 `$pageview`에 `service`가 붙는다. `/?email=..&x=1#p=..`로 열어도 주소 값은 `…/`로 나간다. 버튼·링크 클릭, 입력, 페이지 이탈로는 아무 이벤트도 나가지 않는다. 잡히지 않은 오류는 `$exception`으로 나가고 `service`가 붙는다. 쿠키는 그 호스트에만 생긴다. `/flags` 요청은 없다.
- 공식 로더는 `array.js`가 오기 전의 호출을 `window.posthog` 배열에 `["capture", "core_action", {...}]` 꼴로 쌓아 둔다. 초기화 인자는 `window.posthog._i[0]`(`[키, 설정, 이름]`)에 있다. `array.js`를 못 받으면 그 상태로 남고 앱에는 영향이 없다.
- posthog-js는 봇으로 보이는 브라우저의 이벤트를 조용히 버린다. 헤드리스 Chromium은 `navigator.userAgentData`의 `HeadlessChrome` 때문에 걸린다. 실제 SDK 검증(Master) 때만 해당하고 코드에서 대응하지 않는다.
- `*.localhost`(예: `thanusual.localhost`)는 Chromium에서 내 컴퓨터로 풀리고, R-14의 로컬 목록(`localhost`·`127.0.0.1`·`[::1]`)에는 없다. QA가 로컬 서버를 "로컬이 아닌 호스트"로 열 때 쓴다.
- `select(`를 부르는 곳(검색어 `select(`, `app.js`): 목록 행 클릭(`bindBoard`), 닫기(`renderDetail`의 `close.onclick`, `null`), 「가까운 다른 장소」(`renderDetail`의 `btn.onclick`), 지도 선택 콜백(`setMapPickHandler`).
- `state.selected`에 직접 쓰는 곳(검색어 `state.selected =`): `app.js` `select`, `app.js` `readHash`(주소 복원), `map.js` `pick`(지도 점·핀 클릭. 콜백보다 **먼저** 덮어쓴다).

## 상태 계약

### PostHog를 불러오는 조건 (R-1, R-14)

| 조건 | 결과 |
|---|---|
| 공개 키가 빈 문자열 | 불러오지 않는다. `window.posthog`도 만들지 않는다 |
| `location.hostname`이 `localhost`, `127.0.0.1`, `[::1]` 중 하나 | 위와 같다 |
| `navigator.cookieEnabled === false` | 위와 같다 |
| 그 밖(운영, `*.thanusual.pages.dev` 미리보기, 다른 도메인, `*.localhost`) | 공식 로더로 불러오고 한 번 초기화한다 |

### 초기화 설정 (R-2, R-3, R-4, R-7, R-15)

```js
posthog.init("phc_mQeQSaqnyCxjKEhcmXyqES8kyFge6tQDm7cUdTe8MkHu", {
  api_host: "https://us.i.posthog.com",
  ui_host: "https://us.posthog.com",
  capture_pageview: true,          // 불러올 때 1회. defaults 날짜를 주지 않는다(주면 주소 변경마다 페이지뷰가 나갈 수 있다)
  capture_pageleave: false,
  autocapture: false,
  capture_dead_clicks: false,
  capture_heatmaps: false,
  capture_performance: false,
  disable_session_recording: true,
  disable_surveys: true,
  capture_exceptions: true,        // PostHog 기본 범위: 잡히지 않은 오류, 거부된 Promise
  cross_subdomain_cookie: false,
  before_send: /* 아래 "주소 자르기" */,
  loaded: (ph) => ph.register({ service: "thanusual" }),
});
```

- `persistence`, `person_profiles`는 적지 않는다(기본 `localStorage+cookie`, `identified_only`).
- `identify`, `alias`, `group`, `setPersonProperties`를 부르지 않는다.

### 주소 자르기 (R-15)

`before_send(event)`는 `event.properties`, `event.$set`, `event.$set_once` 안의 모든 깊이(객체·배열)에서, `http://` 또는 `https://`로 시작하는 문자열 값을 첫 `?` 또는 `#` 앞까지로 자르고 `event`를 돌려준다. 그 밖의 값(주소가 아닌 문자열, 오류 메시지, `$pathname`, 숫자 등)은 그대로 둔다. `event`가 `null`이거나 `properties`가 없어도 예외 없이 그대로 돌려준다. 이벤트를 버리지 않는다(`null`을 만들어 돌려주지 않는다).

### `place_open` (R-5, R-6)

"이전 선택"은 그 행동 직전에 열려 있던 장소(`state.selected`)다.

| 행동 | 조건 | `core_action` |
|---|---|---|
| 목록 행(순위 목록, 「고정한 장소」)을 클릭·탭·Enter·Space로 고름 | 이전 선택과 다른 장소 | 1건 |
| 지도의 점·핀을 고름 | 이전 선택과 다른 장소 | 1건 |
| 상세의 「가까운 다른 장소」를 고름 | 이전 선택과 다른 장소(항상 다르다) | 1건 |
| 위 셋 중 하나 | 이전 선택과 같은 장소(이미 열려 있음. 주소로 복원된 장소 포함) | 없음 |
| 닫기 뒤 같은 장소를 다시 고름 | 이전 선택이 없음 | 1건 |
| 첫 로드의 `#p=` 복원, `hashchange` 복원 | | 없음 |
| 자동 새로고침, 다시 그리기, ☆ 고정·해제, 닫기, 분류 탭, 검색, 시간 모드, 레이어, 시트 손잡이 | | 없음 |

- 이벤트는 `posthog.capture("core_action", { action: "place_open" })` 한 가지다. 장소 이름 등 다른 속성을 넣지 않는다.
- `window.posthog`가 없으면(R-14) 아무 일도 하지 않고 예외도 없다. 장소 선택·상세·지도 이동은 지금과 똑같다.
- `array.js`가 아직 안 왔으면 공식 로더의 대기열에 쌓인다. 따로 대기열을 만들지 않는다.

### 쿠키 고지와 footer (R-9)

- `index.html`의 `<details class="sources">` 제목은 정확히 `데이터 출처와 한계 · 쿠키 안내`다.
- 그 안의 기존 출처 문단은 그대로 두고, 그 뒤에 새 `<p>`로 다음 문구를 그대로 넣는다: `이 서비스는 이용 통계를 위해 쿠키를 사용합니다. 모으는 것은 익명 이용 기록뿐이며, 이메일·이름·전화번호·입력 내용 같은 개인정보는 모으지 않습니다. 통계 도구는 PostHog(해외 서버)입니다. 원하지 않으면 브라우저 설정에서 쿠키를 차단할 수 있습니다.`
- 데스크톱 배치는 지금과 같다.
- 폰(`max-width: 47.99rem`): 시트를 접은 상태에서는 footer가 지금처럼 보이지 않는다. 시트를 펼치면(`body.map-sheet-open`) 목록 아래, 시트 맨 아래에 footer가 보인다. 안내를 펼쳐도 시트 밖으로 넘치지 않고(넘치면 footer 안에서 스크롤), 다시 접을 수 있고, 가로 스크롤이 생기지 않는다. `.masthead`는 지금처럼 폰에서 숨긴다.
- `404.html`에는 고지를 넣지 않는다.
- 색·간격은 `styles.css`의 토큰만 쓴다(원시 hex 금지, `CLAUDE.md` Design).

## TODO

- [ ] DEV-001 저장소 루트에 `analytics.js`를 만든다. 일반 스크립트다(`import`/`export` 없음, 전역 `window`·`document`·`location`·`navigator`만 쓴다). "PostHog를 불러오는 조건"을 통과하면 PostHog 공식 로더(아래 "공식 로더")를 고치지 않고 그대로 실행하고, "초기화 설정"대로 `posthog.init`을 한 번 부른다. 공개 키는 이 파일에 문자열로 한 번만 적는다. "주소 자르기"를 `before_send`로 건다.
  확인 방법: AC-1~AC-9
- [ ] DEV-002 `index.html`과 `404.html`에서 `analytics.js`를 불러온다. `index.html`은 `<script defer src="./analytics.js"></script>`를 Leaflet 스크립트 앞에, `404.html`은 `<script defer src="/analytics.js"></script>`를 `</body>` 앞에 둔다(404는 어떤 깊이의 주소에서도 뜨므로 절대 경로).
  확인 방법: AC-11, QA-1, QA-2, QA-7
- [ ] DEV-003 `lib/track.js`를 만든다. `export function trackPlaceOpen(prev, next, posthog = globalThis.posthog)`: `next`가 비어 있지 않고 `prev`와 다를 때만 `posthog.capture("core_action", { action: "place_open" })`를 한 번 부른다. `posthog`가 없으면 아무 일도 하지 않는다.
  확인 방법: AC-10
- [ ] DEV-004 "`place_open`" 표대로 `trackPlaceOpen`을 건다. 대상은 배경 사실의 `select(` 호출 네 곳 중 사용자가 장소를 고르는 세 곳(목록 행, 「가까운 다른 장소」, 지도 선택)이다. `prev`는 그 행동 직전의 `state.selected`여야 한다. 지도 선택은 `map.js` `pick`이 콜백보다 먼저 `state.selected`를 덮어쓰므로, 덮어쓰기 전 값을 쓸 수 있게 고친다(권장, 강제 아님: `pick`이 고른 이름을 콜백 인자로 넘기고 `select` 안에서 `state.selected`를 바꾸기 전에 `trackPlaceOpen(state.selected, name)`을 부른다). `readHash`와 `load`, `hashchange` 경로에는 걸지 않는다. 지도 선택 뒤의 기존 동작(선택 표시, 목록 행으로 스크롤·포커스, 지도는 다시 가운데로 옮기지 않음)은 그대로다.
  확인 방법: QA-2, QA-3, QA-4, QA-8
- [ ] DEV-005 `index.html`의 `<details class="sources">`에 "쿠키 고지와 footer"대로 제목을 바꾸고 고지 문단을 넣는다.
  확인 방법: AC-11, QA-5
- [ ] DEV-006 `styles.css` 폰 미디어 블록에서 "쿠키 고지와 footer"의 폰 계약대로 footer를 보이게 한다.
  확인 방법: QA-5, QA-6
- [ ] DEV-007 `npm test`와 `node --test tests/acceptance/*.test.js`가 통과한다. 금지 경로(`.crossgate/config.json`의 `forbidden`)와 보호 경로를 건드리지 않는다. 새 의존성을 추가하지 않는다.
  확인 방법: gate

### 공식 로더 (PostHog 문서의 HTML 스니펫, 2026-10-03 확인. 그대로 쓴다)

```js
!function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],Object.defineProperty(u,"toString",{configurable:!0,enumerable:!0,writable:!0,value:function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e}}),Object.defineProperty(u.people,"toString",{configurable:!0,enumerable:!0,writable:!0,value:function(){return u.toString(1)+".people (stub)"}}),o="init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagResult isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
```

## 수용 기준

자동 기준은 `tests/acceptance/analytics.test.js`에 있다(기획 단계에서 작성, 임시 구현으로 11개 통과를 확인함).

| ID | 기준 | 확인 방식 |
|---|---|---|
| AC-1 | 공개 호스트(운영, 미리보기, 다른 도메인)에서 공식 로더가 `https://us-assets.i.posthog.com/static/array.js`를 요청하고, 프로젝트 키와 `api_host`·`ui_host`로 초기화가 한 번 대기열에 들어간다 | 자동 |
| AC-2 | 초기화 설정이 "초기화 설정"과 같다: `$pageview`는 로드 시 1회, 오류 기록 켬, 그 밖의 자동 수집 전부 끔, `defaults` 없음 | 자동 |
| AC-3 | `loaded` 콜백이 `service: "thanusual"`을 전역 속성으로 등록한다 | 자동 |
| AC-4 | 로드 시점에 방문자 식별 호출과 `capture` 호출이 없다 | 자동 |
| AC-5 | `before_send`가 모든 깊이의 주소 값에서 `?`·`#` 뒤를 자르고 나머지(404 경로, 오류 메시지, `$direct`)는 그대로 둔다 | 자동 |
| AC-6 | `before_send`가 `properties` 없는 이벤트와 `null`에서 예외 없이 그대로 돌려준다 | 자동 |
| AC-7 | `localhost`·`127.0.0.1`·`[::1]`에서는 PostHog를 불러오지 않는다 | 자동 |
| AC-8 | 쿠키가 차단된 브라우저에서는 불러오지 않는다 | 자동 |
| AC-9 | 공개 키가 비면 불러오지 않는다 | 자동 |
| AC-10 | `trackPlaceOpen`은 장소가 바뀔 때만 `core_action`(`action=place_open`) 1건을 부르고, PostHog가 없으면 조용히 넘어간다 | 자동 |
| AC-11 | 두 페이지가 `analytics.js`를 불러오고, 고지 문구와 새 제목이 `index.html`의 접힌 안내 안에만 있고, 저장소 파일에 `phx_`가 없다 | 자동 |
| QA-1 | 로컬 주소(`http://127.0.0.1:<포트>/`)로 열면 PostHog 호스트로 가는 요청이 0건이고 `window.posthog`가 없다. 장소 선택·상세·닫기·고정·검색이 지금과 같이 동작하고 `pageerror`가 0건이다 | 관찰: 요청 로그, 캡처 |
| QA-2 | 로컬이 아닌 호스트(`http://thanusual.localhost:<포트>/`)에서 PostHog 호스트 요청을 모두 실패시킨 상태로 연다. 로더 대기열(`window.posthog._i[0]`)에 초기화가 있고, 목록 행 클릭 → `["capture","core_action",{"action":"place_open"}]` 1건, 같은 행 다시 클릭 → 그대로, 「가까운 다른 장소」 → +1, 지도 점·핀으로 다른 장소 → +1, 닫기 → 그대로, 닫은 뒤 같은 장소 다시 → +1. 「고정한 장소」 행으로 다른 장소 → +1. 그동안 앱 동작은 QA-1과 같고 `pageerror`가 0건이다 | 관찰: 단계별 대기열 덤프 |
| QA-3 | QA-2와 같은 환경에서 `/#p=<장소 이름>`으로 연다. 상세가 복원되고 `capture`는 0건이다. 그 장소의 행을 눌러도 0건이다. 주소의 `#p=`를 다른 장소로 바꿔 `hashchange`를 일으켜도 0건이다. 탭이 다시 보이게 해 새로고침(`visibilitychange`)을 일으켜도 0건이다. ☆, 분류 탭, 검색 입력, 시간 모드, 레이어, 시트 손잡이를 조작해도 0건이다 | 관찰: 대기열 덤프 |
| QA-4 | 키보드: 행 버튼에 포커스를 두고 Enter, 다른 행에서 Space → 각각 +1 | 관찰 |
| QA-5 | 데스크톱(1280×800, 라이트·다크): 접힌 안내 제목이 「데이터 출처와 한계 · 쿠키 안내」이고, 펼치면 기존 출처 문단 뒤에 고지 문단이 보인다. 레일의 다른 배치는 변경 전과 같다 | 관찰: 캡처(전·후) |
| QA-6 | 폰(375×812, 라이트·다크): 시트를 접으면 footer가 보이지 않는다(변경 전과 같음). 시트를 펼치면 맨 아래에 접힌 안내 한 줄이 보이고 목록은 그 위에서 스크롤된다. 안내를 펼치면 고지가 읽히고, 시트 밖으로 넘치지 않고, 다시 접을 수 있고, 가로 스크롤이 없다. 작은 화면(320×568)에서도 같다 | 관찰: 캡처 |
| QA-7 | `404.html`: 로컬이 아닌 호스트에서 로더 대기열에 초기화가 있고, 로컬 주소에서는 PostHog가 없다. 화면에 쿠키 문구가 없고 모양이 변경 전과 같다 | 관찰 |
| QA-8 | 회귀: 지도에서 장소를 골랐을 때 선택 표시, 목록 행 스크롤·포커스, 주소의 `#p=` 갱신이 변경 전과 같다. 시간 모드 넷과 고정 목록이 동작한다 | 관찰 |
| S-1 | (Master, 실제 SDK) `thanusual.localhost`에서 SDK 다운로드만 허용하고 `us.i.posthog.com` 요청을 전부 가로챈다. `/?email=a@b.c#p=<장소>`로 열면 첫 이벤트가 `$pageview`이고 `service=thanusual`이며, 가로챈 본문 전체에 `email`, `a@b.c`, 장소 이름, `p=`가 없다 | 관찰: 가로챈 본문 |
| S-2 | (Master) 장소를 고르면 `core_action`(`action=place_open`, `service=thanusual`)이 QA-2의 건수대로 나간다. 속성에 장소 이름이 없다 | 관찰 |
| S-3 | (Master) 클릭·입력·검색·페이지 이탈을 해도 `$pageview`, `core_action`, `$exception` 외의 이벤트 이름이 0건이고 `/flags`·녹화 요청이 없다. 검색어가 어떤 본문에도 없다 | 관찰 |
| S-4 | (Master) 잡히지 않은 오류를 일으키면 `$exception`이 `service=thanusual`과 함께 나간다 | 관찰 |
| S-5 | (Master) SDK는 받았지만 전송 요청이 모두 실패하는 상태, 그리고 SDK 다운로드가 실패하는 상태에서 앱이 QA-1과 같이 동작하고 `pageerror`가 0건이다(브라우저의 네트워크 진단 줄은 허용). 쿠키는 그 호스트에만 생긴다 | 관찰 |

## 영향 문서

- `docs/인수인계.md`: 세 절 갱신(제목 유지). "다음 할 일" 맨 위에 배포 전 운영자 확인 조건(IP 저장 끄기, 과금 없는 한도 정지), 그 아래 배포 뒤 숫자 확인 방법.
- `docs/숫자-기록.md` "평소보다" 절: 요구사항 목록을 실제로 들어간 동작으로 고친다(로컬·쿠키 차단 시 불러오지 않음, 주소 자르기, 자동 수집 끔, 재선택은 세지 않음, 고지 위치·제목, 404에는 고지 없음). 1~3장(jelly-studio 약속 사본)은 건드리지 않는다.
- `CLAUDE.md`: 기록(PostHog) 단락을 추가한다. Design의 "No Google Fonts or other CDN assets" 옆에 PostHog 로더가 유일한 예외임을 적는다. 첫 화면 설명에 폰에서도 시트를 펼치면 footer가 보인다는 사실이 필요한지 확인한다.
- `AGENTS.md`: `CLAUDE.md`와 겹치는 내용이 있으면 같은 사실을 맞춘다.
- `docs/crossgate-pilot.md` "실행 기록": 이번 실행 한 줄.
- `docs/INDEX.md`: 없으면 만든다(등록 문서 셋이 추가됐다). `docs/` 아래 문서마다 경로와 한 줄 설명.
- `README.md`: 확인 뒤 필요하면 통계·쿠키 한 줄. 필요 없으면 이유를 적는다.
- 등록 문서 검수(R-13): `docs/숫자-기록.md`, `docs/인수인계.md`, `docs/아이디어.md`, `CLAUDE.md`·`AGENTS.md`의 jelly-studio 절을 Wiki 검수 대상에 넣는다.

## 하지 않을 일

- 배포, PostHog 프로젝트·결제 설정 변경
- 동의 배너, 수집 거부 버튼, 개인정보 처리방침 페이지
- `identify`, 추가 이벤트·속성(장소 이름 포함), 세션 녹화·히트맵·설문·기능 플래그
- PostHog 스크립트 자체 호스팅·프록시, 로더 버전 고정
- 헤드리스·봇 판별 우회 코드
- 금지 경로(`_headers`, `functions/*`, `package.json`, `wrangler.toml`, `lib/tiles.js` 등) 수정, 새 의존성
- `*.localhost`를 로컬 목록에 넣는 일(사용자 결정은 세 주소다)
