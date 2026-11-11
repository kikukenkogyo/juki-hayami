import { test } from "node:test";
import assert from "node:assert/strict";
import { jukiLocations, attLocations } from "../tools/locations.mjs";
import { isFree, jukiPlace, matchAttPlaces, placeSummary } from "../lib.js";

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
test("matchAttPlaces: 名前でつなぐ（（）の中まで同じ→（）を外して）、①②は外す、取り合いは shared", () => {
  const atts = [
    { id: "a", name: "SV-24XR（5本配管）" }, { id: "b", name: "SV24" },
    { id: "c", name: "TS-W950V（シリンダーカバーなし）" }, { id: "d", name: "TS-W950V" }, { id: "e", name: "MR1800" },
  ];
  const m = matchAttPlaces(atts, locs);
  assert.deepEqual(m.get("a"), [{ code: "A-010", loc: "工場", shared: false }]);
  assert.deepEqual(m.get("b").map((r) => r.loc), ["奥沢中", "工場"]);
  assert.deepEqual(m.get("c").map((r) => [r.code, r.shared]), [["A-025", true], ["A-026", true]]);
  assert.deepEqual(m.get("d").map((r) => r.code), ["A-025", "A-026"]);
  assert.deepEqual(m.get("e"), []);
});
test("placeSummary", () => {
  assert.equal(placeSummary([{ loc: "工場" }]), "工場");
  assert.equal(placeSummary([{ loc: "工場" }, { loc: null }, { loc: "工場" }, { loc: "九段南" }]), "工場2・九段南1・不明1");
});
