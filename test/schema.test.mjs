import { test } from "node:test";
import assert from "node:assert/strict";
import { validate, VALUE_KEYS } from "../tools/schema.mjs";

const ok = () => ({
  no: 26, name: "ZX75US-3②（ショート）", class: 0.25, spec: "ショートリーチ", maker: "日立",
  values: {
    mass_t: { v: 7.5, note: "", check: false },
    width_mm: { v: 2320, note: "", check: false },
    length_mm: { v: null, note: "カタログに記載なし", check: false },
  },
  source: [{ file: "a.pdf", page: 2, where: "主要諸元表" }],
  images: ["img/026-1.jpg"],
});

test("正しい1台は合格", () => assert.deepEqual(validate([ok()]), []));
test("VALUE_KEYS は11項目", () => assert.equal(VALUE_KEYS.length, 11));
test("値が文字列ならエラー", () => {
  const m = ok(); m.values.width_mm.v = "2490";
  assert.ok(validate([m]).some(e => e.includes("width_mm")));
});
test("知らない項目キーはエラー", () => {
  const m = ok(); m.values.color = { v: 1, note: "", check: false };
  assert.ok(validate([m]).length > 0);
});
test("v:null で note が空ならエラー", () => {
  const m = ok(); m.values.length_mm.note = "";
  assert.ok(validate([m]).some(e => e.includes("length_mm")));
});
test("クレーン以外で crane_capacity_t はエラー", () => {
  const m = ok(); m.values.crane_capacity_t = { v: 2.9, note: "", check: false };
  assert.ok(validate([m]).length > 0);
  m.spec = "クレーン仕様";
  assert.deepEqual(validate([m]), []);
});
test("管理番号の重複はエラー、null同士は可", () => {
  assert.ok(validate([ok(), ok()]).length > 0);
  const a = ok(), b = ok(); a.no = null; b.no = null; b.name = "別";
  assert.deepEqual(validate([a, b]), []);
});
test("画像パスが img/ で始まらないとエラー", () => {
  const m = ok(); m.images = ["026-1.jpg"];
  assert.ok(validate([m]).length > 0);
});
