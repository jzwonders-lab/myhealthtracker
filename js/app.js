(function () {
  "use strict";

  const state = Store.load();
  let foodsData = [];
  let metsData = [];
  let pickedFood = null; // {id, name, source, per100g, isCustom}
  const charts = {}; // chart instances keyed by canvas id

  // ---------------- bootstrap ----------------
  async function init() {
    try {
      const [foodsRes, metsRes] = await Promise.all([fetch("data/foods.json"), fetch("data/mets.json")]);
      if (!foodsRes.ok || !metsRes.ok) throw new Error(`HTTP ${foodsRes.status}/${metsRes.status}`);
      foodsData = await foodsRes.json();
      metsData = await metsRes.json();
    } catch (e) {
      console.error("Could not load data files.", e);
      foodsData = [];
      metsData = [];
      document.getElementById("data-load-error").hidden = false;
    }

    wireNav();
    wireWelcomeBack();
    wireOnboarding();
    wireSettings();
    wireFoodView();
    wireWorkoutView();
    wireWeightView();

    if (!state.profile) {
      showModal("modal-onboarding");
    } else {
      document.getElementById("welcome-back-heading").textContent = state.profile.nickname
        ? `Welcome back, ${state.profile.nickname}!`
        : "Welcome back!";
      showModal("modal-welcome-back");
      renderAll();
    }
  }

  function resetState() {
    const empty = Store.emptyState();
    state.schemaVersion = empty.schemaVersion;
    state.profile = null;
    state.foodLog = [];
    state.workoutLog = [];
    state.weightLog = [];
    state.customFoods = [];
    Store.save(state);
  }

  function wireWelcomeBack() {
    document.getElementById("btn-continue-existing").addEventListener("click", () => hideModal("modal-welcome-back"));
    document.getElementById("btn-start-fresh").addEventListener("click", () => {
      document.getElementById("start-fresh-confirm").hidden = false;
    });
    document.getElementById("btn-start-fresh-cancel").addEventListener("click", () => {
      document.getElementById("start-fresh-confirm").hidden = true;
    });
    document.getElementById("btn-start-fresh-yes").addEventListener("click", () => {
      resetState();
      document.getElementById("start-fresh-confirm").hidden = true;
      hideModal("modal-welcome-back");
      showModal("modal-onboarding");
    });
  }

  function renderAll() {
    renderHome();
    renderFoodView();
    renderWorkoutView();
    renderWeightView();
  }

  // ---------------- helpers ----------------
  function allFoods() {
    return foodsData.concat(
      state.customFoods.map((f) => ({
        id: f.id,
        name: f.name,
        category: "Custom",
        source: "User-entered, not verified",
        per100g: { kcal: f.kcal, protein_g: f.protein_g, carbs_g: f.carbs_g, fat_g: f.fat_g },
        verified: false,
        isCustom: true,
      }))
    );
  }

  function todaysEntries(log) {
    const today = Store.todayISO();
    return log.filter((e) => e.date === today);
  }

  function sumKcal(entries) {
    return entries.reduce((acc, e) => acc + e.kcal, 0);
  }

  function round(n) {
    return Math.round(n);
  }

  function fmt(n, decimals) {
    if (decimals === undefined) decimals = 0;
    return Number(n).toFixed(decimals);
  }

  function showModal(id) {
    document.getElementById(id).hidden = false;
  }
  function hideModal(id) {
    document.getElementById(id).hidden = true;
  }

  function isUnder19() {
    return state.profile && state.profile.age < 19;
  }
  function isAge60Plus() {
    return state.profile && state.profile.age >= 60;
  }

  function effProfile() {
    const p = state.profile;
    return {
      sex: p.sex,
      age: p.age,
      effectiveAge: Calc.effectiveAge(p.age),
      height_cm: p.height_cm,
      weight_kg: Store.latestWeightOnOrBefore(state, Store.todayISO()),
      goal: p.goal,
    };
  }

  function last14Dates() {
    const dates = [];
    const d = new Date();
    for (let i = 13; i >= 0; i--) {
      const dt = new Date(d);
      dt.setDate(d.getDate() - i);
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, "0");
      const day = String(dt.getDate()).padStart(2, "0");
      dates.push(`${y}-${m}-${day}`);
    }
    return dates;
  }

  // ---------------- navigation ----------------
  function wireNav() {
    document.querySelectorAll(".nav-btn").forEach((btn) => {
      btn.addEventListener("click", () => switchView(btn.dataset.view));
    });
    document.querySelectorAll("[data-go]").forEach((btn) => {
      btn.addEventListener("click", () => switchView(btn.dataset.go));
    });
    document.getElementById("btn-settings").addEventListener("click", openSettings);
  }

  function switchView(view) {
    document.querySelectorAll(".view").forEach((v) => (v.hidden = true));
    document.getElementById(`view-${view}`).hidden = false;
    document.querySelectorAll(".nav-btn").forEach((btn) => {
      if (btn.dataset.view === view) btn.setAttribute("aria-current", "page");
      else btn.removeAttribute("aria-current");
    });
  }

  // ---------------- onboarding ----------------
  function wireOnboarding() {
    document.getElementById("onboarding-form").addEventListener("submit", (ev) => {
      ev.preventDefault();
      const form = ev.target;
      const sexEl = form.querySelector('input[name="ob-sex"]:checked');
      const goalEl = form.querySelector('input[name="ob-goal"]:checked');
      const profile = {
        nickname: document.getElementById("ob-nickname").value.trim(),
        sex: sexEl ? sexEl.value : null,
        age: Number(document.getElementById("ob-age").value),
        height_cm: Number(document.getElementById("ob-height").value),
        weight_kg: Number(document.getElementById("ob-weight").value),
        goal: goalEl ? goalEl.value : null,
      };
      const errors = Store.validateProfile(profile);
      const box = document.getElementById("onboarding-errors");
      if (errors.length > 0) {
        box.hidden = false;
        box.innerHTML = errors.map((e) => `<div>${escapeHtml(e)}</div>`).join("");
        return;
      }
      box.hidden = true;
      state.profile = profile;
      Store.setWeightEntry(state, Store.todayISO(), profile.weight_kg);
      Store.save(state);
      hideModal("modal-onboarding");
      renderAll();
    });
  }

  // ---------------- settings ----------------
  function openSettings() {
    const p = state.profile;
    document.getElementById("st-nickname").value = p.nickname || "";
    document.querySelector(`input[name="st-sex"][value="${p.sex}"]`).checked = true;
    document.getElementById("st-age").value = p.age;
    document.getElementById("st-height").value = p.height_cm;
    document.getElementById("st-weight").value = p.weight_kg;
    document.querySelector(`input[name="st-goal"][value="${p.goal}"]`).checked = true;
    document.getElementById("settings-errors").hidden = true;
    document.getElementById("import-errors").hidden = true;
    document.getElementById("import-success").hidden = true;
    showModal("modal-settings");
  }

  function wireSettings() {
    document.getElementById("btn-close-settings").addEventListener("click", () => hideModal("modal-settings"));

    document.getElementById("settings-form").addEventListener("submit", (ev) => {
      ev.preventDefault();
      const sexEl = document.querySelector('input[name="st-sex"]:checked');
      const goalEl = document.querySelector('input[name="st-goal"]:checked');
      const profile = {
        nickname: document.getElementById("st-nickname").value.trim(),
        sex: sexEl ? sexEl.value : null,
        age: Number(document.getElementById("st-age").value),
        height_cm: Number(document.getElementById("st-height").value),
        weight_kg: Number(document.getElementById("st-weight").value),
        goal: goalEl ? goalEl.value : null,
      };
      const errors = Store.validateProfile(profile);
      const box = document.getElementById("settings-errors");
      if (errors.length > 0) {
        box.hidden = false;
        box.innerHTML = errors.map((e) => `<div>${escapeHtml(e)}</div>`).join("");
        return;
      }
      box.hidden = true;
      state.profile = profile;
      Store.save(state);
      hideModal("modal-settings");
      renderAll();
    });

    document.getElementById("btn-export").addEventListener("click", doExport);
    document.getElementById("btn-import").addEventListener("click", doImportClick);
    document.getElementById("confirm-replace-yes").addEventListener("click", () => {
      hideModal("confirm-replace");
      applyImport(window.__pendingImport, "replace");
    });
    document.getElementById("confirm-replace-no").addEventListener("click", () => {
      hideModal("confirm-replace");
      window.__pendingImport = null;
    });
  }

  function doExport() {
    const payload = Store.exportPayload(state);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const today = Store.todayISO();
    a.href = url;
    a.download = `healthtracker-${today}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function doImportClick() {
    const fileInput = document.getElementById("import-file");
    const errBox = document.getElementById("import-errors");
    const okBox = document.getElementById("import-success");
    errBox.hidden = true;
    okBox.hidden = true;
    if (!fileInput.files || fileInput.files.length === 0) {
      errBox.hidden = false;
      errBox.textContent = "Choose a file first.";
      return;
    }
    const mode = document.querySelector('input[name="import-mode"]:checked').value;
    const reader = new FileReader();
    reader.onload = () => {
      let parsed;
      try {
        parsed = JSON.parse(reader.result);
      } catch (e) {
        errBox.hidden = false;
        errBox.textContent = "File is not valid JSON. Nothing was changed.";
        return;
      }
      const errors = Store.validateImport(parsed);
      if (errors.length > 0) {
        errBox.hidden = false;
        errBox.innerHTML = `<div>File rejected. Nothing was changed.</div>` + errors.map((e) => `<div>${escapeHtml(e)}</div>`).join("");
        return;
      }
      if (mode === "replace") {
        window.__pendingImport = parsed;
        showModal("confirm-replace");
      } else {
        applyImport(parsed, "merge");
      }
    };
    reader.readAsText(fileInput.files[0]);
  }

  function applyImport(parsed, mode) {
    if (mode === "replace") {
      state.profile = parsed.profile;
      state.foodLog = parsed.foodLog;
      state.workoutLog = parsed.workoutLog;
      state.weightLog = parsed.weightLog;
      state.customFoods = parsed.customFoods;
    } else {
      const merged = Store.mergeStates(state, parsed);
      state.profile = merged.profile;
      state.foodLog = merged.foodLog;
      state.workoutLog = merged.workoutLog;
      state.weightLog = merged.weightLog;
      state.customFoods = merged.customFoods;
    }
    Store.save(state);
    const okBox = document.getElementById("import-success");
    okBox.hidden = false;
    okBox.textContent = "Import complete.";
    document.getElementById("import-file").value = "";
    renderAll();
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // ======================================================================
  // HOME (pure summary — recommendations live on their own pages)
  // ======================================================================
  function computeRecommendation() {
    const p = effProfile();
    const bmrVal = Calc.bmr(p.sex, p.weight_kg, p.height_cm, p.age);
    const maintenance = Calc.maintenanceEstimate(bmrVal);
    const calorieTargetVal = Calc.calorieTarget(p.goal, maintenance);
    const proteinTargetVal = Calc.proteinTarget(p.goal, p.weight_kg);
    const belowFloor = Calc.isBelowFloor(p.sex, calorieTargetVal);
    const goalLabel = { lose: "Lose weight", gain: "Gain muscle", maintain: "Maintain" }[p.goal];
    return { p, bmrVal, maintenance, calorieTargetVal, proteinTargetVal, belowFloor, goalLabel };
  }

  function renderHome() {
    if (!state.profile) return;

    const foodToday = todaysEntries(state.foodLog);
    const workoutToday = todaysEntries(state.workoutLog);
    const kcalEaten = sumKcal(foodToday);
    const kcalBurned = sumKcal(workoutToday);
    const minutesToday = workoutToday.reduce((acc, e) => acc + e.minutes, 0);
    const net = Calc.netKcal(kcalEaten, kcalBurned);

    const latestWeightEntry = state.weightLog.length
      ? state.weightLog.slice().sort((a, b) => b.date.localeCompare(a.date))[0]
      : null;

    const rec = computeRecommendation();

    // age-60 note
    const note = document.getElementById("home-age60-note");
    if (isAge60Plus()) {
      note.hidden = false;
      note.textContent = "Recommendations use age 59 for users aged 60 and over. This is a simplification for this project.";
    } else {
      note.hidden = true;
    }

    // cards
    document.getElementById("home-cards").innerHTML = [
      statCard("Latest weight", latestWeightEntry ? `${fmt(latestWeightEntry.weight_kg, 1)} kg` : "No data yet", "Most recent weight you logged."),
      statCard("Calories eaten", `${round(kcalEaten)} kcal`, "Total from today's food log."),
      statCard("Workout kcal burned", `${round(kcalBurned)} kcal`, "Estimated from today's workouts."),
      statCard("Workout minutes", `${minutesToday} min`, "Total duration logged today."),
      statCard("Net kcal", `${round(net)} kcal`, "Calories eaten minus calories burned from workouts."),
    ].join("");

    // progress bars (vs targets calculated on the Food page)
    const calPct = rec.calorieTargetVal > 0 ? Math.min(150, (kcalEaten / rec.calorieTargetVal) * 100) : 0;
    const proteinPct = rec.proteinTargetVal > 0 ? Math.min(150, (sumMacro(foodToday, "protein_g") / rec.proteinTargetVal) * 100) : 0;
    document.getElementById("home-cal-progress-label").textContent = ` ${round(kcalEaten)} / ${round(rec.calorieTargetVal)} kcal`;
    document.getElementById("home-protein-progress-label").textContent = ` ${round(sumMacro(foodToday, "protein_g"))} / ${round(rec.proteinTargetVal)} g`;
    const calFill = document.getElementById("home-cal-fill");
    calFill.style.width = `${Math.min(100, calPct)}%`;
    calFill.classList.toggle("over-target", calPct > 100);
    const proteinFill = document.getElementById("home-protein-fill");
    proteinFill.style.width = `${Math.min(100, proteinPct)}%`;
    proteinFill.classList.toggle("over-target", proteinPct > 100);

    // net calories detail
    const balance = Calc.balanceVsMaintenance(kcalEaten, kcalBurned, rec.maintenance);
    document.getElementById("home-net-detail").innerHTML = `
      <p>Eaten <strong>${round(kcalEaten)} kcal</strong> &minus; burned <strong>${round(kcalBurned)} kcal</strong> = net <strong>${round(net)} kcal</strong>.</p>
      <p class="hint">Compared to your maintenance estimate (${round(rec.maintenance)} kcal/day): ${balance >= 0 ? "+" : ""}${round(balance)} kcal today.</p>
    `;

    // workout summary detail
    document.getElementById("home-workout-detail").innerHTML = isUnder19()
      ? `<p class="hint">Workout estimates are available for ages 19 and over.</p>`
      : `<p>${workoutToday.length} workout${workoutToday.length === 1 ? "" : "s"} logged today &mdash; ${minutesToday} min total, ${round(kcalBurned)} kcal burned.</p>`;

    renderDisclaimer();
  }

  function sumMacro(entries, key) {
    return entries.reduce((acc, e) => acc + (e[key] || 0), 0);
  }

  function statCard(label, value, explain) {
    return `<div class="stat-card"><div class="stat-value">${escapeHtml(value)}</div><div class="stat-label">${escapeHtml(label)}</div><div class="stat-explain">${escapeHtml(explain)}</div></div>`;
  }

  function renderDisclaimer() {
    let html = `
      <p>These figures are estimates for general guidance, not medical advice. Consult a doctor or registered dietitian before changing your diet or exercise, especially if you have a medical condition.</p>
      <p>Singapore meals: Yeo et al. (2021), Foods 10(7):1659.</p>
      <p>Activity MET values: 2024 Adult Compendium of Physical Activities.</p>
      <p>This app is not endorsed by or affiliated with the authors, MDPI, or the Compendium team.</p>
    `;
    if (isAge60Plus()) {
      html += `<p>Recommendations use age 59 for users aged 60 and over. This is a simplification for this project.</p>`;
    }
    document.getElementById("home-disclaimer").innerHTML = html;
  }

  function renderMacroChart(foodToday) {
    const protein = sumMacro(foodToday, "protein_g");
    const carbs = sumMacro(foodToday, "carbs_g");
    const fat = sumMacro(foodToday, "fat_g");
    renderOrUpdateChart("chart-macros", {
      type: "bar",
      data: {
        labels: ["Protein", "Carbs", "Fat"],
        datasets: [{ label: "Grams", data: [round(protein), round(carbs), round(fat)], backgroundColor: ["#1f7a53", "#4f8ef7", "#b9532f"] }],
      },
      options: baseChartOptions("Grams"),
    });
    document.getElementById("chart-macros-summary").textContent = `Today: ${round(protein)} g protein, ${round(carbs)} g carbs, ${round(fat)} g fat.`;
  }

  // ======================================================================
  // FOOD VIEW
  // ======================================================================
  function wireFoodView() {
    document.getElementById("food-select").addEventListener("change", onFoodSelectChange);
    document.getElementById("food-grams").addEventListener("input", updateFoodPreview);
    document.getElementById("food-add-btn").addEventListener("click", addFoodEntry);
    document.getElementById("custom-food-form").addEventListener("submit", (ev) => {
      ev.preventDefault();
      const food = {
        id: Store.uid(),
        name: document.getElementById("cf-name").value.trim(),
        kcal: Number(document.getElementById("cf-kcal").value),
        protein_g: Number(document.getElementById("cf-protein").value),
        carbs_g: Number(document.getElementById("cf-carbs").value),
        fat_g: Number(document.getElementById("cf-fat").value),
      };
      if (!food.name) return;
      state.customFoods.push(food);
      Store.save(state);
      ev.target.reset();
      populateFoodSelect();
      const select = document.getElementById("food-select");
      select.value = food.id;
      onFoodSelectChange();
    });
  }

  function populateFoodSelect() {
    const select = document.getElementById("food-select");
    const previousValue = select.value;
    const byCategory = {};
    allFoods().forEach((f) => {
      byCategory[f.category] = byCategory[f.category] || [];
      byCategory[f.category].push(f);
    });
    const categories = Object.keys(byCategory).sort((a, b) => (a === "Custom" ? 1 : b === "Custom" ? -1 : a.localeCompare(b)));
    const optionsHtml = categories
      .map((cat) => {
        const opts = byCategory[cat]
          .map((f) => `<option value="${escapeHtml(f.id)}">${escapeHtml(f.name)}${f.isCustom ? " (custom, unverified)" : ""}</option>`)
          .join("");
        return `<optgroup label="${escapeHtml(cat)}">${opts}</optgroup>`;
      })
      .join("");
    select.innerHTML = `<option value="">Choose a food&hellip;</option>` + optionsHtml;
    if (previousValue && allFoods().some((f) => f.id === previousValue)) select.value = previousValue;
  }

  function onFoodSelectChange() {
    const foodId = document.getElementById("food-select").value;
    if (!foodId) {
      pickedFood = null;
      document.getElementById("food-picked").hidden = true;
      document.getElementById("food-picked-source").textContent = "";
      return;
    }
    const food = allFoods().find((f) => f.id === foodId);
    if (!food) return;
    pickedFood = food;
    document.getElementById("food-picked").hidden = false;
    document.getElementById("food-picked-source").textContent = food.isCustom ? "User-entered, not verified." : food.source;
    document.getElementById("food-grams").value = "";
    document.getElementById("food-live-preview").textContent = "";
  }

  function updateFoodPreview() {
    if (!pickedFood) return;
    const grams = Number(document.getElementById("food-grams").value);
    const box = document.getElementById("food-live-preview");
    if (!grams || grams <= 0) {
      box.textContent = "";
      return;
    }
    const m = Calc.foodMacros(pickedFood.per100g, grams);
    box.textContent = `${round(m.kcal)} kcal · ${fmt(m.protein_g, 1)}g protein · ${fmt(m.carbs_g, 1)}g carbs · ${fmt(m.fat_g, 1)}g fat`;
  }

  function addFoodEntry() {
    if (!pickedFood) return;
    const grams = Number(document.getElementById("food-grams").value);
    if (!grams || grams <= 0) return;
    const m = Calc.foodMacros(pickedFood.per100g, grams);
    state.foodLog.push({
      id: Store.uid(),
      date: Store.todayISO(),
      foodId: pickedFood.isCustom ? null : pickedFood.id,
      customFoodId: pickedFood.isCustom ? pickedFood.id : null,
      name: pickedFood.name,
      grams,
      kcal: m.kcal,
      protein_g: m.protein_g,
      carbs_g: m.carbs_g,
      fat_g: m.fat_g,
    });
    Store.save(state);
    pickedFood = null;
    document.getElementById("food-picked").hidden = true;
    document.getElementById("food-select").value = "";
    document.getElementById("food-picked-source").textContent = "";
    renderFoodView();
    renderHome();
  }

  function renderFoodRecommend(foodToday) {
    if (!state.profile) return;
    const rec = computeRecommendation();
    let html = `
      <div class="stat-card"><div class="stat-value">${round(rec.calorieTargetVal)} kcal</div><div class="stat-label">Calorie target (${escapeHtml(rec.goalLabel)})</div></div>
      <div class="stat-card"><div class="stat-value">${round(rec.proteinTargetVal)} g</div><div class="stat-label">Protein target</div></div>
    `;
    if (rec.p.goal === "lose") {
      html += `<p class="hint">A 500 kcal/day deficit is commonly estimated at about 0.5 kg per week. This is an approximation.</p>`;
    }
    html += `<p class="hint">ISSN position stand (Jäger et al., 2017): 1.4 to 2.0 g/kg/day for exercising adults. Your target is within this range.</p>`;
    if (rec.belowFloor) {
      html += `<div class="floor-warning">Your calorie target is below the commonly cited minimum of ${Calc.calorieFloor(rec.p.sex)} kcal/day for ${rec.p.sex === "male" ? "men" : "women"}. This is a commonly cited minimum, not a clinical rule &mdash; consider discussing with a doctor or dietitian.</div>`;
    }
    document.getElementById("food-recommend").innerHTML = html;
    document.getElementById("food-formula").innerHTML = `
      <p><strong>BMR (Mifflin-St Jeor, 1990)</strong><br/>
      ${rec.p.sex === "male" ? "10 × weight + 6.25 × height − 5 × age + 5" : "10 × weight + 6.25 × height − 5 × age − 161"}
      = ${round(rec.bmrVal)} kcal/day${isAge60Plus() ? " (using age 59)" : ""}</p>
      <p><strong>Maintenance estimate</strong> = BMR × 1.2 (light activity) = ${round(rec.maintenance)} kcal/day</p>
      <p><strong>Calorie target</strong> (${escapeHtml(rec.goalLabel)}) = ${rec.p.goal === "lose" ? "maintenance − 500" : rec.p.goal === "gain" ? "maintenance + 275" : "maintenance"} = ${round(rec.calorieTargetVal)} kcal/day</p>
      <p><strong>Protein target</strong> = ${rec.p.goal === "gain" ? "1.8" : "1.6"} g/kg × ${fmt(rec.p.weight_kg, 1)} kg = ${fmt(rec.proteinTargetVal, 1)} g/day</p>
    `;
    renderMacroChart(foodToday);
  }

  function renderFoodView() {
    populateFoodSelect();
    const entries = todaysEntries(state.foodLog);
    renderFoodRecommend(entries);
    const box = document.getElementById("food-entries-list");
    if (entries.length === 0) {
      box.innerHTML = `<div class="empty-state">No food logged today yet. Choose one above to add your first entry.</div>`;
    } else {
      box.innerHTML = entries
        .map(
          (e) => `
        <div class="entry-row">
          <div class="entry-main">${escapeHtml(e.name)} &mdash; ${fmt(e.grams, 0)} g${e.customFoodId ? ' <span class="badge badge-unverified">User-entered, not verified</span>' : ""}
            <div class="entry-sub">${round(e.kcal)} kcal · P ${fmt(e.protein_g, 1)}g · C ${fmt(e.carbs_g, 1)}g · F ${fmt(e.fat_g, 1)}g</div>
          </div>
          <button class="delete-btn" data-id="${e.id}" aria-label="Delete entry">✕</button>
        </div>`
        )
        .join("");
      box.querySelectorAll(".delete-btn").forEach((btn) =>
        btn.addEventListener("click", () => {
          state.foodLog = state.foodLog.filter((e) => e.id !== btn.dataset.id);
          Store.save(state);
          renderFoodView();
          renderHome();
        })
      );
    }
    renderFood14dChart();
  }

  function renderFood14dChart() {
    const dates = last14Dates();
    const p = state.profile ? effProfile() : null;
    let targetLine = null;
    if (p) {
      const bmrVal = Calc.bmr(p.sex, p.weight_kg, p.height_cm, p.age);
      targetLine = Calc.calorieTarget(p.goal, Calc.maintenanceEstimate(bmrVal));
    }
    const values = dates.map((d) => round(sumKcal(state.foodLog.filter((e) => e.date === d))));
    const datasets = [{ label: "Calories eaten", data: values, backgroundColor: "#1f7a53" }];
    if (targetLine !== null) {
      datasets.push({
        label: "Target",
        type: "line",
        data: dates.map(() => round(targetLine)),
        borderColor: "#b9532f",
        borderDash: [6, 4],
        pointRadius: 0,
        fill: false,
      });
    }
    renderOrUpdateChart("chart-food-14d", {
      type: "bar",
      data: { labels: dates.map(shortDate), datasets },
      options: baseChartOptions("kcal"),
    });
    const total = values.reduce((a, b) => a + b, 0);
    document.getElementById("chart-food-14d-summary").textContent = `Total over last 14 days: ${total} kcal eaten.${targetLine !== null ? ` Daily target: ${round(targetLine)} kcal.` : ""}`;
  }

  // ======================================================================
  // WORKOUT VIEW
  // ======================================================================
  function wireWorkoutView() {
    document.getElementById("workout-select").addEventListener("change", updateWorkoutPreview);
    document.getElementById("workout-minutes").addEventListener("input", updateWorkoutPreview);
    document.getElementById("workout-add-btn").addEventListener("click", addWorkoutEntry);
    document.getElementById("custom-met-form").addEventListener("submit", (ev) => {
      ev.preventDefault();
      const name = document.getElementById("cm-name").value.trim();
      const met = Number(document.getElementById("cm-met").value);
      const minutes = Number(document.getElementById("cm-minutes").value);
      if (!name || !met || !minutes) return;
      const weight = Store.latestWeightOnOrBefore(state, Store.todayISO());
      const kcal = Calc.workoutKcal(met, weight, minutes);
      state.workoutLog.push({
        id: Store.uid(),
        date: Store.todayISO(),
        metCode: null,
        customMet: true,
        name: `${name} (custom)`,
        minutes,
        met,
        kcal,
      });
      Store.save(state);
      ev.target.reset();
      renderWorkoutView();
      renderHome();
    });
  }

  function populateWorkoutSelect() {
    const select = document.getElementById("workout-select");
    const previousValue = select.value;
    const byCategory = {};
    metsData.forEach((m) => {
      byCategory[m.category] = byCategory[m.category] || [];
      byCategory[m.category].push(m);
    });
    select.innerHTML = Object.keys(byCategory)
      .sort()
      .map((cat) => {
        const opts = byCategory[cat]
          .map((m) => `<option value="${escapeHtml(m.code)}">${escapeHtml(m.name)} (${escapeHtml(m.code)})</option>`)
          .join("");
        return `<optgroup label="${escapeHtml(cat)}">${opts}</optgroup>`;
      })
      .join("");
    if (previousValue && metsData.some((m) => m.code === previousValue)) select.value = previousValue;
  }

  function selectedMet() {
    const code = document.getElementById("workout-select").value;
    return metsData.find((m) => m.code === code);
  }

  function updateWorkoutPreview() {
    const m = selectedMet();
    const minutes = Number(document.getElementById("workout-minutes").value);
    document.getElementById("workout-code-hint").innerHTML = m
      ? `Code ${escapeHtml(m.code)} <span class="badge badge-unverified">Unverified</span>`
      : "";
    const box = document.getElementById("workout-live-preview");
    if (!m || !minutes || minutes <= 0) {
      box.textContent = "";
      return;
    }
    const weight = Store.latestWeightOnOrBefore(state, Store.todayISO());
    const kcal = Calc.workoutKcal(m.met, weight, minutes);
    box.textContent = `${round(kcal)} kcal estimated (MET ${m.met} × ${fmt(weight, 1)} kg × ${minutes} min ÷ 60)`;
  }

  function addWorkoutEntry() {
    const m = selectedMet();
    const minutes = Number(document.getElementById("workout-minutes").value);
    if (!m || !minutes || minutes <= 0 || minutes > 600) return;
    const weight = Store.latestWeightOnOrBefore(state, Store.todayISO());
    const kcal = Calc.workoutKcal(m.met, weight, minutes);
    state.workoutLog.push({
      id: Store.uid(),
      date: Store.todayISO(),
      metCode: m.code,
      customMet: false,
      name: m.name,
      minutes,
      met: m.met,
      kcal,
    });
    Store.save(state);
    document.getElementById("workout-minutes").value = "";
    document.getElementById("workout-live-preview").textContent = "";
    renderWorkoutView();
    renderHome();
  }

  function renderWorkoutRecommend() {
    const suggestedMinutes = 30;
    document.getElementById("workout-recommend").innerHTML = `
      <div class="stat-card"><div class="stat-value">${suggestedMinutes} min</div><div class="stat-label">Suggested workout minutes today</div></div>
    `;
    document.getElementById("workout-formula").innerHTML = `
      <p><strong>Suggested workout minutes</strong>: a general guideline of about 150 minutes of moderate activity per week (about 30 minutes most days). Not personalized to your data.</p>
    `;
  }

  function renderWorkoutView() {
    const blocked = isUnder19();
    document.getElementById("workout-blocked-card").hidden = !blocked;
    document.getElementById("workout-recommend-card").hidden = blocked;
    document.getElementById("workout-form-card").hidden = blocked;
    if (blocked) {
      document.getElementById("workout-entries-list").innerHTML = "";
      renderWorkout14dChart();
      return;
    }
    renderWorkoutRecommend();
    populateWorkoutSelect();

    const entries = todaysEntries(state.workoutLog);
    const box = document.getElementById("workout-entries-list");
    if (entries.length === 0) {
      box.innerHTML = `<div class="empty-state">No workouts logged today yet.</div>`;
    } else {
      box.innerHTML = entries
        .map(
          (e) => `
        <div class="entry-row">
          <div class="entry-main">${escapeHtml(e.name)}${e.customMet ? ' <span class="badge badge-unverified">User-supplied, not verified</span>' : ' <span class="badge badge-unverified">Unverified</span>'}
            <div class="entry-sub">${e.minutes} min · MET ${e.met} · ${round(e.kcal)} kcal</div>
          </div>
          <button class="delete-btn" data-id="${e.id}" aria-label="Delete entry">✕</button>
        </div>`
        )
        .join("");
      box.querySelectorAll(".delete-btn").forEach((btn) =>
        btn.addEventListener("click", () => {
          state.workoutLog = state.workoutLog.filter((e) => e.id !== btn.dataset.id);
          Store.save(state);
          renderWorkoutView();
          renderHome();
        })
      );
    }
    renderWorkout14dChart();
  }

  function renderWorkout14dChart() {
    const dates = last14Dates();
    const values = dates.map((d) => round(sumKcal(state.workoutLog.filter((e) => e.date === d))));
    renderOrUpdateChart("chart-workout-14d", {
      type: "bar",
      data: { labels: dates.map(shortDate), datasets: [{ label: "Kcal burned", data: values, backgroundColor: "#4f8ef7" }] },
      options: baseChartOptions("kcal"),
    });
    const total = values.reduce((a, b) => a + b, 0);
    document.getElementById("chart-workout-14d-summary").textContent = `Total over last 14 days: ${total} kcal burned from workouts.`;
  }

  // ======================================================================
  // WEIGHT VIEW
  // ======================================================================
  function wireWeightView() {
    document.getElementById("weight-date").value = Store.todayISO();
    document.getElementById("weight-value").addEventListener("input", updateBmiPreview);
    document.getElementById("weight-save-btn").addEventListener("click", () => {
      const date = document.getElementById("weight-date").value;
      const weight = Number(document.getElementById("weight-value").value);
      if (!date || !weight || weight < 30 || weight > 300) return;
      Store.setWeightEntry(state, date, weight);
      Store.save(state);
      document.getElementById("weight-value").value = "";
      document.getElementById("weight-bmi-box").textContent = "";
      renderWeightView();
      renderHome();
    });
  }

  function updateBmiPreview() {
    if (!state.profile) return;
    const weight = Number(document.getElementById("weight-value").value);
    const box = document.getElementById("weight-bmi-box");
    if (!weight) {
      box.textContent = "";
      return;
    }
    const b = Calc.bmi(weight, state.profile.height_cm);
    box.textContent = `BMI ${fmt(b, 1)} (${Calc.bmiCategory(b)}) — a rough reference, not a diagnosis.`;
  }

  function renderWeightView() {
    const sorted = state.weightLog.slice().sort((a, b) => b.date.localeCompare(a.date));
    const box = document.getElementById("weight-entries-list");
    if (sorted.length === 0) {
      box.innerHTML = `<div class="empty-state">No weight entries yet. Log your weight above.</div>`;
    } else {
      box.innerHTML = sorted
        .map((e) => {
          const b = state.profile ? Calc.bmi(e.weight_kg, state.profile.height_cm) : null;
          return `
        <div class="entry-row">
          <div class="entry-main">${escapeHtml(e.date)} &mdash; ${fmt(e.weight_kg, 1)} kg
            ${b !== null ? `<div class="entry-sub">BMI ${fmt(b, 1)} (${Calc.bmiCategory(b)})</div>` : ""}
          </div>
          <button class="delete-btn" data-date="${e.date}" aria-label="Delete entry">✕</button>
        </div>`;
        })
        .join("");
      box.querySelectorAll(".delete-btn").forEach((btn) =>
        btn.addEventListener("click", () => {
          state.weightLog = state.weightLog.filter((e) => e.date !== btn.dataset.date);
          Store.save(state);
          renderWeightView();
          renderHome();
        })
      );
    }
    renderWeightChart();
  }

  function renderWeightChart() {
    const sorted = state.weightLog.slice().sort((a, b) => a.date.localeCompare(b.date));
    const points = sorted.map((e) => ({ date: e.date, value: e.weight_kg }));
    const ma = Calc.movingAverage(points, 7);
    renderOrUpdateChart("chart-weight", {
      type: "line",
      data: {
        labels: points.map((p) => shortDate(p.date)),
        datasets: [
          { label: "Weight (kg)", data: points.map((p) => p.value), borderColor: "#1f7a53", backgroundColor: "#1f7a53", tension: 0.15 },
          { label: "7-day moving average", data: ma.map((p) => Number(p.value.toFixed(1))), borderColor: "#b9532f", backgroundColor: "#b9532f", tension: 0.15, borderDash: [6, 4] },
        ],
      },
      options: baseChartOptions("kg"),
    });
    const summary =
      points.length === 0
        ? "No weight data yet."
        : `${points.length} entr${points.length === 1 ? "y" : "ies"} logged. Latest: ${fmt(points[points.length - 1].value, 1)} kg.`;
    document.getElementById("chart-weight-summary").textContent = summary;
  }

  // ======================================================================
  // chart helpers
  // ======================================================================
  function shortDate(iso) {
    const [, m, d] = iso.split("-");
    return `${m}/${d}`;
  }

  function baseChartOptions(yLabel) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { title: { display: true, text: yLabel }, beginAtZero: true },
        x: { title: { display: true, text: "Date" } },
      },
      plugins: { legend: { display: true } },
    };
  }

  function renderOrUpdateChart(canvasId, config) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    if (typeof Chart === "undefined") return; // Chart.js failed to load (e.g. offline); page still works.
    try {
      if (charts[canvasId]) {
        charts[canvasId].data = config.data;
        charts[canvasId].options = config.options;
        charts[canvasId].update();
      } else {
        const existing = Chart.getChart(canvas);
        if (existing) existing.destroy();
        charts[canvasId] = new Chart(canvas.getContext("2d"), config);
      }
    } catch (e) {
      console.error(`Chart "${canvasId}" could not be rendered.`, e);
      delete charts[canvasId];
      const existing = Chart.getChart(canvas);
      if (existing) existing.destroy();
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
