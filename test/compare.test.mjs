import { test } from "node:test";
import assert from "node:assert/strict";
import { compare } from "../tools/compare.mjs";

const m = (vals) => [{ no: 6, name: "ZX75", class: 0.25, spec: "", maker: "日立",
  values: Object.fromEntries(Object.entries(vals).map(([k, v]) => [k, { v, note: v === null ? "カタログに記載なし" : "", check: false }])),
  source: [], images: [] }];

test("同じ値は check:false", () => {
  const r = compare(m({ width_mm: 2490 }), m({ width_mm: 2490 }));
  assert.deepEqual(r[0].values.width_mm, { v: 2490, note: "", check: false });
});
test("食い違いは1回目の値で check:true と2回目を注記", () => {
  const r = compare(m({ width_mm: 2490 }), m({ width_mm: 2400 }));
  assert.equal(r[0].values.width_mm.v, 2490);
  assert.equal(r[0].values.width_mm.check, true);
  assert.ok(r[0].values.width_mm.note.endsWith("（2回目: 2400）"));
});
test("片方だけ null は check:true", () => {
  const r = compare(m({ width_mm: 2490 }), m({ width_mm: null }));
  assert.equal(r[0].values.width_mm.check, true);
});
test("2回目に無い台は例外", () => {
  const b = m({}); b[0].no = 7;
  assert.throws(() => compare(m({}), b));
});

// ---- アタッチメント: id で突き合わせ、範囲値も比べる ----
const a = (v) => [{ id: "sv-36x", name: "SV-36X", values: { oil_lpm: { v, note: "", check: false } }, source: [] }];
test("範囲値が同じなら check:false", () => {
  const r = compare(a([150, 250]), a([150, 250]), (m) => m.id);
  assert.equal(r[0].values.oil_lpm.check, false);
});
test("範囲値が違えば check:true と2回目を注記", () => {
  const r = compare(a([150, 250]), a([150, 240]), (m) => m.id);
  assert.equal(r[0].values.oil_lpm.check, true);
  assert.ok(r[0].values.oil_lpm.note.endsWith("（2回目: 150,240）"));
});
