# Health Tracker

Static site: plain HTML/CSS/vanilla JS. No backend, no login, no build step, no framework. Only external request allowed: Chart.js from cdn.jsdelivr.net. Deploys as-is to GitHub Pages.

## Commands
- Regenerate data: `node scripts/build_data.js` (reads `data/*.csv` → writes `data/foods.json`, `data/mets.json`, `data/verification.md`)
- Unit tests: `node js/calc.test.js` && `node js/data.test.js`
- Serve locally (fetch() needs http, not file://): `npx.cmd serve .`

## Architecture
- `js/calc.js` — pure functions only (no DOM, no state). Every exported function needs a case in `calc.test.js`.
- `js/data.js` — localStorage (`healthTracker.v1`) schema, validation, import/export/merge. No DOM access.
- `js/app.js` — DOM wiring/rendering only. Calls into `calc.js`/`data.js`, never duplicates their logic.
- `data/*.json` are generated — never hand-edit; re-run the build script. Every value traces to a CSV row via `source`/`source_row`.

## Code style
- No frameworks, no bundler, no npm deps in the shipped app. CommonJS (`module.exports`) only in `calc.js`/`data.js` so Node can test them; browser globals via `window.Calc`/`window.Store` IIFE pattern — keep that dual-export shape.
- Vanilla DOM APIs only (`getElementById`, `innerHTML` for lists). Always `escapeHtml()` user-entered strings before interpolating into `innerHTML`.
- Metric units only (kg, cm, kcal, g). Keep calculations unrounded internally; round only at display time with `round()`/`fmt()`.
- Any `.modal-overlay`/`.view`-style element toggled via the `hidden` attribute MUST have a matching `[hidden] { display: none }` CSS rule — author `display` rules otherwise silently override the native `[hidden]` behavior (this already bit us twice).
- Label unverified/user-supplied data explicitly in the UI ("Unverified", "User-entered, not verified") — never present custom or unverified Compendium/food data as equivalent to sourced data.
- No comments explaining *what* code does; only *why*, and only when non-obvious.
