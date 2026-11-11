import { test } from "node:test";
import assert from "node:assert/strict";
import { jukiLocations, attLocations } from "../tools/locations.mjs";
import fs from "node:fs";
import { isFree, jukiPlace, attPlaces, placeSummary } from "../lib.js";

const sel = (name) => ({ type: "select", select: name ? { name } : null });
const num = (n) => ({ type: "number", number: n });
const rt = (s) => ({ type: "rich_text", rich_text: s ? [{ plain_text: s }] : [] });
const fm = (s) => ({ type: "formula", formula: { type: "string", string: s } });

test("重機: 管理番号と所在地を取り出す（空の所在は入れない）", () => {
  const pages = [
    { properties: { 管理番号: num(1), 所在地: sel("置き場") } },
    { properties: { 管理番号: num(5), 所在地: sel("東京大学（本郷）工学部13号館改修工事") } },
    { properties: { 管理番号: num(9), 所在地: sel(null) } },
    { properties: { 管理番号: num(null), 所在地: sel("工場") } },
  ];
  assert.deepEqual(jukiLocations(pages), { 1: "置き場", 5: "東京大学（本郷）工学部13号館改修工事" });
});

test("アタッチメント: 名前と A-001 と所在（現在地が空なら所在地、どちらも空なら null）", () => {
  const pages = [
    { properties: { 管理番号: rt("A-002"), 名称: rt("SV24"), 現在地: fm(""), 所在地: sel("置場") } },
    { properties: { 管理番号: rt("A-001"), 名称: rt("TS-W1800V"), 現在地: fm("九段南"), 所在地: sel("工場") } },
    { properties: { 管理番号: rt("A-003"), 名称: rt("MR900"), 現在地: fm(""), 所在地: sel(null) } },
  ];
  assert.deepEqual(attLocations(pages), [
    { code: "A-001", name: "TS-W1800V", loc: "九段南" },
    { code: "A-002", name: "SV24", loc: "置場" },
    { code: "A-003", name: "MR900", loc: null },
  ]);
});

const locs = {
  juki: { 1: "置き場", 5: "九段南" },
  att: [
    { code: "A-010", name: "SV-24XR（5本配管）", loc: "工場" },
    { code: "A-011", name: "SV24", loc: "奥沢中" },
    { code: "A-012", name: "SV24", loc: "工場" },
    { code: "A-025", name: "TS-W950V①", loc: "工場" },
    { code: "A-026", name: "TS-W950V②", loc: null },
  ],
};

test("アタッチメント: 現在地の絵文字（🏭🟢🚧）は外す", () => {
  const pg = (s) => ({ properties: { 管理番号: rt("A-001"), 名称: rt("X"), 現在地: fm(s), 所在地: sel(null) } });
  assert.deepEqual(attLocations(["🏭 工場", "🟢 置場", "🚧 🏭 工場", "🚧 その他（修理屋等）"].map(pg)).map((r) => r.loc),
    ["工場", "置場", "工場", "その他（修理屋等）"]);
});

test("空いている＝置き場・置場・工場・アキコ", () => {
  for (const l of ["置き場", "置場", "工場", "アキコ"]) assert.ok(isFree(l));
  for (const l of ["九段南", "和光建機", "メーカー", null]) assert.ok(!isFree(l));
});
test("jukiPlace: 番号で引く、番号なし・所在なしは null", () => {
  assert.equal(jukiPlace({ no: 5 }, locs), "九段南");
  assert.equal(jukiPlace({ no: 2 }, locs), null);
  assert.equal(jukiPlace({ no: null }, locs), null);
  assert.equal(jukiPlace({ no: 1 }, null), null);
});
test("attPlaces: Notion の番号（A-001→1）でつなぎ、名前も確かめる", () => {
  assert.deepEqual(attPlaces({ name: "SV-24XR（5本配管）", units: [10] }, locs), [{ code: "A-010", loc: "工場" }]);
  assert.deepEqual(attPlaces({ name: "SV24", units: [11, 12] }, locs).map((p) => p.loc), ["奥沢中", "工場"]);
  // ①② と（）は外して比べる
  assert.deepEqual(attPlaces({ name: "TS-W950V（シリンダーカバーなし）", units: [25] }, locs), [{ code: "A-025", loc: "工場" }]);
  assert.deepEqual(attPlaces({ name: "TS-W950V", units: [26] }, locs), [{ code: "A-026", loc: null }]);
  // 番号が振り直されて別の台になっていたら、所在は出さない
  assert.deepEqual(attPlaces({ name: "MR900", units: [11] }, locs), [{ code: "A-011", loc: null, mismatch: "SV24" }]);
  assert.deepEqual(attPlaces({ name: "MR900", units: [99] }, locs), [{ code: "A-099", loc: null, missing: true }]);
  assert.deepEqual(attPlaces({ name: "SV24", units: [11] }, null), [{ code: "A-011", loc: null, missing: true }]);
});
test("実データ: att.json の名前と管理番号の形", () => {
  const atts = JSON.parse(fs.readFileSync("att.json", "utf8"));
  const all = atts.flatMap((a) => a.units);
  assert.equal(new Set(all).size, all.length, "管理番号の重なりがない");
  assert.deepEqual([...all].sort((x, y) => x - y), Array.from({ length: 91 }, (_, i) => i + 1), "A-001〜A-091 が1台ずつ");
});
test("placeSummary", () => {
  assert.equal(placeSummary([{ loc: "工場" }]), "工場");
  assert.equal(placeSummary([{ loc: "工場" }, { loc: null }, { loc: "工場" }, { loc: "九段南" }]), "工場2・九段南1・不明1");
});
