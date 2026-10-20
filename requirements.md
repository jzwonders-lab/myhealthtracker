Build a simple, mobile-friendly health tracker as a static website. No backend, no Python, no login, no build step. It must deploy to GitHub Pages.
This is a class project. Keep the code readable and clearly structured, because it will be presented to a professor.

## 0. Input files
Work in the project folder C:\Jz\ccc_exercises\health_tracker. The two input datasets are in its data folder:
- data\sg_meals_yeo2021.csv: 45 Singapore meals with kcal and macros per 100 g. Source: Yeo PLQ et al. (2021), Foods 10(7):1659, doi:10.3390/foods10071659. Each row has a source_table column.
- data\compendium_adult_sample.csv: 39 workout activities with MET values. Source: 2024 Adult Compendium of Physical Activities, J Sport Health Sci 2024;13(1):6-12. Each row has a rounding_check column and a verification_status of "unverified-extract".

Do not create any other dataset. Do not invent values. In your final report, state which files were found.

## 1. Stack and constraints
- Plain HTML, CSS, and vanilla JavaScript.
- Chart.js from cdn.jsdelivr.net is the only external request allowed.
- Data is stored in browser localStorage under the key "healthTracker.v1".
- Works on desktop and on a phone (375 px minimum). No horizontal scrolling.
- Metric only: kg, cm, kcal, grams.
- Files: index.html, css/styles.css, js/app.js, js/calc.js, js/data.js, data/foods.json, data/mets.json, data/verification.md, scripts/build_data.js, README.md.
- scripts/build_data.js reads the two CSVs in data\ and writes data/foods.json and data/mets.json. Run it with Node. The app itself does not read the CSVs at runtime.

## 2. Onboarding (first launch; editable in Settings)
Required, with validation:
- Sex: male or female (used only for the BMR equation).
- Age: integer, 13 to 100.
  - Under 19: block workout logging and show "Workout estimates are available for ages 19 and over." Food and weight logging still work.
  - 19 and over: allowed. Store the actual age.
- Height: cm, 100 to 230.
- Current weight: kg, 30 to 300.
- Goal: Lose weight, Gain muscle, or Maintain.
Optional: nickname.

### Age 60 and over (project decision)
Users aged 60 and over are treated as age 59 for all recommendations. The Compendium's Adult table covers ages 19 to 59, and the BMR equation is also age-based, so this is a simplification.
- Store the actual age. Use effective_age = min(age, 59) in every calculation.
- Show a note wherever a recommendation is shown for these users: "Recommendations use age 59 for users aged 60 and over. This is a simplification for this project."
- In the README, state this simplification and why it was chosen.

## 3. Pages (bottom navigation on phone, top navigation on desktop)

### Page 1: Home
- Today's cards: latest weight, calories eaten, workout kcal burned, workout minutes, net kcal.
- Progress bars for calories and protein against today's targets.
- "Recommended for today": calorie target, protein target (g), and suggested workout minutes. Include a "How is this calculated?" section that shows the formula.
- Macro chart for today (protein, carbs, fat in grams).
- Disclaimer block (section 8), always visible.

### Page 2: Food log
- Search box that filters foods by name (case-insensitive, partial match). Each result shows its source.
- Pick a food, enter grams. Calories and macros update live.
- Add a custom food (name, kcal, protein, carbs, fat per 100 g). Custom foods are labelled "User-entered, not verified."
- Today's entries with delete.
- Chart: calories eaten per day for the last 14 days, with a target line.

### Page 3: Workout log
- Activity dropdown grouped by category. Each item shows its Compendium code and an "Unverified" badge.
- Duration in minutes (1 to 600). Estimated kcal updates live.
- Custom MET option, labelled "User-supplied, not verified."
- Today's workouts with delete.
- Chart: kcal burned per day for the last 14 days.

### Page 4: Weight log
- Enter weight in kg for a date (default today). One entry per date; saving again replaces it.
- BMI shown as a rough reference, with its category.
- Chart: weight over time with a 7-day moving average.

## 4. Calculations (in js/calc.js, each with a unit test)
- BMR, Mifflin-St Jeor (1990). Keep unrounded internally. Display rounded to the nearest kcal. Use effective_age.
  - Male: 10 × weight_kg + 6.25 × height_cm − 5 × effective_age + 5
  - Female: 10 × weight_kg + 6.25 × height_cm − 5 × effective_age − 161
- Maintenance estimate = BMR × 1.2 (light activity). Label it "estimate."
- Workout kcal = MET × body_weight_kg × (minutes ÷ 60). Use the most recent weight on or before the workout date. If none exists, use the onboarding weight.
- Food macros = grams × (per-100 g value ÷ 100).
- Calorie target from maintenance:
  - Lose weight: maintenance − 500. Note on screen: "A 500 kcal/day deficit is commonly estimated at about 0.5 kg per week. This is an approximation."
  - Gain muscle: maintenance + 275.
  - Maintain: maintenance.
- Floor warnings, shown as "commonly cited minimums, not clinical rules": women below 1200 kcal/day, men below 1500 kcal/day.
- Protein target: 1.6 g per kg for lose and maintain; 1.8 g per kg for gain. Show the basis: "ISSN position stand (Jäger et al., 2017): 1.4 to 2.0 g/kg/day for exercising adults. Your target is within this range."
- Daily net = kcal eaten − kcal burned from workouts. Balance vs maintenance = kcal eaten − kcal burned − maintenance.

