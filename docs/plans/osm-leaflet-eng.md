# Eng plan: OSM + Leaflet second screen

Source design: `docs/designs/osm-leaflet-map.md` (APPROVED)
Repo: kangkodo/thanusual
Implement from `main`. Remaining user choices default to the recommended option.

## What already exists

- `app.js` `state`, `CATS`, `RANK`, `rowsOf`, `el()`, `load()` from `current.json` (places already include `lat`/`lng`)
- `styles.css` tokens `--hot` `--calm` `--muted` `--ink`
- `index.html` skip link + category tabs
- Cloudflare Pages (`wrangler.toml` `pages_build_output_dir = "."`)

Reuse those. Do not rebuild ranking.

## Locked decisions

```
current.json
    │
    ▼
rowsOf(cat) ──────────────────► list render (app.js)
    │
    ▼
map.js  circleMarker / DivIcon
    │
    ▼
L.tileLayer("/tiles/{z}/{x}/{y}{r}.png")
    │
    ▼
Pages Function  +  CARTO_API_KEY (secret)
    │
    ▼
cartocdn light_all PNG
```

- Leaflet 1.9.x vendored. No CDN. No `tile.openstreetmap.org`.
- Tiles: Pages Function `GET /tiles/{z}/{x}/{y}.png` and `/tiles/{z}/{x}/{y}@2x.png`. Client never sees `CARTO_API_KEY`.
- Upstream: `https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png` or `.../{y}@2x.png?key=`
- Referer: production host must be `thanusual.pages.dev` or `*.thanusual.pages.dev`. `localhost` Referer is allowed only when the Function itself is served from localhost (wrangler pages dev). Production must not honor a localhost Referer.
- Cache: Cache API (`caches.default`), not a no-op `s-maxage` on a DYNAMIC function.
- `map.js` extracted. Shared helpers in `shared.js`. `map-radius.js` is pure and unit-tested.
- Radius: BASE by grade, then min–max lerp of `mid` within that grade’s current `rowsOf` peers (`base * (0.8 + 0.4 * t)`). Duplicate mids share the same t. Paint 여유 first so 붐빔 is on top.
- DivIcon: 24px, no place name in HTML (`textContent` / CSS only).
- `li[data-name]` survives `replaceChildren` for pin → list.
- Local map tiles need `wrangler pages dev`, not `python -m http.server`.
- node:test for `radiusPx` and tile parse/referer. Row↔pin is `/qa`.

## NOT in scope

- Ads, Naver search, osm.org tiles, MapLibre, `leaflet.heat`, VWorld (this slice)
- Rewriting the ranking list or a new design system
- Playwright in this PR
- Seoul tile-index clamp on the proxy (Leaflet `maxBounds` is enough)

## Failure modes

| Path | Failure | User sees | Covered |
|---|---|---|---|
| `load()` | all DATA_URLS fail | existing empty board; 지도 disabled | existing UI |
| Function | missing `CARTO_API_KEY` | gray map + status, overlays stay | Function 503; tileerror |
| Function | bad Referer | 403, no tile | unit test |
| Function | non-integer / z>18 | 400 | unit test |
| Tiles | CARTO 4xx/5xx | gray + status | tileerror |
| Map | missing lat/lng | skip that place | filter |
| Click | `replaceChildren` | scroll by `data-name` after re-render | `/qa` |

No silent key leak: never log `CARTO_API_KEY`.

## Tests (node)

```
CODE PATHS                                           USER FLOWS
[+] map-radius.js                                    [+] 보기 전환
  ├── radiusPx                                        ├── [GAP][→QA] 목록→지도
  │   ├── [★★★] missing mid → base                    ├── [GAP][→QA] 행 클릭 → zoom 14
  │   ├── [★★★] n<2 → base                            ├── [GAP][→QA] 핀→목록 scroll
  │   └── [★★★] min=max → base                         └── [GAP][→QA] 분류 필터가 지도에도
[+] lib/tiles.js
  ├── parseTilePath png and @2x
  └── refererAllowed prod vs localhost
```

## Implementation Tasks

- [x] **T1 (P1)** — Tile Function + Cache API + Referer + @2x
- [x] **T2 (P1)** — Vendor Leaflet, `map.js`, view switch, row↔pin
- [x] **T3 (P2)** — node:test for radius and tiles helpers

Sequential: Function and map.js can be written together; both touch the Pages app. No parallel worktrees.

## GSTACK REVIEW REPORT

| Review | Runs | Status | Findings |
|---|---|---|---|
| Eng Review (PLAN) | 1 | CLEAR | Tile keyless CARTO invalid; Function + tightenings |
| CEO Review | 0 | — | skipped (wedge already narrow) |
| Design Review | 0 | — | tokens locked in design doc |
| Outside Voice | 1 | issues_found | Function vs client key; cache; @2x; modules |
| CROSS-MODEL | absorbed | B | Keep Function; apply tightenings |

VERDICT: CLEARED — Eng Review passed (PLAN)

NO UNRESOLVED DECISIONS
