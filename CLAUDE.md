# 평소보다 / thanusual

Live ranking of 121 Seoul citydata hotspots: how crowded now vs usual. Production: https://thanusual.pages.dev

First screen is a ranked list, not a map. Copy: name, congestion grade, people midpoint, 2h-later people %. 「평소 대비 %」 waits until n≥3 same weekday/10-min slot.

## Product locks

- 121 places, not 140. Official `citydata_ppltn` only. Do not use unofficial `/SeoulRtd/api/ppltn`.
- Collect via GitHub Actions (HTTP :8088). Workers `fetch()` ignores that port.
- Snapshot lives on the `data` branch as `current.json`. Pages production branch is `main`. Do not build `data` as production.
- Sample Seoul key always returns 광화문·덕수궁. Official key required for 121.
- Secrets: never read, grep, or quote `secrets/`, `.env`, `*.key`. Load `../secrets/seoul.env` in code only.

## Map

- Engine: Leaflet 1.9.x vendored in `vendor/leaflet/`. Overlays (circles, HTML pins) are ours. No `leaflet.heat`.
- Client tiles: same-origin `/tiles/{z}/{x}/{y}{r}.png` only. Pages Function injects `CARTO_API_KEY`. Never put that key in git or the browser bundle. Do **not** hit `tile.openstreetmap.org`.
- Local tiles need `npx wrangler pages dev .` — not `python -m http.server`.
- Never run `wrangler pages deploy .` from the repo root: `.dev.vars` sits in the output dir and would be published. Deploys go through git push only.
- The tile Function only proxies z10–18 inside `TILE_BBOX` (`lib/tiles.js`); `map.js` `TILE_BOUNDS` must match. Referer is hotlink hygiene, not auth.
- There is **no rate limit** on `/tiles/*` today. WAF rate-limiting rules need a zone, and a bare `*.pages.dev` host has none. Options when needed: attach a custom domain (then a WAF rule), or a code-side limiter. Every `/tiles/*` hit, including 400/403, counts toward the Pages Functions daily cap. Watch the Functions metrics after launch.
- Bump `TILE_CACHE_VERSION` in `lib/tiles.js` when tile headers or style change; pages.dev has no cache purge.
- Optional later: Naver place search for coordinates, then plot on the Leaflet map. Do not put Naver REST keys in git or in the browser bundle.
- Custom pins and density viz are in scope. Place names appear at zoom ≥13 as plain map labels (Leaflet tooltip, no extra library). City zoom stays unlabeled. Map view keeps the ranking in a left rail (desktop) or bottom sheet (phone), with name search. Pin click stays on the map and selects the row. Rewriting the ranking list is out of scope unless a later /office-hours says otherwise.

## Design

- Reference: `../vercel-design.md` (Vercel brand guideline) for judgment only: Geist type, monochrome, spacing tokens, no cards, evidence-first first screen, light/dark without a switcher. Do **not** add the Vercel wordmark, triangle, or `vercel-brand.css`; this is not a Vercel-authored page.
- Fonts: Geist Sans/Mono vendored in `vendor/geist/` (OFL). Hangul falls back to the system gothic stack. No Google Fonts or other CDN assets.
- Tokens live in `styles.css` `:root` (`--surface`, `--text`, `--border*`, `--hot`, `--calm`, `--space-*`, `--type-*`). Page CSS uses tokens, never raw hex. Map circle colors come from those tokens via `STYLE[level].token` in `map-radius.js`, resolved at draw time in `map.js`.
- Copy: sentence case, no em dashes in prose, no eyebrows or pills. Level color (`--hot`) is always paired with the level text.

## Deploy Configuration (configured by /setup-deploy)

- Platform: Cloudflare Pages
- Production URL: https://thanusual.pages.dev
- Deploy workflow: auto-deploy on push to `main` (Pages). Collect workflow is `.github/workflows/collect.yml` (data branch only).
- Deploy status command: HTTP health check
- Merge method: squash
- Project type: static web app (`index.html`, `styles.css`, `app.js`)
- Post-deploy health check: https://thanusual.pages.dev

### Custom deploy hooks

- Pre-merge: none
- Deploy trigger: automatic on push to main
- Deploy status: poll production URL
- Health check: https://thanusual.pages.dev

## gstack (recommended)

This project uses [gstack](https://github.com/garrytan/gstack) for AI-assisted workflows.
Install it for the best experience:

```bash
git clone --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack
cd ~/.claude/skills/gstack && ./setup --host cursor --team
```

Use `/browse` from gstack for all web browsing. Never use `mcp__claude-in-chrome__*` tools.
Available skills: /office-hours, /plan-ceo-review, /plan-eng-review, /plan-design-review,
/design-consultation, /design-shotgun, /design-html, /review, /ship, /land-and-deploy,
/canary, /benchmark, /browse, /open-gstack-browser, /qa, /qa-only, /design-review,
/setup-browser-cookies, /setup-deploy, /setup-gbrain, /sync-gbrain, /retro, /investigate,
/document-release, /document-generate, /codex, /cso, /autoplan, /pair-agent, /careful, /freeze,
/guard, /unfreeze, /gstack-upgrade, /learn, /spec.

Do not vendor gstack into this repo. Global install plus this file is enough.

## Skill routing

Planning is not review. Review is not shipping. Founder taste is not engineering rigor.
Do not blend skills. Run them in sprint order: office-hours → autoplan → implement → review → qa → ship.

When the user's request matches an available skill, invoke it. When in doubt, invoke the skill.

- Product ideas/brainstorming → /office-hours
- Strategy/scope → /plan-ceo-review
- Architecture → /plan-eng-review
- Design system/plan review → /design-consultation or /plan-design-review
- Full review pipeline → /autoplan
- Bugs/errors → /investigate
- QA/testing site behavior → /qa or /qa-only
- Code review/diff check → /review
- Visual polish → /design-review
- Ship/deploy/PR → /ship or /land-and-deploy
- Save progress → /context-save
- Resume context → /context-restore
- Author a backlog-ready spec/issue → /spec
