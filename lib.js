// 検索・絞り込み・並べ替え・表示の整形（画面には触らない）

export function normalize(s) {
  return String(s ?? "").normalize("NFKC").toLowerCase().replace(/\s+/g, "");
}

// 「2,500」「2500mm」「2.5t」のようなカンマ・単位付きも数値として読む
export function parseLimit(input) {
  const s = normalize(input).replace(/,/g, "").replace(/(mm|t)$/, "");
  if (s === "" || !/^\d+(\.\d+)?$/.test(s)) return null;
  return Number(s);
}

const pad3 = (no) => String(no).padStart(3, "0");

function matchesQuery(m, q) {
  if (!q) return true;
  const hay = [m.name, m.spec, m.maker, m.no ?? "", m.no == null ? "" : pad3(m.no)].map(normalize).join("|");
  return hay.includes(q);
}

export function filterMachines(machines, cond) {
  const q = normalize(cond.query);
  const limits = [["width_mm", cond.maxWidth], ["height_mm", cond.maxHeight], ["mass_t", cond.maxMass]]
    .filter(([, lim]) => lim !== null && lim !== undefined);
  const hits = [], unknown = [];
  for (const m of machines) {
    if (!matchesQuery(m, q)) continue;
    if (cond.classes.length && !cond.classes.includes(m.class)) continue;
    let ok = true, missing = false;
    for (const [k, lim] of limits) {
      const v = m.values[k]?.v;
      if (v === null || v === undefined) missing = true;
      else if (v > lim) ok = false;
    }
    if (!ok) continue;
    (missing ? unknown : hits).push(m);
  }
  return { hits, unknown };
}

export function sortMachines(machines) {
  return [...machines].sort((a, b) =>
    a.class - b.class || (a.no ?? Infinity) - (b.no ?? Infinity));
}

const UNIT = { mass_t: "t", crane_capacity_t: "t", ground_pressure_kpa: "kPa" };

// 詳細画面で値の下に出す注記。空欄の値でも参考値などが書いてあれば出す
export function detailNote(cell) {
  if (!cell || !cell.note || cell.note === "カタログに記載なし") return "";
  return cell.note;
}

export function formatValue(key, cell) {
  if (!cell || cell.v === null || cell.v === undefined) return "カタログに記載なし" + (cell?.check ? " ⚠要確認" : "");
  const unit = UNIT[key] ?? "mm";
  const text = unit === "t" ? (Math.round(cell.v * 10) / 10).toFixed(1) : cell.v.toLocaleString("en-US");
  return `${text} ${unit}` + (cell.check ? " ⚠要確認" : "");
}

// ---- アタッチメント（att.json） ----
export const KINDS = ["圧砕", "SRC", "小割", "カッター", "ブレーカ", "つかみ", "その他"];

function attMatches(a, q) {
  if (!q) return true;
  const hay = [a.name, a.maker, a.kind, a.memo, ...a.units.flatMap((u) => [u, pad3(u)])].map(normalize).join("|");
  return hay.includes(q);
}

// extra: クラスが違っても一覧に入れる機種の id（例: CAT325 に付く SV380）
export function filterAtts(atts, cond) {
  const q = normalize(cond.query);
  const extra = cond.extra ?? [];
  return atts.filter((a) => attMatches(a, q)
    && (!cond.classes.length || cond.classes.includes(a.class) || extra.includes(a.id))
    && (!cond.kinds.length || cond.kinds.includes(a.kind)));
}

// ---- 重機に付くアタッチメント（酒井さんのルール 2026-10-20） ----
// - ふつうの重機: 自分のクラスだけ
// - ビックヘッド・ショートリーチ: 自分のクラス＋1つ上のクラス
// - 例外: 0.25 のショートリーチは 0.25 クラスだけ／CAT325（37番）は 0.7 クラス＋SV380
export const CLASSES = [0.1, 0.25, 0.45, 0.7, 1.2, 1.6];
const FIT_SPECIAL = { 37: { classes: [0.7], extra: ["sv380"], extraNames: ["SV380"] } };

export function attFit(m) {
  if (m.no != null && FIT_SPECIAL[m.no]) return FIT_SPECIAL[m.no];
  const big = /ビックヘッド|ビッグヘッド|ショートリーチ/.test(m.spec ?? "");
  const up = CLASSES[CLASSES.indexOf(m.class) + 1];
  const classes = big && m.class !== 0.25 && up ? [m.class, up] : [m.class];
  return { classes, extra: [], extraNames: [] };
}

// ボタンやお知らせに出す「0.45・0.7㎥」「0.7㎥＋SV380」
export function fitText(fit) {
  return fit.classes.join("・") + "㎥" + fit.extraNames.map((n) => "＋" + n).join("");
}

export function sortAtts(atts) {
  return [...atts].sort((a, b) =>
    a.class - b.class || KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind) || a.name.localeCompare(b.name, "ja"));
}

const ATT_UNIT = { mass_kg: "kg", force_kn: "kN", blows_per_min: "回/分", base_t: "t", oil_lpm: "L/min", pressure_mpa: "MPa", pipes: "本", rotation: "" };
const num = (n) => n.toLocaleString("en-US");

export function formatAttValue(key, cell, catalog = true) {
  if (!cell || cell.v === null || cell.v === undefined) return catalog ? "カタログに記載なし" : "カタログなし";
  const unit = ATT_UNIT[key] ?? "mm";
  const v = cell.v;
  const text = typeof v === "string" ? v : Array.isArray(v) ? `${num(v[0])}〜${num(v[1])}` : num(v);
  return text + (unit ? ` ${unit}` : "") + (cell.check ? " ⚠要確認" : "");
}
