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
