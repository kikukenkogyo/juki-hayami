// 2回読みで食い違った値などを tools/att_resolve.json の決定どおりに直す（何度流しても同じ結果になる）
import fs from "node:fs";
import { validateAtts } from "./schema.mjs";

const r = JSON.parse(fs.readFileSync("tools/att_resolve.json", "utf8"));
const data = JSON.parse(fs.readFileSync("att.json", "utf8"));
const byId = new Map(data.map((m) => [m.id, m]));
for (const [id, key, v, note] of r.set) byId.get(id).values[key] = { v, note, check: false };
for (const [id, src] of Object.entries(r.source ?? {})) byId.get(id).source = src;
const left = data.flatMap((m) => Object.entries(m.values).filter(([, c]) => c.check).map(([k]) => `${m.id} ${k}`));
fs.writeFileSync("att.json", JSON.stringify(data, null, 1));
console.log("errors", validateAtts(data, r.allowDupUnits ?? []), "check残り", left);
