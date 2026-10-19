import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { validateAtts } from "../tools/schema.mjs";

const atts = JSON.parse(fs.readFileSync("att.json", "utf8"));
const mapping = JSON.parse(fs.readFileSync("tools/att_mapping.json", "utf8"));
const { allowDupUnits } = JSON.parse(fs.readFileSync("tools/att_resolve.json", "utf8"));
const CLASSES = [0.1, 0.25, 0.45, 0.7, 1.2, 1.6];

test("att.json は形の検査に合格", () => assert.deepEqual(validateAtts(atts, allowDupUnits), []));
test("台帳の台数が抜けていない（対応表と同じ機種・台数）", () => {
  assert.deepEqual(atts.map((a) => a.id), mapping.map((m) => m.id));
  const count = (xs) => xs.reduce((s, x) => s + x.units.length, 0);
  assert.equal(count(atts), count(mapping));
  assert.equal(count(atts), 103);
});
test("クラスはボタンの6種類のどれか", () => {
  for (const a of atts) assert.ok(CLASSES.includes(a.class), `${a.id} ${a.class}`);
});
test("画像が実在し、カタログありの機種は画像が1枚以上", () => {
  for (const a of atts) {
    for (const p of a.images) assert.ok(fs.existsSync(p), p);
    if (a.catalog) assert.ok(a.images.length > 0, a.id);
  }
});
test("要確認が残っていない", () => {
  const left = atts.flatMap((a) => Object.entries(a.values).filter(([, c]) => c.check).map(([k]) => `${a.id} ${k}`));
  assert.deepEqual(left, []);
});
test("カタログありの機種は対応表で PDF がある機種と一致", () => {
  for (const a of atts) assert.equal(a.catalog, mapping.find((m) => m.id === a.id).pdfs.length > 0, a.id);
});
