// Storage layer: localStorage persistence, schema validation, import/export.
// Depends on nothing else. Defines window.Store.
(function (global) {
  "use strict";

  const STORAGE_KEY = "healthTracker.v1";
  const SCHEMA_VERSION = 1;

  function emptyState() {
    return {
      schemaVersion: SCHEMA_VERSION,
      profile: null, // set after onboarding
      foodLog: [], // {id, date, foodId, customFoodId, name, grams, kcal, protein_g, carbs_g, fat_g}
      workoutLog: [], // {id, date, metCode, customMet, name, minutes, met, kcal}
      weightLog: [], // {date, weight_kg} - one per date
      customFoods: [], // {id, name, kcal, protein_g, carbs_g, fat_g}
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return emptyState();
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return emptyState();
      return Object.assign(emptyState(), parsed);
    } catch (e) {
      console.error("Failed to load stored data, starting fresh.", e);
      return emptyState();
    }
  }

  function save(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function todayISO() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function uid() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  // ---- Profile validation ----
  function validateProfile(p) {
    const errors = [];
    if (p.sex !== "male" && p.sex !== "female") errors.push("Sex must be male or female.");
    if (!Number.isInteger(p.age) || p.age < 13 || p.age > 100) errors.push("Age must be a whole number from 13 to 100.");
    if (typeof p.height_cm !== "number" || p.height_cm < 100 || p.height_cm > 230) errors.push("Height must be 100 to 230 cm.");
    if (typeof p.weight_kg !== "number" || p.weight_kg < 30 || p.weight_kg > 300) errors.push("Weight must be 30 to 300 kg.");
    if (!["lose", "gain", "maintain"].includes(p.goal)) errors.push("Goal must be lose, gain, or maintain.");
    return errors;
  }

  // ---- Import validation ----
  function isFiniteNumber(v) {
    return typeof v === "number" && Number.isFinite(v);
  }

  function validateImport(data) {
    const errors = [];
    if (!data || typeof data !== "object") return ["File is not a valid JSON object."];
    if (data.schemaVersion !== SCHEMA_VERSION) {
      errors.push(`Unsupported schemaVersion (expected ${SCHEMA_VERSION}, got ${JSON.stringify(data.schemaVersion)}).`);
      return errors; // no point checking further
    }
    if (!data.profile || typeof data.profile !== "object") {
      errors.push("Missing profile.");
    } else {
      errors.push(...validateProfile(data.profile).map((e) => `profile: ${e}`));
    }
    if (!Array.isArray(data.foodLog)) errors.push("foodLog must be an array.");
    else
      data.foodLog.forEach((e, i) => {
        if (typeof e.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(e.date)) errors.push(`foodLog[${i}]: invalid date.`);
        if (!isFiniteNumber(e.grams) || e.grams <= 0) errors.push(`foodLog[${i}]: invalid grams.`);
        if (!isFiniteNumber(e.kcal) || e.kcal < 0) errors.push(`foodLog[${i}]: invalid kcal.`);
      });
    if (!Array.isArray(data.workoutLog)) errors.push("workoutLog must be an array.");
    else
      data.workoutLog.forEach((e, i) => {
        if (typeof e.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(e.date)) errors.push(`workoutLog[${i}]: invalid date.`);
        if (!isFiniteNumber(e.minutes) || e.minutes <= 0 || e.minutes > 600) errors.push(`workoutLog[${i}]: invalid minutes.`);
        if (!isFiniteNumber(e.met) || e.met <= 0) errors.push(`workoutLog[${i}]: invalid met.`);
      });
    if (!Array.isArray(data.weightLog)) errors.push("weightLog must be an array.");
    else
      data.weightLog.forEach((e, i) => {
        if (typeof e.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(e.date)) errors.push(`weightLog[${i}]: invalid date.`);
        if (!isFiniteNumber(e.weight_kg) || e.weight_kg < 30 || e.weight_kg > 300) errors.push(`weightLog[${i}]: invalid weight_kg.`);
      });
    if (!Array.isArray(data.customFoods)) errors.push("customFoods must be an array.");
    else
      data.customFoods.forEach((e, i) => {
        if (typeof e.name !== "string" || !e.name.trim()) errors.push(`customFoods[${i}]: invalid name.`);
        ["kcal", "protein_g", "carbs_g", "fat_g"].forEach((f) => {
          if (!isFiniteNumber(e[f]) || e[f] < 0) errors.push(`customFoods[${i}]: invalid ${f}.`);
        });
      });
    return errors;
  }

  function exportPayload(state) {
    return {
      schemaVersion: SCHEMA_VERSION,
      profile: state.profile,
      foodLog: state.foodLog,
      workoutLog: state.workoutLog,
      weightLog: state.weightLog,
      customFoods: state.customFoods,
    };
  }

  // date string "YYYY-MM-DD" comparison
  function mergeStates(current, incoming) {
    const merged = emptyState();
    merged.profile = current.profile || incoming.profile;

    merged.customFoods = [...current.customFoods];
    incoming.customFoods.forEach((f) => {
      if (!merged.customFoods.find((x) => x.id === f.id)) merged.customFoods.push(f);
    });

    merged.foodLog = [...current.foodLog];
    incoming.foodLog.forEach((e) => {
      if (!merged.foodLog.find((x) => x.id === e.id)) merged.foodLog.push(e);
    });

    merged.workoutLog = [...current.workoutLog];
    incoming.workoutLog.forEach((e) => {
      if (!merged.workoutLog.find((x) => x.id === e.id)) merged.workoutLog.push(e);
    });

    // Weight: one entry per date, keep the newer entry (by position in incoming wins on tie).
    const byDate = new Map();
    current.weightLog.forEach((e) => byDate.set(e.date, e));
    incoming.weightLog.forEach((e) => byDate.set(e.date, e)); // incoming treated as newer
    merged.weightLog = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));

    return merged;
  }

  function setWeightEntry(state, date, weightKg) {
    const idx = state.weightLog.findIndex((e) => e.date === date);
    if (idx >= 0) state.weightLog[idx] = { date, weight_kg: weightKg };
    else state.weightLog.push({ date, weight_kg: weightKg });
    state.weightLog.sort((a, b) => a.date.localeCompare(b.date));
  }

  function latestWeightOnOrBefore(state, date) {
    const candidates = state.weightLog.filter((e) => e.date <= date).sort((a, b) => b.date.localeCompare(a.date));
    if (candidates.length > 0) return candidates[0].weight_kg;
    return state.profile ? state.profile.weight_kg : null;
  }

  const Store = {
    STORAGE_KEY,
    SCHEMA_VERSION,
    emptyState,
    load,
    save,
    todayISO,
    uid,
    validateProfile,
    validateImport,
    exportPayload,
    mergeStates,
    setWeightEntry,
    latestWeightOnOrBefore,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = Store;
  } else {
    global.Store = Store;
  }
})(typeof window !== "undefined" ? window : globalThis);
