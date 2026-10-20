// Unit tests for js/data.js. Run with: node js/data.test.js
// data.js uses localStorage/window when present; provide minimal stubs for Node.
global.window = undefined;
const assert = require("assert");
const Store = require("./data.js");

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

function validProfile(overrides) {
  return Object.assign({ sex: "male", age: 30, height_cm: 175, weight_kg: 70, goal: "lose", nickname: "" }, overrides || {});
}

test("validateProfile accepts a valid profile", () => {
  assert.deepStrictEqual(Store.validateProfile(validProfile()), []);
});

test("validateProfile rejects age 12", () => {
  const errors = Store.validateProfile(validProfile({ age: 12 }));
  assert.ok(errors.length > 0);
});

test("validateProfile rejects height 50", () => {
  const errors = Store.validateProfile(validProfile({ height_cm: 50 }));
  assert.ok(errors.length > 0);
});

test("validateProfile rejects weight 0", () => {
  const errors = Store.validateProfile(validProfile({ weight_kg: 0 }));
  assert.ok(errors.length > 0);
});

test("validateProfile rejects missing sex", () => {
  const errors = Store.validateProfile(validProfile({ sex: null }));
  assert.ok(errors.length > 0);
});

function validPayload() {
  return {
    schemaVersion: Store.SCHEMA_VERSION,
    profile: validProfile(),
    foodLog: [{ id: "f1", date: "2026-01-01", grams: 100, kcal: 100, protein_g: 1, carbs_g: 1, fat_g: 1, name: "x" }],
    workoutLog: [{ id: "w1", date: "2026-01-01", minutes: 30, met: 5, kcal: 100, name: "x" }],
    weightLog: [{ date: "2026-01-01", weight_kg: 70 }],
    customFoods: [],
  };
}

test("validateImport accepts a valid payload", () => {
  assert.deepStrictEqual(Store.validateImport(validPayload()), []);
});

test("validateImport rejects wrong schemaVersion", () => {
  const p = validPayload();
  p.schemaVersion = 99;
  assert.ok(Store.validateImport(p).length > 0);
});

test("validateImport rejects negative weight", () => {
  const p = validPayload();
  p.weightLog[0].weight_kg = -5;
  assert.ok(Store.validateImport(p).length > 0);
});

test("validateImport rejects missing field (profile)", () => {
  const p = validPayload();
  delete p.profile;
  assert.ok(Store.validateImport(p).length > 0);
});

test("mergeStates keeps the newer (imported) entry for a duplicate weight date", () => {
  const current = Store.emptyState();
  current.weightLog = [{ date: "2026-01-01", weight_kg: 70 }];
  const incoming = Store.emptyState();
  incoming.weightLog = [{ date: "2026-01-01", weight_kg: 72 }];
  const merged = Store.mergeStates(current, incoming);
  assert.strictEqual(merged.weightLog.find((e) => e.date === "2026-01-01").weight_kg, 72);
});

test("mergeStates unions food/workout logs without duplicating by id", () => {
  const current = Store.emptyState();
  current.foodLog = [{ id: "a", date: "2026-01-01" }];
  const incoming = Store.emptyState();
  incoming.foodLog = [{ id: "a", date: "2026-01-01" }, { id: "b", date: "2026-01-02" }];
  const merged = Store.mergeStates(current, incoming);
  assert.strictEqual(merged.foodLog.length, 2);
});

test("setWeightEntry replaces an existing entry for the same date", () => {
  const state = Store.emptyState();
  Store.setWeightEntry(state, "2026-01-01", 70);
  Store.setWeightEntry(state, "2026-01-01", 71);
  assert.strictEqual(state.weightLog.length, 1);
  assert.strictEqual(state.weightLog[0].weight_kg, 71);
});

test("latestWeightOnOrBefore falls back to profile weight if no log entries", () => {
  const state = Store.emptyState();
  state.profile = validProfile({ weight_kg: 65 });
  assert.strictEqual(Store.latestWeightOnOrBefore(state, "2026-01-01"), 65);
});

test("latestWeightOnOrBefore picks the most recent entry on or before the date", () => {
  const state = Store.emptyState();
  state.profile = validProfile({ weight_kg: 65 });
  state.weightLog = [
    { date: "2026-01-01", weight_kg: 70 },
    { date: "2026-01-10", weight_kg: 68 },
  ];
  assert.strictEqual(Store.latestWeightOnOrBefore(state, "2026-01-05"), 70);
  assert.strictEqual(Store.latestWeightOnOrBefore(state, "2026-01-15"), 68);
});

console.log(`\n${passed} test(s) passed.`);
