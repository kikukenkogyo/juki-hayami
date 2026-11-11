// Notion の API の返事から、重機・アタッチメントの所在だけを取り出す（通信はしない）
// - 重機: 「重機情報」の 管理番号（数字）と 所在地（選択）
// - アタッチメント: 「アタッチメント情報」の 管理番号（"A-001"）と 現在地（持出返却ログから出す数式）。空なら 所在地（選択）

const text = (p) => {
  if (!p) return "";
  switch (p.type) {
    case "select": return p.select?.name ?? "";
    case "number": return p.number == null ? "" : String(p.number);
    case "title": case "rich_text": return (p[p.type] ?? []).map((t) => t.plain_text).join("");
    case "formula": {
      const f = p.formula ?? {};
      return f.type === "string" ? f.string ?? "" : f.type === "number" && f.number != null ? String(f.number) : "";
    }
    default: return "";
  }
};
const clean = (s) => s.replace(/\s+/g, " ").trim();
// 現在地の数式は「🏭 工場」「🚧 九段南」のように目印の絵文字を付けてくるので、文字だけにする
const place = (s) => clean(s.replace(/[\p{Extended_Pictographic}️‍]/gu, ""));
const numOf = (s) => { const m = String(s).match(/\d+/); return m ? Number(m[0]) : null; };

export function jukiLocations(pages) {
  const out = {};
  for (const pg of pages) {
    const no = numOf(text(pg.properties["管理番号"]));
    const loc = clean(text(pg.properties["所在地"]));
    if (no != null && loc) out[no] = loc;
  }
  return out;
}

// 早見表とは名前でつなぐので、名前と Notion の管理番号（"A-001"）をそのまま持つ
export function attLocations(pages) {
  const out = [];
  for (const pg of pages) {
    const p = pg.properties;
    const code = clean(text(p["管理番号"]));
    const loc = place(text(p["現在地"])) || place(text(p["所在地"]));
    const name = clean(text(p["名称"]) || text(p["識別名"]));
    if (name) out.push({ code, name, loc: loc || null });
  }
  return out.sort((a, b) => a.code.localeCompare(b.code));
}
