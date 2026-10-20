// Pure calculation functions for the health tracker. No DOM, no localStorage.
// Loaded as a plain script (defines window.Calc) so it works with no build step.
(function (global) {
  "use strict";

  const MAX_EFFECTIVE_AGE = 59;

  function effectiveAge(age) {
    return Math.min(age, MAX_EFFECTIVE_AGE);
  }

  // Mifflin-St Jeor (1990). Returns unrounded kcal/day.
  function bmr(sex, weightKg, heightCm, age) {
    const age59 = effectiveAge(age);
    const base = 10 * weightKg + 6.25 * heightCm - 5 * age59;
    return sex === "male" ? base + 5 : base - 161;
  }

  // Light-activity maintenance estimate.
  function maintenanceEstimate(bmrValue) {
    return bmrValue * 1.2;
  }

  // kcal burned for one workout entry.
  function workoutKcal(met, bodyWeightKg, minutes) {
    return met * bodyWeightKg * (minutes / 60);
  }

  // Macro grams -> kcal/macros for a given amount of grams of a per-100g food.
  function foodMacros(per100g, grams) {
    const factor = grams / 100;
    return {
      kcal: per100g.kcal * factor,
      protein_g: per100g.protein_g * factor,
      carbs_g: per100g.carbs_g * factor,
      fat_g: per100g.fat_g * factor,
    };
  }

  function calorieTarget(goal, maintenance) {
    if (goal === "lose") return maintenance - 500;
    if (goal === "gain") return maintenance + 275;
    return maintenance; // maintain
  }

  // Returns the floor kcal/day commonly cited for the given sex.
  function calorieFloor(sex) {
    return sex === "male" ? 1500 : 1200;
  }

  function isBelowFloor(sex, calorieTargetValue) {
    return calorieTargetValue < calorieFloor(sex);
  }

  function proteinTarget(goal, weightKg) {
    const perKg = goal === "gain" ? 1.8 : 1.6;
    return perKg * weightKg;
  }

  function netKcal(kcalEaten, kcalBurned) {
    return kcalEaten - kcalBurned;
  }

  function balanceVsMaintenance(kcalEaten, kcalBurned, maintenance) {
    return kcalEaten - kcalBurned - maintenance;
  }

  function bmi(weightKg, heightCm) {
    const heightM = heightCm / 100;
    return weightKg / (heightM * heightM);
  }

  function bmiCategory(bmiValue) {
    if (bmiValue < 18.5) return "Underweight";
    if (bmiValue < 25) return "Normal";
    if (bmiValue < 30) return "Overweight";
    return "Obese";
  }

  // Simple trailing moving average over a sorted-by-date array of {date, value}.
  function movingAverage(points, windowSize) {
    return points.map((p, i) => {
      const start = Math.max(0, i - windowSize + 1);
      const slice = points.slice(start, i + 1);
      const sum = slice.reduce((acc, x) => acc + x.value, 0);
      return { date: p.date, value: sum / slice.length };
    });
  }

  const Calc = {
    MAX_EFFECTIVE_AGE,
    effectiveAge,
    bmr,
    maintenanceEstimate,
    workoutKcal,
    foodMacros,
    calorieTarget,
    calorieFloor,
    isBelowFloor,
    proteinTarget,
    netKcal,
    balanceVsMaintenance,
    bmi,
    bmiCategory,
    movingAverage,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = Calc;
  } else {
    global.Calc = Calc;
  }
})(typeof window !== "undefined" ? window : globalThis);
