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
