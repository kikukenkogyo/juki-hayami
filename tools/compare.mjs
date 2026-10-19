// 2回読みの突き合わせ。a を基準に、食い違った値に check:true と2回目の値を注記する
const key = (m) => `${m.no}|${m.name}`;
const fmt = (v) => (v === null ? "記載なし" : String(v));

export function compare(a, b) {
  const byKey = new Map(b.map((m) => [key(m), m]));
  return a.map((m) => {
    const other = byKey.get(key(m));
    if (!other) throw new Error(`2回目に ${key(m)} が無い`);
    const values = {};
    for (const k of new Set([...Object.keys(m.values), ...Object.keys(other.values)])) {
      const x = m.values[k] ?? { v: null, note: "カタログに記載なし", check: false };
      const y = other.values[k] ?? { v: null, note: "", check: false };
      values[k] = x.v === y.v ? { ...x } : { ...x, check: true, note: `${x.note}（2回目: ${fmt(y.v)}）` };
    }
    return { ...m, values };
  });
}
