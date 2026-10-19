import { test } from "node:test";
import assert from "node:assert/strict";
import { normalize, parseLimit, filterMachines, sortMachines, formatValue } from "../lib.js";

const c = (v) => ({ v, note: v === null ? "カタログに記載なし" : "", check: false });
const M = (no, name, cls, spec, width = 2490, height = 2900, mass = 20) => ({
  no, name, class: cls, spec, maker: "", values: { width_mm: c(width), height_mm: c(height), mass_t: c(mass) }, source: [], images: [],
});
const list = [
  M(14, "ＰＣ228US-3②", 0.7, "スタンダード", 2800),
  M(27, "PC228US-10⑤", 0.7, "スタンダード", 2800),
  M(26, "ZX75US-3②（ショート）", 0.25, "ショートリーチ", 2320),
  M(3, "SK350DLC-9②（ロング）", 1.2, "超ロングブーム", 3190),
  M(33, "ZX20U-5A", 0.1, "スタンダード", null),
];
const none = { query: "", classes: [], maxWidth: null, maxHeight: null, maxMass: null };
const names = (r) => r.map((m) => m.no);

test("normalize は全角→半角・小文字・空白除去", () => assert.equal(normalize("ＰＣ２２８ US"), "pc228us"));
test("pc228 で全角表記の機種も出る", () => {
  assert.deepEqual(names(filterMachines(list, { ...none, query: "pc228" }).hits).sort(), [14, 27]);
  assert.deepEqual(names(filterMachines(list, { ...none, query: "ＰＣ228" }).hits).sort(), [14, 27]);
});
test("管理番号で検索（26 と 026）", () => {
  assert.ok(names(filterMachines(list, { ...none, query: "26" }).hits).includes(26));
  assert.ok(names(filterMachines(list, { ...none, query: "026" }).hits).includes(26));
});
test("仕様で検索", () => assert.deepEqual(names(filterMachines(list, { ...none, query: "ロング" }).hits), [3]));
test("クラス絞り込み", () => {
  assert.deepEqual(names(filterMachines(list, { ...none, classes: [0.7, 1.2] }).hits).sort((a, b) => a - b), [3, 14, 27]);
  assert.equal(filterMachines(list, none).hits.length, 5);
});
test("全幅の条件: 超えるものは除外、null は unknown", () => {
  const r = filterMachines(list, { ...none, maxWidth: 2500 });
  assert.deepEqual(names(r.hits), [26]);
  assert.deepEqual(names(r.unknown), [33]);
});
test("条件なしなら unknown は空", () => assert.deepEqual(filterMachines(list, none).unknown, []));
test("parseLimit", () => {
  assert.equal(parseLimit("２５００"), 2500);
  assert.equal(parseLimit("2.5"), 2.5);
  assert.equal(parseLimit(""), null);
  assert.equal(parseLimit("2.5m"), null);
});
test("sortMachines: クラス順→番号順、番号なしは同クラスの最後", () => {
  const s = sortMachines([M(30, "a", 0.45, ""), M(null, "b", 0.25, ""), M(26, "c", 0.25, ""), M(6, "d", 0.25, "")]);
  assert.deepEqual(s.map((m) => m.name), ["d", "c", "b", "a"]);
});
test("formatValue", () => {
  assert.equal(formatValue("mass_t", c(7.45)), "7.5 t");
  assert.equal(formatValue("width_mm", c(2490)), "2,490 mm");
  assert.equal(formatValue("ground_pressure_kpa", c(37)), "37 kPa");
  assert.equal(formatValue("width_mm", c(null)), "カタログに記載なし");
  assert.equal(formatValue("width_mm", undefined), "カタログに記載なし");
  assert.equal(formatValue("width_mm", { v: 2490, note: "", check: true }), "2,490 mm ⚠要確認");
});

import { detailNote } from "../lib.js";

test("parseLimit: カンマと単位付きも数値（指摘4）", () => {
  assert.equal(parseLimit("2,500"), 2500);
  assert.equal(parseLimit("２，５００"), 2500);
  assert.equal(parseLimit("2500mm"), 2500);
  assert.equal(parseLimit("2.5t"), 2.5);
  assert.equal(parseLimit("2.5m"), null);
  assert.equal(parseLimit("あ"), null);
});
test("detailNote: 空欄でも参考値の注記は出す（指摘1）", () => {
  assert.equal(detailNote({ v: null, note: "カタログに記載なし", check: false }), "");
  assert.equal(detailNote({ v: null, note: "参考: 標準機33,600kg", check: false }), "参考: 標準機33,600kg");
  assert.equal(detailNote({ v: 2490, note: "輸送時", check: false }), "輸送時");
  assert.equal(detailNote(undefined), "");
});
test("formatValue: 空欄でも要確認なら⚠を残す（軽微5）", () => {
  assert.equal(formatValue("width_mm", { v: null, note: "x", check: true }), "カタログに記載なし ⚠要確認");
});
