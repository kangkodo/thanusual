# 요청 명세

등급: 무거움 · 근거: 새 기능 추가이고 외부 시스템(PostHog)으로 데이터를 보내며 쿠키·개인정보 약속이 걸려 있다 · 사용자 확정: 2026-10-03

## 사용자 목표
평소보다(jelly-studio 서비스 id `thanusual`)에 PostHog 이벤트 기록을 넣는다. jelly-studio의 공통 이벤트 계약을 지키고, 배포 뒤 jelly-studio에서 `python3 bin/jelly resume thanusual`을 돌리면 방문자 수가 0보다 크게 나온다. 등록 문서(`jelly/register` 브랜치)도 같은 실행에서 검수받아 `main`에 들어간다.

## 조사한 사실
- 계약: `../../jelly-studio/docs/contracts.md` 2장, 사본 `docs/숫자-기록.md`. 이 서비스 요구사항은 `docs/숫자-기록.md` "평소보다" 절.
- 페이지는 `index.html`, `404.html` 둘이다. 지금은 인라인 스크립트도 외부 스크립트도 없다(`vendor/leaflet/leaflet.js`와 모듈 `app.js`뿐).
- `_headers`는 캐시 설정뿐이라 외부 스크립트를 막지 않는다(금지 경로, 수정 불필요).
- 장소 선택은 `app.js`의 `select(name, focus)`가 맡는다. 부르는 곳: 목록 행 클릭(`bindBoard`, 순위 목록과 「고정한 장소」 둘 다, 행은 `<button>`이라 키보드 Enter·Space도 클릭이다), 상세의 「가까운 다른 장소」 버튼, 지도 점·핀 클릭(`map.js`의 `pick`이 `state.selected`를 먼저 바꾸고 `setMapPickHandler` 콜백이 `select`를 부른다), 닫기(`select(null)`).
- 주소로 복원되는 선택은 `readHash()`가 `state.selected`를 직접 바꾼다(`select`를 거치지 않는다). 첫 로드(`load()`)와 `hashchange`에서 불린다. `select`는 `history.replaceState`로 `#p=<장소 이름>`을 쓰므로 앱 안 선택으로는 `hashchange`가 나지 않는다.
- 5분 자동 새로고침(`load()` → `render()`)은 `select`를 부르지 않는다.
- 검색어(`#q`)는 `state.q`에만 있고 주소에 들어가지 않는다. 주소에 들어가는 것은 장소 이름(`#p=`)뿐이다.
- 폰 화면(`max-width: 47.99rem`)에서는 `.foot`가 `display: none`이다(`styles.css` 폰 미디어 블록). 즉 「데이터 출처와 한계」 footer는 데스크톱에서만 보인다. footer 안 내용은 접힌 `<details class="sources">`다.
- `404.html`에는 footer가 없다(제목, 한 문장, 첫 화면 링크).
- jelly-studio는 `https://us.posthog.com`의 조회 API로 `properties.service`별 `count()`와 `count(DISTINCT person_id)`를 읽는다(`jelly/posthog.py`). `$pageview`의 고유 사용자가 방문자 수다.
- PostHog 공식 문서(2026-10-03 확인): US 클라우드의 수집 주소는 `https://us.i.posthog.com`이고 공식 로더는 그 주소에서 `https://us-assets.i.posthog.com/static/array.js`를 불러온다. `us.posthog.com`은 화면·조회 주소다. 기본 설정은 클릭 자동 수집(`autocapture`), `$pageleave`, 세션 녹화(프로젝트에서 켜면), 설문, 죽은 클릭 수집이 켜져 있다. 저장은 기본 `localStorage+cookie`, 프로필은 기본 `identified_only`.

