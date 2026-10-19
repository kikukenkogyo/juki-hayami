// 2回読みで食い違った値を tools/resolve.json の決定どおりに直す
import fs from "node:fs";
import { validate } from "./schema.mjs";

const r = JSON.parse(fs.readFileSync("tools/resolve.json", "utf8"));
const data = JSON.parse(fs.readFileSync("juki.json", "utf8"));
const byNo = new Map(data.map((m) => [m.no, m]));
for (const [no, key, v, note] of r.set) byNo.get(no).values[key] = { v, note, check: false };
for (const [no, text] of Object.entries(r.caution)) byNo.get(Number(no)).caution = text;
const left = data.flatMap((m) => Object.entries(m.values).filter(([, c]) => c.check).map(([k]) => `${m.no} ${k}`));
fs.writeFileSync("juki.json", JSON.stringify(data, null, 1));
console.log("errors", validate(data), "check残り", left);
