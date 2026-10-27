import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { parseLength, parseMass, judgeMachine } from "../lib.js";

const c = (v) => ({ v, note: "", check: false });
const M = ({ width = 2320, height = 2600, mass = 7.5, tail = 1300 } = {}) => ({
  no: 1, name: "x", class: 0.25, spec: "", values: { width_mm: c(width), height_mm: c(height), mass_t: c(mass), tail_radius_mm: c(tail) },
});
const S = (o) => ({ pass: null, height: null, mass: null, site: null, ...o });

test("parseLength: mm・メートル・声で入れた書き方", () => {
  assert.equal(parseLength("2400"), 2400);
  assert.equal(parseLength("２，４００"), 2400);
  assert.equal(parseLength("2400mm"), 2400);
  assert.equal(parseLength("2400ミリ"), 2400);
  assert.equal(parseLength("2.4"), 2400);
  assert.equal(parseLength("2.4m"), 2400);
  assert.equal(parseLength("2.4メートル"), 2400);
  assert.equal(parseLength("240cm"), 2400);
  assert.equal(parseLength("240センチ"), 2400);
  assert.equal(parseLength(""), null);
  assert.equal(parseLength("あ"), null);
});
test("parseMass: t・トン・kg", () => {
  assert.equal(parseMass("8"), 8);
  assert.equal(parseMass("8t"), 8);
  assert.equal(parseMass("8トン"), 8);
  assert.equal(parseMass("8000"), 8);
  assert.equal(parseMass("8000kg"), 8);
  assert.equal(parseMass("8,000キロ"), 8);
  assert.equal(parseMass(""), null);
});
test("条件なしなら判定しない", () => assert.equal(judgeMachine(M(), S({})), null));
test("幅: 余裕300以上○、300未満△、ちょうどは△（余裕0）、超えたら×", () => {
  assert.equal(judgeMachine(M({ width: 2000 }), S({ pass: 2400 })).status, "ok");
  const r = judgeMachine(M({ width: 2320 }), S({ pass: 2400 }));
  assert.equal(r.status, "tight");
  assert.equal(r.reasons[0].text, "幅2,320／余裕80");
  assert.equal(judgeMachine(M({ width: 2100 }), S({ pass: 2400 })).status, "ok");
  assert.equal(judgeMachine(M({ width: 2400 }), S({ pass: 2400 })).status, "tight");
  const ng = judgeMachine(M({ width: 2490 }), S({ pass: 2400 }));
  assert.equal(ng.status, "ng");
  assert.equal(ng.reasons[0].text, "幅2,490／90オーバー");
});
test("重さは○か×だけ", () => {
  const r = judgeMachine(M({ mass: 7.9 }), S({ mass: 8 }));
  assert.equal(r.status, "ok");
  assert.equal(r.reasons[0].text, "重さ7.9t／余裕0.1t");
  assert.equal(judgeMachine(M({ mass: 8.2 }), S({ mass: 8 })).status, "ng");
});
test("作業場所: 後ろ半径が幅の半分に収まるか、片側150未満は△", () => {
  const r = judgeMachine(M({ tail: 1610 }), S({ site: 4000 }));
  assert.equal(r.status, "ok");
  assert.equal(r.reasons[0].text, "後ろ半径1,610／片側余裕390");
  assert.equal(judgeMachine(M({ tail: 1900 }), S({ site: 4000 })).status, "tight");
  assert.equal(judgeMachine(M({ tail: 2100 }), S({ site: 4000 })).status, "ng");
});
test("空欄は？、×があれば×が勝つ", () => {
  const u = judgeMachine(M({ width: null }), S({ pass: 2400 }));
  assert.equal(u.status, "unknown");
  assert.equal(u.reasons[0].text, "幅不明");
  assert.equal(judgeMachine(M({ width: null, height: 3500 }), S({ pass: 2400, height: 3000 })).status, "ng");
  assert.equal(judgeMachine(M({ width: 2320, height: null }), S({ pass: 2400, height: 3000 })).status, "unknown");
});
test("実データ: 幅2400で×にならないのは空欄4台を含む12台、○△は8台", () => {
  const data = JSON.parse(fs.readFileSync("juki.json", "utf8"));
  const rs = data.map((m) => judgeMachine(m, S({ pass: 2400 })).status);
  assert.equal(rs.filter((s) => s === "ok" || s === "tight").length, 8);
  assert.equal(rs.filter((s) => s === "unknown").length, 4);
});
