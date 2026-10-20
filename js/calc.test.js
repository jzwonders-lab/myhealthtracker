// Unit tests for js/calc.js. Run with: node js/calc.test.js
const assert = require("assert");
const Calc = require("./calc.js");

function approx(actual, expected, tolerance, msg) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${msg}: expected ${expected}, got ${actual}`);
}

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`PASS: ${name}`);
  } catch (e) {
    console.log(`FAIL: ${name} -- ${e.message}`);
    process.exitCode = 1;
  }
}

test("effectiveAge caps at 59", () => {
  assert.strictEqual(Calc.effectiveAge(65), 59);
  assert.strictEqual(Calc.effectiveAge(30), 30);
  assert.strictEqual(Calc.effectiveAge(59), 59);
});

test("BMR male 70kg/175cm/30 -> 1649 rounded", () => {
  const bmr = Calc.bmr("male", 70, 175, 30);
  approx(bmr, 1648.75, 0.001, "BMR male");
  assert.strictEqual(Math.round(bmr), 1649);
});

test("BMR female 70kg/175cm/30 -> 1483 rounded", () => {
  const bmr = Calc.bmr("female", 70, 175, 30);
  approx(bmr, 1482.75, 0.001, "BMR female");
  assert.strictEqual(Math.round(bmr), 1483);
});

test("BMR age 65 == BMR age 59 (age-60 simplification)", () => {
  const bmr65 = Calc.bmr("male", 70, 175, 65);
  const bmr59 = Calc.bmr("male", 70, 175, 59);
  assert.strictEqual(bmr65, bmr59);
  assert.strictEqual(Math.round(bmr65), 1504);
});

test("Workout kcal: MET 5.0, 70kg, 60min -> 350", () => {
  assert.strictEqual(Calc.workoutKcal(5.0, 70, 60), 350);
});

test("Workout kcal: MET 5.0, 70kg, 30min -> 175", () => {
  assert.strictEqual(Calc.workoutKcal(5.0, 70, 30), 175);
});

test("Food macros: 150g of 200kcal/100g -> 300 kcal", () => {
  const m = Calc.foodMacros({ kcal: 200, protein_g: 10, carbs_g: 20, fat_g: 5 }, 150);
  assert.strictEqual(m.kcal, 300);
  assert.strictEqual(m.protein_g, 15);
});

test("Goal targets from maintenance 1979 (BMR 1648.75 x 1.2)", () => {
  const bmr = Calc.bmr("male", 70, 175, 30);
  const maintenance = Calc.maintenanceEstimate(bmr);
  assert.strictEqual(Math.round(maintenance), 1979);
  assert.strictEqual(Math.round(Calc.calorieTarget("lose", maintenance)), 1479);
  assert.strictEqual(Math.round(Calc.calorieTarget("gain", maintenance)), 2254);
  assert.strictEqual(Math.round(Calc.calorieTarget("maintain", maintenance)), 1979);
});

test("Floor warnings", () => {
  assert.strictEqual(Calc.isBelowFloor("female", 1199), true);
  assert.strictEqual(Calc.isBelowFloor("female", 1200), false);
  assert.strictEqual(Calc.isBelowFloor("male", 1499), true);
  assert.strictEqual(Calc.isBelowFloor("male", 1500), false);
});

test("Protein targets at 70kg: lose/maintain 112g, gain 126g", () => {
  assert.strictEqual(Calc.proteinTarget("lose", 70), 112);
  assert.strictEqual(Calc.proteinTarget("maintain", 70), 112);
  assert.strictEqual(Calc.proteinTarget("gain", 70), 126);
});

test("Net kcal and balance vs maintenance", () => {
  assert.strictEqual(Calc.netKcal(2000, 300), 1700);
  assert.strictEqual(Calc.balanceVsMaintenance(2000, 300, 1979), -279);
});

test("BMI and category", () => {
  const b = Calc.bmi(70, 175);
  approx(b, 22.86, 0.01, "BMI");
  assert.strictEqual(Calc.bmiCategory(17), "Underweight");
  assert.strictEqual(Calc.bmiCategory(22), "Normal");
  assert.strictEqual(Calc.bmiCategory(27), "Overweight");
  assert.strictEqual(Calc.bmiCategory(32), "Obese");
});

test("Moving average over empty and real data", () => {
  assert.deepStrictEqual(Calc.movingAverage([], 7), []);
  const points = [1, 2, 3].map((v, i) => ({ date: `d${i}`, value: v }));
  const ma = Calc.movingAverage(points, 2);
  assert.strictEqual(ma[0].value, 1);
  assert.strictEqual(ma[1].value, 1.5);
  assert.strictEqual(ma[2].value, 2.5);
});

console.log(`\n${passed} test(s) passed.`);
