// 2回読みで食い違った値などを tools/resolve.json の決定どおりに直す（何度流しても同じ結果になる）
import fs from "node:fs";
import { validate } from "./schema.mjs";

const r = JSON.parse(fs.readFileSync("tools/resolve.json", "utf8"));
const data = JSON.parse(fs.readFileSync("juki.json", "utf8"));
const byNo = new Map(data.map((m) => [m.no, m]));
for (const [no, key, v, note] of r.set) byNo.get(no).values[key] = { v, note, check: false };
for (const [no, src] of Object.entries(r.source ?? {})) byNo.get(Number(no)).source = src;
for (const [no, text] of Object.entries(r.caution)) {
  const m = byNo.get(Number(no));
  if (text) m.caution = text; else delete m.caution;
}
const left = data.flatMap((m) => Object.entries(m.values).filter(([, c]) => c.check).map(([k]) => `${m.no} ${k}`));
fs.writeFileSync("juki.json", JSON.stringify(data, null, 1));
console.log("errors", validate(data), "check残り", left);
