import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { validate } from "../tools/schema.mjs";

const data = JSON.parse(fs.readFileSync("juki.json", "utf8"));
const CLASSES = [0.1, 0.25, 0.45, 0.7, 1.2, 1.6];

test("juki.json は34台で形の検査に合格", () => {
  assert.equal(data.length, 34);
  assert.deepEqual(validate(data), []);
});
test("クラスはボタンの6種類のどれか（軽微8）", () => {
  for (const m of data) assert.ok(CLASSES.includes(m.class), `${m.no} ${m.class}`);
});
test("画像ファイルが実在する（軽微8）", () => {
  for (const m of data) for (const p of m.images) assert.ok(fs.existsSync(p), p);
});
