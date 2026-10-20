# Health Tracker

A simple, mobile-friendly health tracker. Plain HTML, CSS, and vanilla JavaScript — no backend, no login, no build step. Chart.js (from `cdn.jsdelivr.net`) is the only external request the app makes at runtime.

## Deploying to GitHub Pages

1. Create a new GitHub repository and push this folder's contents to its `main` branch.
2. In the repository, go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to "Deploy from a branch", branch `main`, folder `/ (root)`.
4. Save. GitHub will publish the site at `https://<your-username>.github.io/<repo-name>/`. Open that URL.

No build step is required — the committed `index.html`, `css/`, `js/`, and `data/` files are served as-is.

## Your data stays in your browser

All data (profile, logs, custom foods) is stored in `localStorage` under the key `healthTracker.v1`, in the browser you're using. Nothing is sent to a server. This means:

- Data does not sync between devices or browsers.
- Clearing your browser's site data for this page deletes everything.
- **Export regularly** (Settings → "Export data (.json)") to keep a backup you can re-import later, on this device or another.

## How `data/foods.json` and `data/mets.json` were built

`scripts/build_data.js` is a Node script (run with `node scripts/build_data.js`) that reads the two source CSVs in `data/` and writes `data/foods.json`, `data/mets.json`, and `data/verification.md`. The app itself never reads the CSVs — only the generated JSON files, at runtime.

Every value in the two JSON files is copied directly from a row in a source CSV; nothing is typed from memory or invented.

- **`data/foods.json`** — from `data/sg_meals_yeo2021.csv` (45 rows). Each item keeps the exact kcal/macro values from the file, plus `source_file` and `source_row` pointing back to the originating CSV row. The CSV's `source_table` column (Table 1 / 2 / 3) groups the dishes by the ethnic cuisine used in Yeo et al. (2021) — Chinese, Malay, and Indian respectively, matching every dish name in each table — and that mapping is used as the `category` field. All 45 rows are marked `verified: true`.
- **`data/mets.json`** — from `data/compendium_adult_sample.csv` (39 rows, all with `rounding_check = pass`; the build script excludes any row where `rounding_check` is `FAIL`, though none were present in this sample). The `category` field is derived only from keywords already in each activity's own description (e.g. "Walking", "Running", "Swimming") — purely a UI grouping, not a changed or added value. Every MET value and activity description is kept exactly as written. All items carry `verification_status: "unverified-extract"` and are shown with an "Unverified" badge in the UI, since they were extracted from a PDF and have not all been checked against it.

### Unverified / lower-confidence items

- **All 39 workout activities** are `verification_status: "unverified-extract"` (confidence 6 in `data/verification.md`) — extracted from the published PDF by a summarizer, not yet individually checked against it. The UI shows an "Unverified" badge on every workout entry.
- **Custom foods and custom-MET workouts** that a user adds inside the app are labelled "User-entered, not verified" / "User-supplied, not verified" and are not rated in `data/verification.md` (confidence rules only apply to the two source datasets).
- All 45 Yeo food rows are confidence 7 (copied directly from the published source, not independently re-verified against the PDF/paper itself).

No item in either generated file has a confidence below 6. See `data/verification.md` for the full per-item list.

## The age-60-and-over simplification

Users aged 60 and over have their recommendations calculated using `effective_age = min(age, 59)`, while their real age is still stored and shown.

**Why:** the Mifflin-St Jeor BMR equation is age-based with no defined upper bound in this app's source, and the 2024 Adult Compendium's "Adult" table that `data/compendium_adult_sample.csv` is drawn from covers ages 19–59. Rather than extrapolate either source past where it's defined, this project pins every recommendation calculation to age 59 for older users and shows a visible note wherever a recommendation appears: *"Recommendations use age 59 for users aged 60 and over. This is a simplification for this project."* Food and weight logging are unaffected — only BMR/calorie/protein-related calculations are pinned.

## Sources

- Yeo PLQ, Bi X, Yeo MTY, Henry CJ (2021). Energy Content and Nutrient Profiles of Frequently Consumed Meals in Singapore. *Foods* 10(7):1659. doi:10.3390/foods10071659
- Herrmann SD et al. (2024). 2024 Adult Compendium of Physical Activities. *J Sport Health Sci* 13(1):6-12.
- Jäger R et al. (2017). ISSN position stand: protein and exercise. *J Int Soc Sports Nutr.*
- Mifflin MD, St Jeor ST et al. (1990). *Am J Clin Nutr.*

This app is not endorsed by or affiliated with the authors, MDPI, or the Compendium team. All figures shown are estimates for general guidance, not medical advice.

## Project structure

```
index.html              The whole app shell (4 pages + onboarding/settings modals)
css/styles.css           All styling, mobile-first with a desktop breakpoint at 768px
js/calc.js                Pure calculation functions (BMR, targets, BMI, etc.) — no DOM
js/calc.test.js           Unit tests for calc.js — run with: node js/calc.test.js
js/data.js                localStorage persistence, schema validation, import/export/merge
js/data.test.js           Unit tests for data.js — run with: node js/data.test.js
js/app.js                 UI wiring: renders views, handles events, draws charts
data/sg_meals_yeo2021.csv       Source data (input, not read by the app at runtime)
data/compendium_adult_sample.csv Source data (input, not read by the app at runtime)
data/foods.json            Generated by scripts/build_data.js
data/mets.json             Generated by scripts/build_data.js
data/verification.md       Generated by scripts/build_data.js
scripts/build_data.js      Node script that builds the three files above from the CSVs
```

## Running the tests

```
node scripts/build_data.js   # regenerates data/foods.json, data/mets.json, data/verification.md
node js/calc.test.js         # unit tests for calculations
node js/data.test.js         # unit tests for storage/import/export/merge logic
```

To try the app itself, serve the folder with any static file server (e.g. `npx serve .`) and open it in a browser — opening `index.html` directly via `file://` will block the `fetch()` calls that load `data/foods.json` and `data/mets.json`.
