// アタッチメントの台（管理番号）を Notion の台帳に合わせる
// 使い方: node tools/att_sync.mjs <locations.json> [--apply]
//   locations.json は公開中のもの（https://kikukenkogyo.github.io/juki-hayami/locations.json）を保存して使う
//   --apply なしは違いを見せるだけ。--apply で att.json と tools/att_mapping.json の units を書きかえ、
//   Notion に1台も無い機種は外す（外す前に、酒井さんに一覧を見せて確認すること）
// 名前でつなぐ（（）の中まで同じ→（）と①②を外して同じ）。決められない台は tools/att_sync_pins.json で
// { "A-025": "機種の id" } と決めておく
import fs from "node:fs";
import { attKey } from "../lib.js";

const [file, flag] = process.argv.slice(2);
if (!file) { console.error("locations.json を指定してください"); process.exit(1); }
const rows = JSON.parse(fs.readFileSync(file, "utf8")).att;
const atts = JSON.parse(fs.readFileSync("att.json", "utf8"));
const mapping = JSON.parse(fs.readFileSync("tools/att_mapping.json", "utf8"));
const pins = JSON.parse(fs.readFileSync("tools/att_sync_pins.json", "utf8"));
const num = (code) => Number(code.match(/\d+/)[0]);

const units = new Map(atts.map((a) => [a.id, []]));
const problems = [];
for (const r of rows) {
  let ids = pins[r.code] ? [pins[r.code]]
    : atts.filter((a) => attKey(a.name) === attKey(r.name)).map((a) => a.id);
  if (!ids.length) ids = atts.filter((a) => attKey(a.name, true) === attKey(r.name, true)).map((a) => a.id);
  if (ids.length !== 1) { problems.push(`${r.code} ${r.name}: ${ids.length ? "候補が2つ以上 " + ids.join("・") : "早見表に同じ名前が無い"}`); continue; }
  units.get(ids[0]).push(num(r.code));
}
const gone = atts.filter((a) => !units.get(a.id).length);
for (const a of atts) {
  const now = units.get(a.id).sort((x, y) => x - y);
  if (now.length && now.join() !== a.units.join()) console.log(`${a.name}: ${a.units.length}台 → ${now.length}台（${now.map((n) => "A-" + String(n).padStart(3, "0")).join("・")}）`);
}
console.log(`\nNotion に無い機種（外す候補）: ${gone.map((a) => a.name).join("・") || "なし"}`);
console.log(`決められない台: ${problems.length ? "\n  " + problems.join("\n  ") : "なし"}`);

if (flag === "--apply") {
  if (problems.length) { console.error("\n決められない台があるので書きかえません（att_sync_pins.json で決める）"); process.exit(1); }
  const keep = (x) => units.get(x.id).length;
  const fix = (x) => ({ ...x, units: units.get(x.id).sort((p, q) => p - q) });
  fs.writeFileSync("att.json", JSON.stringify(atts.filter(keep).map(fix), null, 1));
  fs.writeFileSync("tools/att_mapping.json", JSON.stringify(mapping.filter(keep).map(fix), null, 1));
  console.log(`\n書きかえました: ${atts.filter(keep).length}機種・${rows.length}台`);
}
