// 1回目・2回目の読み取りをまとめて突き合わせ、juki.json の下書きを作る
// 使い方: node tools/merge.mjs <passフォルダ>
import fs from "node:fs";
import { compare } from "./compare.mjs";
import { VALUE_KEYS, validate } from "./schema.mjs";

const dir = process.argv[2];
const load = (p) => [1, 2, 3, 4].flatMap((g) => JSON.parse(fs.readFileSync(`${dir}/${p}${g}.json`, "utf8")));
const a = load("A"), b = load("B");
fs.writeFileSync("tools/pass_a.json", JSON.stringify(a, null, 1));
fs.writeFileSync("tools/pass_b.json", JSON.stringify(b, null, 1));

const mapping = JSON.parse(fs.readFileSync("tools/mapping.json", "utf8"));
const merged = compare(a, b);
const out = mapping.map((mp) => {
  const m = merged.find((x) => x.no === mp.no);
  const base = m ?? {
    no: mp.no, name: mp.name, class: mp.class, spec: mp.spec, maker: mp.maker,
    values: Object.fromEntries(VALUE_KEYS.filter((k) => k !== "crane_capacity_t")
      .map((k) => [k, { v: null, note: "カタログに記載なし", check: false }])),
    source: [],
  };
  const caution = mp.caution || (mp.pdfs.length ? "" : "この機種のカタログが手元にありません");
  return { ...base, ...(caution ? { caution } : {}), images: [] };
});
fs.writeFileSync("juki.json", JSON.stringify(out, null, 1));
const errs = validate(out);
console.log("machines", out.length, "errors", errs.length, errs.slice(0, 10));
for (const m of out) for (const [k, c] of Object.entries(m.values)) if (c.check) console.log(`${m.no}\t${k}\t${c.v}\t${c.note}`);
