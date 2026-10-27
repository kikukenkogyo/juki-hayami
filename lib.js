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

// ---- 現場条件チェック（2026-10-27 酒井さんと決めた形） ----
// - 通る所の幅↔全幅、高さの制限↔全高、重さの制限↔機械の重さ（アタッチメント抜き）、
//   作業場所の幅↔後端旋回半径（真ん中に置いた目安。半径が幅の半分に収まるか）
// - 余裕が合計300mm未満なら△（作業場所は片側150mm未満）。重さは○か×だけ
// - 数字が空欄の条件は？。印の強さは × ＞ ？ ＞ △ ＞ ○

// 長さ: 「2400」「2,400mm」「2400ミリ」「2.4m」「2.4メートル」。100未満の数はメートルとみなす
export function parseLength(input) {
  const s = normalize(input).replace(/,/g, "");
  const m = s.match(/^(\d+(?:\.\d+)?)(mm|ミリ(?:メートル)?|cm|センチ(?:メートル)?|m|メートル)?$/);
  if (!m) return null;
  const n = Number(m[1]), u = m[2] ?? "";
  if (/^(cm|センチ)/.test(u)) return Math.round(n * 10);
  if (/^(m|メートル)$/.test(u) || (u === "" && n < 100)) return Math.round(n * 1000);
  return n;
}

// 重さ: 「8」「8t」「8トン」「8000kg」。100以上の数はkgとみなす
export function parseMass(input) {
  const s = normalize(input).replace(/,/g, "");
  const m = s.match(/^(\d+(?:\.\d+)?)(t|トン|kg|キロ(?:グラム)?)?$/);
  if (!m) return null;
  const n = Number(m[1]), u = m[2] ?? "";
  return /^(kg|キロ)/.test(u) || (u === "" && n >= 100) ? n / 1000 : n;
}

export const TIGHT_MM = 300;
export const STATUS_ORDER = ["ok", "tight", "unknown", "ng"];
const RANK = { ok: 0, tight: 1, unknown: 2, ng: 3 };
const mm = (n) => Math.round(n).toLocaleString("en-US");
const t1 = (n) => (Math.round(n * 10) / 10).toFixed(1);

const CHECKS = [
  { key: "pass", value: "width_mm", name: "幅", tight: TIGHT_MM, room: (lim, v) => lim - v, fmt: mm, unit: "" },
  { key: "height", value: "height_mm", name: "高さ", tight: TIGHT_MM, room: (lim, v) => lim - v, fmt: mm, unit: "" },
  { key: "mass", value: "mass_t", name: "重さ", tight: 0, room: (lim, v) => lim - v, fmt: t1, unit: "t" },
  { key: "site", value: "tail_radius_mm", name: "後ろ半径", tight: TIGHT_MM / 2, room: (lim, v) => lim / 2 - v, fmt: mm, unit: "", side: true },
];

// site: { pass, height, mass, site }（入れていない所は null）。条件が1つも無ければ null を返す
export function judgeMachine(m, site) {
  const used = CHECKS.filter((c) => site[c.key] !== null && site[c.key] !== undefined);
  if (!used.length) return null;
  const reasons = used.map((c) => {
    const v = m.values[c.value]?.v;
    if (v === null || v === undefined) return { status: "unknown", text: `${c.name}不明` };
    const room = c.room(site[c.key], v);
    const head = `${c.name}${c.fmt(v)}${c.unit}`;
    if (room < 0) return { status: "ng", text: `${head}／${c.fmt(-room)}${c.unit}オーバー` };
    return { status: room < c.tight ? "tight" : "ok", text: `${head}／${c.side ? "片側" : ""}余裕${c.fmt(room)}${c.unit}` };
  });
  const status = reasons.reduce((s, r) => (RANK[r.status] > RANK[s] ? r.status : s), "ok");
  return { status, reasons };
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
// - ビックヘッド・ショートリーチ: 1つ上のクラスだけ（自分のクラスは付かない）
// - 例外: 0.25 のショートリーチは 0.25 クラスだけ／CAT325（37番）は 0.7 クラス＋SV380
export const CLASSES = [0.1, 0.25, 0.45, 0.7, 1.2, 1.6];
const FIT_SPECIAL = { 37: { classes: [0.7], extra: ["sv380"], extraNames: ["SV380"] } };

export function attFit(m) {
  if (m.no != null && FIT_SPECIAL[m.no]) return FIT_SPECIAL[m.no];
  const spec = m.spec ?? "";
  const short = /ショートリーチ/.test(spec);
  const big = short || /ビックヘッド|ビッグヘッド/.test(spec);
  const up = CLASSES[CLASSES.indexOf(m.class) + 1];
  const classes = short && m.class === 0.25 ? [0.25]
    : big && up ? [up] : [m.class];
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
