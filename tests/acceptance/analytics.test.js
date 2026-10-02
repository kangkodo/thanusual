// 수용 테스트: PostHog 기록 (ai-log/20261003/001_004527_posthog-tracking, AC-1~AC-11)
// 기획 단계에서 작성한다. 개발 역할은 이 파일을 수정하지 않는다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { trackPlaceOpen } from "../../lib/track.js";

const read = (name) => readFileSync(new URL(`../../${name}`, import.meta.url), "utf8");
const SRC = read("analytics.js");
const KEY = "phc_mQeQSaqnyCxjKEhcmXyqES8kyFge6tQDm7cUdTe8MkHu";
// Values made inside the vm context have another realm's prototypes; compare plain copies.
const plain = (v) => JSON.parse(JSON.stringify(v));

// Runs analytics.js as a classic script against a fake browser.
function run({ hostname = "thanusual.pages.dev", cookieEnabled = true, src = SRC } = {}) {
  const inserted = [];
  const first = { parentNode: { insertBefore: (node) => inserted.push(node) } };
  const window = {
    document: { createElement: () => ({}), getElementsByTagName: () => [first] },
    location: { hostname, href: `https://${hostname}/`, pathname: "/" },
    navigator: { cookieEnabled },
  };
  window.window = window;
  window.self = window;
  vm.runInNewContext(src, window);
  const init = window.posthog?._i?.[0];
  return { posthog: window.posthog, inserted, key: init?.[0], config: init?.[1] };
}

const off = (r) => r.posthog === undefined && r.inserted.length === 0;

test("AC-1 on a public host the official loader asks for array.js and queues one init with the project key", () => {
  const r = run();
  assert.equal(r.posthog._i.length, 1);
  assert.equal(r.key, KEY);
  assert.equal(r.config.api_host, "https://us.i.posthog.com");
  assert.equal(r.config.ui_host, "https://us.posthog.com");
  assert.equal(r.inserted.length, 1);
  assert.equal(r.inserted[0].src, "https://us-assets.i.posthog.com/static/array.js");
  // Preview hosts and a future custom domain collect too.
  assert.equal(run({ hostname: "abc123.thanusual.pages.dev" }).key, KEY);
  assert.equal(run({ hostname: "example.com" }).key, KEY);
});

test("AC-2 only $pageview, core_action and $exception can leave: every other automatic capture is off", () => {
  const { config } = run();
  assert.equal(config.capture_pageview, true); // on load only, never on hash or history changes
  assert.equal(config.capture_exceptions, true);
  for (const name of ["autocapture", "capture_pageleave", "capture_dead_clicks", "capture_heatmaps", "capture_performance", "cross_subdomain_cookie"]) {
    assert.equal(config[name], false, name);
  }
  assert.equal(config.disable_session_recording, true);
  assert.equal(config.disable_surveys, true);
  assert.equal(config.defaults, undefined); // a defaults date would turn history_change pageviews on
  assert.ok([undefined, "localStorage+cookie"].includes(config.persistence));
  assert.ok([undefined, "identified_only"].includes(config.person_profiles));
});

test("AC-3 service is registered in the loaded callback, before the first pageview", () => {
  const { config } = run();
  const calls = [];
  config.loaded({ register: (props) => calls.push(props) });
  assert.deepEqual(plain(calls), [{ service: "thanusual" }]);
});

test("AC-4 nothing identifies the visitor and nothing is captured at load", () => {
  const { posthog } = run();
  const queued = plain(Array.from(posthog)).map((call) => call[0]);
  for (const name of ["identify", "alias", "group", "setPersonProperties", "capture", "createPersonProfile"]) {
    assert.ok(!queued.includes(name), name);
  }
});