## 5. Data and verification (core rule)
Every entry in foods.json and mets.json must come from a row in one of the two CSVs. Nothing is typed from memory.

### foods.json (from sg_meals_yeo2021.csv)
Each item has: id, name, category (the ethnic group from source_table), source, source_file, source_row, per100g {kcal, protein_g, carbs_g, fat_g}, verified, retrieved.
- source = "Yeo et al. (2021), Foods 10(7):1659". verified = true. Use kcal exactly as given in the file.
- Do not add any other food database.
- Do not scrape any website.

### mets.json (from compendium_adult_sample.csv)
Each item has: code, name, category, met, source, source_file, verified, verification_status.
- Keep each code and description exactly as written in the file.
- Keep each MET value exactly as written. Do not change it or combine activities with different MET levels (the Compendium's terms of use).
- verification_status = "unverified-extract" for every row. Show an "Unverified" badge on each workout item, with the text "Values were extracted from the published PDF and have not all been checked against it."
- Any row whose rounding_check is FAIL must be excluded.

### data/verification.md (generated by the build)
One row per item: item type, name or code, source file, source row, verified, confidence (1 to 10).
Confidence rules:
- Yeo food row, copied from the file: 7.
- Compendium workout row, copied from the file, rounding check passed, not checked against the PDF: 6.
- Custom or user-entered item: not rated.
Flag every item below 7 in the UI and in the README.

## 6. Export and import (required)
- Export: a button that downloads healthtracker-YYYY-MM-DD.json with schemaVersion, profile, food log, workout log, weight log, and custom foods.
- Import: file picker. Validate schemaVersion and every field's type and range. Reject an invalid file with a clear message and change nothing.
- Offer "Replace all data" or "Merge (keep the newer entry for the same date)." Ask for confirmation before replacing.

## 7. Design
- Large tap targets (at least 44 px). Clear labels. A plain-language explanation beside every number.
- Use color and text for status, never color alone.
- Empty states with one short instruction.
- Each chart has a title, axis labels, and a one-line text summary.
- One chart per log page, with a target line where one applies.

## 8. Disclaimers (required text, shown on Home)
"These figures are estimates for general guidance, not medical advice. Consult a doctor or registered dietitian before changing your diet or exercise, especially if you have a medical condition."
Also show:
- "Singapore meals: Yeo et al. (2021), Foods 10(7):1659."
- "Activity MET values: 2024 Adult Compendium of Physical Activities."
- "This app is not endorsed by or affiliated with the authors, MDPI, or the Compendium team."
- For users aged 60 and over: the age-59 note from section 2.

## 9. README.md
- Deploy: create a GitHub repository, enable GitHub Pages from the main branch, open the URL.
- Data stays in each browser. Export regularly.
- How data/foods.json and data/mets.json were built, and which items are unverified.
- The age-60+ simplification and why it was chosen.
- Sources:
  - Yeo PLQ, Bi X, Yeo MTY, Henry CJ (2021). Energy Content and Nutrient Profiles of Frequently Consumed Meals in Singapore. Foods 10(7):1659.
  - Herrmann SD et al. (2024). 2024 Adult Compendium of Physical Activities. J Sport Health Sci 13(1):6-12.
  - Jäger R et al. (2017). ISSN position stand: protein and exercise. J Int Soc Sports Nutr.
  - Mifflin MD, St Jeor ST et al. (1990). Am J Clin Nutr.

## 10. Testing (run each and report the result)
1. Onboarding rejects age 12, height 50, weight 0, and a missing sex.
2. BMR: male, 70 kg, 175 cm, age 30 → 1649 kcal. Female, same inputs → 1483 kcal.
3. Age 60 and over: male, 70 kg, 175 cm, age 65 → 1504 kcal (same as age 59). The age-59 note appears.
4. Workout: MET 5.0, 70 kg, 60 min → 350 kcal. MET 5.0, 70 kg, 30 min → 175 kcal.
5. Food: 150 g of a food at 200 kcal per 100 g → 300 kcal.
6. Goal targets, maintenance 1979 (BMR 1648.75 × 1.2, rounded): lose 1479, gain 2254, maintain 1979. Floor warning appears below 1200 (women) or 1500 (men).
7. Protein at 70 kg: lose 112 g, gain 126 g.
8. Export, clear browser storage, import: all data restores exactly.
9. Import rejects a wrong schemaVersion, a negative weight, or a missing field, and changes nothing.
10. Merge keeps the newer entry for a duplicate weight date.
11. Every foods.json entry has source, source_file, source_row, and verified.
12. Every mets.json entry has code, source, and verification_status. Any rounding FAIL row is excluded.
13. Three sample Yeo rows: kcal equals the file's value.
14. No console errors on load. Charts render with zero data.
15. Layout at 375 px and 1280 px.
16. Under 19: workout logging is blocked with the notice.

## 11. Final report (required)
1. Files created.
2. Test results, one line each.
3. Input files found.
4. Count of items per confidence level, from data/verification.md.
5. Every item below 7, and why.

## 12. Git (only if you commit)
End each commit message with:
Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HyXTzPsp9LdfJgZdCewdLo
End pull request descriptions with:
🤖 Generated with [Claude Code](https://claude.com/claude-code)
https://claude.ai/code/session_01HyXTzPsp9LdfJgZdCewdLo

## 13. Rules
- Do not invent nutrition values, MET values, or sources.
- Do not add a backend, login, analytics, or any external request except Chart.js.
- Label every estimate as an estimate.