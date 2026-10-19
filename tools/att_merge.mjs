// 注意: 一度だけ使う道具。流し直すと att_resolve・画像の結果が消えるので、作り直すとき以外は使わない（その後 att_resolve.mjs → make_images.py … att を流す）
// アタッチメントの1回目・2回目の読み取りをまとめて突き合わせ、att.json の下書きを作る
// 使い方: node tools/att_merge.mjs <passフォルダ>
import fs from "node:fs";
import { compare } from "./compare.mjs";
import { ATT_KEYS, validateAtts } from "./schema.mjs";

const dir = process.argv[2];
const load = (p) => [1, 2, 3, 4].flatMap((g) => JSON.parse(fs.readFileSync(`${dir}/${p}${g}.json`, "utf8")));
const a = load("A"), b = load("B");
fs.writeFileSync("tools/att_pass_a.json", JSON.stringify(a, null, 1));
fs.writeFileSync("tools/att_pass_b.json", JSON.stringify(b, null, 1));

const mapping = JSON.parse(fs.readFileSync("tools/att_mapping.json", "utf8"));
const merged = new Map(compare(a, b, (m) => m.id).map((m) => [m.id, m]));
const out = mapping.map((mp) => {
  const m = merged.get(mp.id);
  if (mp.pdfs.length && !m) throw new Error(`${mp.id} の読み取りが無い`);
  const values = m?.values ?? Object.fromEntries(ATT_KEYS.map((k) => [k, { v: null, note: "カタログなし", check: false }]));
  return {
    id: mp.id, name: mp.name, kind: mp.kind, class: mp.class, maker: mp.maker, units: mp.units, memo: mp.memo,
    catalog: Boolean(m), ...(mp.caution ? { caution: mp.caution } : {}),
    values, source: m?.source ?? [], images: [],
  };
});
fs.writeFileSync("att.json", JSON.stringify(out, null, 1));
const dup = JSON.parse(fs.readFileSync("tools/att_resolve.json", "utf8")).allowDupUnits ?? [];
console.log("atts", out.length, "errors", validateAtts(out, dup));
for (const m of out) for (const [k, c] of Object.entries(m.values)) if (c.check) console.log(`${m.id}\t${k}\t${JSON.stringify(c.v)}\t${c.note}`);