test("AC-5 before_send cuts ? and # off every address value and leaves the rest alone", () => {
  const { config } = run();
  const event = {
    event: "$exception",
    properties: {
      service: "thanusual",
      action: "place_open",
      $current_url: "https://thanusual.pages.dev/?email=a@b.c&x=1#p=%EC%9D%B4%ED%83%9C%EC%9B%90%EC%97%AD",
      $referrer: "https://www.google.com/search?q=secret",
      $session_entry_url: "https://thanusual.pages.dev/old/path?token=1#frag",
      $pathname: "/old/path",
      $referring_domain: "$direct",
      $exception_list: [{ value: "boom ?x=1 #y", stacktrace: { frames: [{ filename: "http://thanusual.localhost:8788/app.js?v=1" }] } }],
    },
    $set: { $current_url: "https://thanusual.pages.dev/#p=x" },
    $set_once: { $initial_current_url: "https://thanusual.pages.dev/?q=1", $initial_referrer: "$direct" },
  };
  const out = plain(config.before_send(event));
  assert.deepEqual(out, {
    event: "$exception",
    properties: {
      service: "thanusual",
      action: "place_open",
      $current_url: "https://thanusual.pages.dev/",
      $referrer: "https://www.google.com/search",
      $session_entry_url: "https://thanusual.pages.dev/old/path", // the 404 path stays
      $pathname: "/old/path",
      $referring_domain: "$direct",
      $exception_list: [{ value: "boom ?x=1 #y", stacktrace: { frames: [{ filename: "http://thanusual.localhost:8788/app.js" }] } }],
    },
    $set: { $current_url: "https://thanusual.pages.dev/" },
    $set_once: { $initial_current_url: "https://thanusual.pages.dev/", $initial_referrer: "$direct" },
  });
});

test("AC-6 before_send survives events without properties and null", () => {
  const { config } = run();
  assert.deepEqual(plain(config.before_send({ event: "x" })), { event: "x" });
  assert.equal(config.before_send(null), null);
});

test("AC-7 local hosts never load PostHog", () => {
  for (const hostname of ["localhost", "127.0.0.1", "[::1]"]) {
    assert.ok(off(run({ hostname })), hostname);
  }
});

test("AC-8 a browser with cookies blocked never loads PostHog", () => {
  assert.ok(off(run({ cookieEnabled: false })));
});

test("AC-9 an empty project key never loads PostHog", () => {
  assert.ok(SRC.includes(KEY));
  assert.ok(off(run({ src: SRC.replaceAll(KEY, "") })));
});

test("AC-10 trackPlaceOpen sends one core_action only when the user moves to a different place", () => {
  const calls = [];
  const posthog = { capture: (...args) => calls.push(args) };
  trackPlaceOpen(null, "이태원역", posthog);
  assert.deepEqual(calls, [["core_action", { action: "place_open" }]]);
  trackPlaceOpen("이태원역", "이태원역", posthog); // already open
  trackPlaceOpen("이태원역", null, posthog); // closing
  trackPlaceOpen(null, null, posthog);
  trackPlaceOpen(undefined, "", posthog);
  assert.equal(calls.length, 1);
  trackPlaceOpen("이태원역", "강남역", posthog);
  trackPlaceOpen(null, "강남역", posthog); // closed, then opened again
  assert.deepEqual(calls.slice(1), [["core_action", { action: "place_open" }], ["core_action", { action: "place_open" }]]);
  // Without PostHog (local host, blocked cookies, empty key) it is a quiet no-op.
  assert.equal(globalThis.posthog, undefined);
  assert.doesNotThrow(() => trackPlaceOpen(null, "이태원역"));
  globalThis.posthog = posthog;
  try {
    trackPlaceOpen(null, "이태원역");
    assert.equal(calls.length, 4);
  } finally {
    delete globalThis.posthog;
  }
});

test("AC-11 both pages load analytics.js, the notice sits in the index footer only, and no personal key is in the repo files", () => {
  const index = read("index.html");
  const gone = read("404.html");
  assert.match(index, /<script[^>]*\ssrc="\.?\/analytics\.js"/);
  assert.match(gone, /<script[^>]*\ssrc="\/analytics\.js"/); // the 404 page is served at any depth
  const details = /<details class="sources">([\s\S]*?)<\/details>/.exec(index)?.[1] ?? "";
  assert.ok(details.includes("<summary>데이터 출처와 한계 · 쿠키 안내</summary>"));
  assert.ok(details.includes("이 서비스는 이용 통계를 위해 쿠키를 사용합니다. 모으는 것은 익명 이용 기록뿐이며, 이메일·이름·전화번호·입력 내용 같은 개인정보는 모으지 않습니다. 통계 도구는 PostHog(해외 서버)입니다. 원하지 않으면 브라우저 설정에서 쿠키를 차단할 수 있습니다."));
  assert.ok(!gone.includes("쿠키"));
  for (const name of ["analytics.js", "index.html", "404.html", "app.js", "map.js", "lib/track.js"]) {
    assert.ok(!read(name).includes("phx_"), name);
  }
});