## 확정 요구사항
- R-1: `index.html`, `404.html` 모두 PostHog 공식 로더로 PostHog를 불러온다. 프로젝트 공개 키는 `phc_mQeQSaqnyCxjKEhcmXyqES8kyFge6tQDm7cUdTe8MkHu`, 수집 주소는 `https://us.i.posthog.com`(화면 주소 `https://us.posthog.com`). 공개 키가 비어 있으면 PostHog를 불러오지 않는다.
- R-2: 모든 이벤트에 `service` = `thanusual`이 붙는다. 전역 속성으로 등록하고, 페이지를 연 뒤 첫 `$pageview`와 `$exception`에도 빠지지 않는다.
- R-3: 보내는 이벤트는 `$pageview`, `core_action`(`action` = `place_open`), `$exception` 셋뿐이다. PostHog의 다른 자동 수집(클릭 자동 수집, `$pageleave`, 세션 녹화, 설문, 히트맵, 죽은 클릭, 성능 지표)은 끈다.
- R-4: `$pageview`는 PostHog 자동 수집으로 페이지를 불러올 때 한 번 나간다. 장소 선택으로 주소의 `#p=`가 바뀌는 것은 페이지뷰가 아니다.
- R-5: `core_action`(`action=place_open`)은 사용자가 앱 안에서 장소 하나를 골라 자세히 볼 때만 보낸다: 목록 행(순위 목록, 「고정한 장소」)을 누르기·클릭·키보드로 고를 때, 지도의 점·핀을 고를 때, 상세의 「가까운 다른 장소」를 고를 때. 속성은 `service`, `action`뿐이다.
- R-6: 다음에는 `core_action`을 보내지 않는다: 공유 링크로 처음 열릴 때 복원되는 장소, 주소 변경(`hashchange`)으로 복원되는 장소, 자동 새로고침과 그 밖의 다시 그리기, ☆ 고정·해제, 닫기, 분류 탭·검색·시간 모드·레이어 조작.
- R-7: 오류 기록(`$exception`)을 켠다. 범위는 PostHog 기본(잡히지 않은 오류와 거부된 Promise)이다.
- R-8: 개인정보(이메일, 이름, 전화번호, 입력 원문)를 어떤 속성에도 넣지 않는다. 검색어를 이벤트에 넣지 않는다. `identify`를 부르지 않는다. `signup`·`purchase`·`ai_cost`는 보내지 않는다.
- R-9: 쿠키 고지를 화면 하단의 기존 안내(「데이터 출처와 한계」가 있는 footer) 안에 덧붙인다. 새 페이지를 만들지 않는다. 내용은 네 가지를 담는다: 이용 통계를 위해 쿠키를 쓴다, 모으는 것은 익명 이용 기록이고 개인정보는 모으지 않는다, 통계 도구는 PostHog(해외 서버)다, 거부는 브라우저에서 쿠키를 차단하면 된다.
- R-10: PostHog를 못 불러와도(차단, 네트워크 실패, 키 없음) 앱은 지금과 똑같이 동작하고 콘솔 오류가 늘지 않는다.
- R-11: 금지 경로(`.crossgate/config.json`의 `forbidden`)를 건드리지 않는다. `npm test`가 통과한다. 유료 서비스를 추가하지 않는다. 저장소에 개인 API 키(`phx_`)를 넣지 않는다.
- R-12: 문서를 갱신한다: `docs/인수인계.md`(세 절 제목 유지: 마지막 작업 / 다음 할 일 / 열린 문제), 그리고 이번 변경으로 사실이 달라지는 문서. 배포 뒤 숫자 확인 방법(jelly-studio 루트에서 `python3 bin/jelly resume thanusual` → 방문자 수가 0보다 큼)을 적는다.
- R-13: `jelly/register` 브랜치의 등록 문서(`docs/숫자-기록.md`, `docs/인수인계.md`, `docs/아이디어.md`, `CLAUDE.md`·`AGENTS.md`의 jelly-studio 절)를 이 실행에서 함께 검수한다(작업 브랜치에 먼저 병합함: `8e304dde`).

## 하지 않을 일
- 배포(`release` 브랜치로 올리기). 사용자가 지시할 때만 한다.
- 동의 배너, 수집 거부 버튼, 개인정보 처리방침 페이지 같은 새 화면.
- `signup`·`purchase`·`ai_cost`, 사용자 식별(`identify`), 장소 이름 같은 추가 속성.
- PostHog 스크립트 자체 호스팅이나 프록시(`functions/`는 금지 경로다).
- PostHog 프로젝트 쪽 설정 변경(IP 저장 끄기 등). 저장소 밖 설정이다.
- 금지 경로 수정, 새 의존성 설치.

## 결정 목록
이번 작업이 답해야 하는 결정. 처리가 `질문`인 것만 사용자에게 묻는다.
처리: `사용자`(사용자가 말함) · `도출`(목표·제약·코드 사실에서 나옴) · `조정값`(정해진 방식 안의 기본값, 나중에 바꿔도 됨) · `질문`(AI가 고르면 추측) · `해당 없음`

