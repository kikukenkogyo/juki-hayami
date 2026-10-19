// juki.json の形を検査する。エラー文の配列を返す（空なら合格）
export const VALUE_KEYS = [
  "mass_t", "width_mm", "height_mm", "length_mm", "crawler_width_mm", "tail_radius_mm",
  "ground_pressure_kpa", "max_work_height_mm", "max_reach_mm", "max_dig_depth_mm", "crane_capacity_t",
];

export function validate(machines) {
  const errors = [];
  const seen = new Set();
  for (const m of machines) {
    const id = `${m.no ?? "番号なし"} ${m.name}`;
    if (m.no !== null && !Number.isInteger(m.no)) errors.push(`${id}: no が整数でない`);
    if (m.no !== null) {
      if (seen.has(m.no)) errors.push(`${id}: 管理番号が重複`);
      seen.add(m.no);
    }
    for (const k of ["name", "spec", "maker"]) if (typeof m[k] !== "string") errors.push(`${id}: ${k} が文字でない`);
    if (typeof m.class !== "number") errors.push(`${id}: class が数値でない`);
    for (const [k, c] of Object.entries(m.values ?? {})) {
      if (!VALUE_KEYS.includes(k)) { errors.push(`${id}: 知らない項目 ${k}`); continue; }
      if (c.v !== null && typeof c.v !== "number") errors.push(`${id}: ${k} の値が数値でない`);
      if (typeof c.note !== "string" || typeof c.check !== "boolean") errors.push(`${id}: ${k} の note/check の形が違う`);
      if (c.v === null && !c.note) errors.push(`${id}: ${k} が空なのに注記がない`);
    }
    if (m.values?.crane_capacity_t && !m.spec.includes("クレーン")) errors.push(`${id}: クレーン仕様でないのに crane_capacity_t がある`);
    if (!Array.isArray(m.source)) errors.push(`${id}: source が配列でない`);
    for (const p of m.images ?? []) if (!p.startsWith("img/")) errors.push(`${id}: 画像パス ${p} が img/ で始まらない`);
  }
  return errors;
}

// ---- アタッチメント（att.json） ----
export const ATT_KEYS = [
  "mass_kg", "length_mm", "width_mm", "height_mm", "open_mm", "force_kn", "blows_per_min", "chisel_mm",
  "base_t", "oil_lpm", "pressure_mpa", "rotation", "pipes",
];
export const KINDS = ["圧砕", "SRC", "小割", "カッター", "ブレーカ", "つかみ", "その他"];
const ROTATION = ["有", "無", "フリー"];

const isNum = (x) => typeof x === "number" && Number.isFinite(x);
function badValue(k, v) {
  if (v === null || isNum(v)) return false;
  if (k === "rotation") return !ROTATION.includes(v);
  return !(Array.isArray(v) && v.length === 2 && v.every(isNum) && v[0] <= v[1]);
}

// allowDupUnits: Notion で番号が重なっているのを承知で載せる管理番号（2026-10-20 酒井さん了承）
export function validateAtts(atts, allowDupUnits = []) {
  const errors = [];
  const ids = new Set(), units = new Map();
  for (const m of atts) {
    const id = `${m.id} ${m.name}`;
    if (typeof m.id !== "string" || !/^[a-z0-9-]+$/.test(m.id)) errors.push(`${id}: id は英小文字・数字・-のみ`);
    if (ids.has(m.id)) errors.push(`${id}: id が重複`);
    ids.add(m.id);
    for (const k of ["name", "maker", "memo"]) if (typeof m[k] !== "string") errors.push(`${id}: ${k} が文字でない`);
    if (!KINDS.includes(m.kind)) errors.push(`${id}: kind ${m.kind} が種類にない`);
    if (!isNum(m.class)) errors.push(`${id}: class が数値でない`);
    if (!Array.isArray(m.units) || !m.units.length || !m.units.every(Number.isInteger)) errors.push(`${id}: units が管理番号の配列でない`);
    for (const u of new Set(m.units ?? [])) {
      if (units.has(u) && !allowDupUnits.includes(u)) errors.push(`${id}: 管理番号 ${u} が ${units.get(u)} と重複`);
      units.set(u, m.id);
    }
    if (typeof m.catalog !== "boolean") errors.push(`${id}: catalog が true/false でない`);
    for (const [k, c] of Object.entries(m.values ?? {})) {
      if (!ATT_KEYS.includes(k)) { errors.push(`${id}: 知らない項目 ${k}`); continue; }
      if (badValue(k, c.v)) errors.push(`${id}: ${k} の値の形が違う`);
      if (typeof c.note !== "string" || typeof c.check !== "boolean") errors.push(`${id}: ${k} の note/check の形が違う`);
      if (c.v === null && !c.note) errors.push(`${id}: ${k} が空なのに注記がない`);
    }
    if (!Array.isArray(m.source)) errors.push(`${id}: source が配列でない`);
    else if (m.catalog === false && m.source.length) errors.push(`${id}: カタログなしなのに出典がある`);
    for (const p of m.images ?? []) if (!p.startsWith("img/att-")) errors.push(`${id}: 画像パス ${p} が img/att- で始まらない`);
  }
  return errors;
}
