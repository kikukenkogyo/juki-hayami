import { test } from "node:test";
import assert from "node:assert/strict";
import { jukiLocations, jukiStates, attLocations } from "../tools/locations.mjs";
import fs from "node:fs";
import { isFree, jukiPlace, attPlaces, placeSummary, readState, jukiState, attStateSummary } from "../lib.js";

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

// ---- 使えるかどうか（Notion の状態） ----
test("jukiStates: 現在状態・最新報告区分・修理予定を取り出す（報告なしの台は入れない）", () => {
  const pages = [
    { properties: { 管理番号: num(2), 現在状態: fm("🟡 不良"), 最新報告区分: fm("🟡 要観察（使用可）"), 修理予定: { type: "rollup", rollup: { type: "array", array: [rt("福住現場終了後修理予定")] } } } },
    { properties: { 管理番号: num(3), 現在状態: fm(""), 最新報告区分: fm("") } },
  ];
  assert.deepEqual(jukiStates(pages), { 2: { state: "🟡 不良", last: "🟡 要観察（使用可）", plan: "福住現場終了後修理予定", date: "" } });
});
test("readState: 絵文字を外して 正常/不良/故障/修理中 に分ける。正常なら昔の故障内容は出さない", () => {
  assert.deepEqual(readState(""), { level: "ok", label: "正常", detail: "故障報告なし" });
  assert.deepEqual(readState("🟡 不良", "🔵 修理依頼中", "現場完了後"), { level: "warn", label: "不良", detail: "修理依頼中・現場完了後" });
  assert.deepEqual(readState("🔴 故障", "故障（使用不可）", "爪が破損"), { level: "ng", label: "故障（使用不可）", detail: "爪が破損" });
  assert.deepEqual(readState("🔧 修理中", "修理中", ""), { level: "repair", label: "修理中", detail: "" });
  assert.deepEqual(readState("🟢 正常", "復旧完了", "亀裂"), { level: "ok", label: "正常", detail: "復旧完了" });
});
test("jukiState: 報告の無い台は正常、所在を読めていなければ出さない", () => {
  const l = { jukiState: { 6: { state: "🔴 故障", last: "🔴 故障（使用不可）", plan: "" } } };
  assert.equal(jukiState({ no: 6 }, l).level, "ng");
  assert.equal(jukiState({ no: 7 }, l).label, "正常");
  assert.equal(jukiState({ no: 6 }, null), null);
});
test("attStateSummary: 全部正常なら全台正常、そうでなければ悪い台だけ", () => {
  const p = (code, level, label) => ({ code, state: { level, label } });
  assert.deepEqual(attStateSummary([p("A-016", "ok", "正常"), p("A-017", "ng", "故障"), p("A-018", "warn", "不良")]),
    { level: "ng", text: "A-017 故障・A-018 不良" });
  assert.deepEqual(attStateSummary([p("A-016", "ok", "正常"), p("A-019", "ok", "正常")]), { level: "ok", text: "全台正常" });
  assert.deepEqual(attStateSummary([p("A-001", "repair", "修理中")]), { level: "repair", text: "修理中" });
  assert.equal(attStateSummary([{ code: "A-001" }]), null);
});
test("attPlaces: 状態の入った台は state も付く", () => {
  const l = { att: [{ code: "A-017", name: "TS-W1100V ARTS", loc: "工場", state: "🔴 故障", last: "故障（使用不可）", trouble: "爪が破損" }] };
  assert.deepEqual(attPlaces({ name: "TS-W1100V ARTS", units: [17] }, l),
    [{ code: "A-017", loc: "工場", state: { level: "ng", label: "故障（使用不可）", detail: "爪が破損" } }]);
});