| ID | 결정 | 처리 | 근거 · 답 |
|---|---|---|---|
| C-1 | 어떤 방식으로 불러오나 | 사용자 | `docs/숫자-기록.md`: 공식 로더. 자체 호스팅·npm 번들 아님. `array.js`는 PostHog가 올리는 최신본을 받는다(공식 로더의 동작) |
| C-2 | 수집 주소 | 도출 | 사용자가 준 프로젝트 주소 `https://us.posthog.com`은 US 클라우드의 화면·조회 주소다(jelly-studio가 조회 API로 쓴다). 브라우저 수집은 공식 로더 기준 `https://us.i.posthog.com`, `ui_host`는 `https://us.posthog.com` |
| C-3 | `service`를 어떻게 모든 이벤트에 붙이나 | 도출 | 계약: 브라우저는 전역 속성. 첫 `$pageview`에도 있어야 jelly 방문자 수에 잡히므로 초기화가 끝나고 첫 페이지뷰가 나가기 전에 등록한다(PostHog `loaded` 콜백) |
| C-4 | 세 이벤트 외 PostHog 자동 수집 | 사용자 | 사용자 지시: 이벤트는 `$pageview`, `core_action`, `$exception`. 계약: 해당하지 않는 이벤트는 보내지 않는다, 입력 원문 금지. 그래서 클릭 자동 수집·`$pageleave`·세션 녹화·설문·히트맵·죽은 클릭·성능 지표를 끈다 |
| C-5 | `$pageview`가 나가는 때 | 도출 | 계약 "페이지 방문". 이 앱은 한 페이지이고 `#p=`는 같은 페이지 안의 선택이다. 불러올 때 1회 |
| C-6 | `place_open`을 보내는 행동 | 도출 | `docs/숫자-기록.md`: 앱 안에서 장소 하나를 골라(누르기·클릭·키보드) 자세히 볼 때만. 코드에서 그 행동은 목록 행, 지도 점·핀, 「가까운 다른 장소」 셋이다 |
| C-7 | 주소 변경(`hashchange`)으로 복원된 장소 | 도출 | 앱 안에서 누른 것이 아니라 주소에서 복원된 것이다. 첫 로드 복원과 같은 종류라 보내지 않는다 |
| C-8 | 이미 열려 있는 장소를 다시 고를 때 | 질문 | 핵심 행동 수의 정의다. 추천: 보내지 않는다(선택한 장소가 바뀔 때만 1건. 닫았다가 다시 열면 1건) |
| C-9 | `core_action`에 장소 이름을 넣나 | 사용자 | 계약의 속성은 `service`, `action`뿐. 넣지 않는다 |
| C-10 | 주소(`$current_url`)에 장소 이름이 실려 간다 | 도출 | PostHog 기본 속성이다. 장소 이름은 공개 장소명이고 개인정보가 아니다. 검색어는 주소에 없다. 그대로 둔다 |
| C-11 | 쿠키 고지 문구 | 조정값 | `docs/숫자-기록.md`의 예시 문구를 그대로 쓴다 |
| C-12 | 쿠키 고지가 폰에서 안 보인다 | 질문 | 폰에서는 footer 전체가 숨겨져 있다. 계약은 "사용자에게 보이는 곳"이다. 추천: 폰에서도 목록 시트를 펼치면 맨 아래에 같은 footer가 보이게 한다 |
| C-13 | 쿠키 고지가 접힌 안내 안에 있어 제목만으로는 알 수 없다 | 질문 | footer 내용은 접힌 `<details>`이고 제목이 「데이터 출처와 한계」다. 추천: 같은 접힌 안내 안에 넣고 제목을 「데이터 출처와 한계 · 쿠키 안내」로 바꾼다 |
| C-14 | `404.html`의 쿠키 고지 | 질문 | PostHog는 404에서도 돌지만 그 페이지에는 footer가 없다. 추천: 404에는 넣지 않는다(고지는 서비스 단위이고, 404는 고지가 있는 첫 화면으로 가는 링크뿐이다) |
| C-15 | 로컬 개발·QA에서 실제로 보내나 | 질문 | 로컬에서 띄운 화면도 같은 키로 보내면 운영 숫자(방문자 수)에 개발 트래픽이 섞인다. 추천: `localhost`·`127.0.0.1`·`[::1]`에서는 PostHog를 불러오지 않는다. 그 밖의 주소(운영, Pages 미리보기)에서는 보낸다 |
| C-16 | 방문자 저장 방식 | 사용자 | 계약: 쿠키, PostHog 기본 저장 방식(`localStorage+cookie`) |
| C-17 | 쿠키 범위 | 조정값 | 이 호스트에만 둔다(`cross_subdomain_cookie: false`). 서비스가 호스트 하나다 |
| C-18 | 사용자 프로필 | 도출 | 가입이 없다. `identify` 없음, PostHog 기본 `identified_only`. jelly의 `count(DISTINCT person_id)`는 익명 이벤트도 방문자별로 센다 |
| C-19 | 거부 방법 | 사용자 | 계약: 브라우저에서 쿠키 차단. 동의 배너·거부 버튼 없음 |
| C-20 | PostHog를 못 불러올 때 | 도출 | 통계는 부가 기능이다. 앱 동작과 콘솔이 지금과 같아야 한다(R-10). PostHog가 없을 때 기록 호출은 조용히 넘어간다 |
| C-21 | PostHog가 늦게 불러와질 때 먼저 일어난 `place_open` | 도출 | 공식 로더의 대기열이 보관했다가 보낸다. 따로 만들지 않는다 |
| C-22 | `$exception` 범위 | 조정값 | PostHog 기본(잡히지 않은 오류, 거부된 Promise). 콘솔 오류 수집은 켜지 않는다 |
| C-23 | 외부 스크립트 금지 관례와의 충돌 | 사용자 | `CLAUDE.md`의 "No Google Fonts or other CDN assets"는 글꼴·자산 규칙이다. PostHog 공식 로더는 사용자 요구다. 문서에 예외로 적는다 |
| C-24 | `_headers`·CSP | 도출 | 외부 스크립트를 막는 설정이 없다. 금지 경로를 바꾸지 않는다 |
| C-25 | 비용 | 도출 | PostHog 무료 한도 안에서 쓴다. 이벤트를 셋으로 줄여 양이 적다. 유료 기능·결제 수단을 추가하지 않는다 |
| C-26 | 방문자 IP | 해당 없음 | 어떤 요청이든 IP는 전달된다. 저장 여부는 PostHog 프로젝트 설정(저장소 밖)이다. `docs/인수인계.md` "열린 문제"에 운영자 확인 항목으로 적는다 |
| C-27 | 완료 증명 | 질문 | 추천: (1) `npm test`와 수용 테스트(가짜 `window`로 로더·초기화 설정·`service` 등록·`place_open` 호출 조건 확인), (2) 브라우저 QA(PostHog로 가는 요청을 가로채 실제로는 보내지 않고 내용만 확인, 폰·데스크톱 고지 표시, 차단 시 앱 정상), (3) 실제 수집 확인은 배포 뒤 운영자가 `python3 bin/jelly resume thanusual`로. 병합 전에 실제 PostHog로 시험 이벤트를 보내지 않는다 |
| C-28 | 등록 문서 검수 위치 | 도출 | 사용자 지시: 같은 실행에서 검수. 개발 diff에는 안 들어가므로 Wiki 검수 대상에 넣는다 |
| C-29 | `main` 병합 방법 | 질문 | `main`은 보호 브랜치(필수 검사 `node`, `merge-check`)라 크로스게이트로 병합하려면 작업 브랜치 push와 PR이 필요하다. 사용자는 "지시 없이 push·배포 금지"와 "크로스게이트로 `main`에 병합"을 함께 말했다. 허락 범위에서 묻는다 |

## 허락 범위
실행 중 필요한 행동과 허락 여부: DB 쓰기, 외부 전송·유료 호출, 설치, push·배포 (없으면 "없음")
- DB 쓰기: 없음
- 외부 전송: 병합 전에는 PostHog로 아무것도 보내지 않는다(C-27 추천안 기준). 허락 여부: 질문
- 유료 호출: 없음(크로스게이트의 Codex·Claude 역할 호출은 평소대로)
- 설치: 없음
- push·PR: 작업 브랜치 `pipe/posthog-tracking`을 `origin`에 push, PR 생성, `merge-check` 통과 시 `main`에 squash 자동 병합. 허락 여부: 질문(C-29)
- 배포: 하지 않는다. 사용자가 따로 지시할 때만

## 사용자 확인 기록
- 2026-10-03 · 등급 · 무거움(추천안 확정)
