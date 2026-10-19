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

// ---- アタッチメント（第2弾） ----
import { validateAtts, ATT_KEYS, KINDS } from "../tools/schema.mjs";

const att = (over = {}) => ({
  id: "ts-w1100v-arts", name: "TS-W1100V ARTS", kind: "圧砕", class: 0.7, maker: "オカダ",
  units: [18, 19], memo: "", catalog: true,
  values: {
    mass_kg: { v: 2100, note: "", check: false },
    oil_lpm: { v: [150, 250], note: "", check: false },
    rotation: { v: "有", note: "", check: false },
    open_mm: { v: null, note: "カタログに記載なし", check: false },
  },
  source: [{ file: "a.pdf", page: 1, where: "仕様表" }],
  images: ["img/att-ts-w1100v-arts-1.jpg"],
  ...over,
});
const vals = (k, v, note = "") => ({ ...att().values, [k]: { v, note, check: false } });

test("ATT_KEYS と KINDS の中身", () => {
  assert.equal(ATT_KEYS.length, 13);
  assert.deepEqual(KINDS, ["圧砕", "SRC", "小割", "カッター", "ブレーカ", "つかみ", "その他"]);
});
test("正しいアタッチメントは合格", () => assert.deepEqual(validateAtts([att()]), []));
test("id は英小文字・数字・-のみ", () => {
  assert.equal(validateAtts([att({ id: "TS-W1100" })]).length, 1);
  assert.equal(validateAtts([att({ id: "マグナム" })]).length, 1);
});
test("id の重複はエラー", () => {
  assert.ok(validateAtts([att(), att({ units: [30] })]).some((e) => e.includes("id")));
});
test("管理番号が機種をまたいで重複したらエラー（許可リスト以外）", () => {
  assert.ok(validateAtts([att(), att({ id: "b", units: [19] })]).some((e) => e.includes("19")));
  assert.deepEqual(validateAtts([att(), att({ id: "b", units: [19] })], [19]), []);
});
test("kind が KINDS 以外はエラー", () => assert.equal(validateAtts([att({ kind: "クラッシャー" })]).length, 1));
test("範囲は [小,大] の2つだけ", () => {
  assert.deepEqual(validateAtts([att({ values: vals("oil_lpm", [150, 250]) })]), []);
  assert.equal(validateAtts([att({ values: vals("oil_lpm", [250, 150]) })]).length, 1);
  assert.equal(validateAtts([att({ values: vals("oil_lpm", [1]) })]).length, 1);
});
test("文字の値は rotation だけ", () => {
  assert.deepEqual(validateAtts([att({ values: vals("rotation", "フリー") })]), []);
  assert.equal(validateAtts([att({ values: vals("rotation", "回る") })]).length, 1);
  assert.equal(validateAtts([att({ values: vals("mass_kg", "2100") })]).length, 1);
});
test("知らない項目はエラー", () => assert.equal(validateAtts([att({ values: vals("mass_t", 2) })]).length, 1));
test("null なのに注記が空はエラー", () => assert.equal(validateAtts([att({ values: vals("open_mm", null, "") })]).length, 1));
test("カタログなしなのに出典があるとエラー", () => {
  assert.equal(validateAtts([att({ catalog: false, images: [] })]).length, 1);
  assert.deepEqual(validateAtts([att({ catalog: false, source: [], images: [] })]), []);
});
test("画像は img/att- で始まる", () => assert.equal(validateAtts([att({ images: ["img/001-1.jpg"] })]).length, 1));
