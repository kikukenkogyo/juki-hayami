// Notion から所在を読んで locations.json を書く（GitHub の自動公開で30分ごとに動く）
// 使い方: NOTION_TOKEN=... node tools/fetch_locations.mjs <書き出すファイル>
// - 鍵（NOTION_TOKEN）は GitHub の Secrets に入れる。リポジトリには書かない
// - locations.json は公開するときにだけ作る（.gitignore 済み。所在の履歴を GitHub に残さないため）
// - 読めなかったときは、今公開中の locations.json をそのまま使う（古い時刻のまま出る）
import fs from "node:fs";
import { jukiLocations, attLocations } from "./locations.mjs";

const out = process.argv[2] ?? "locations.json";
const LIVE = "https://kikukenkogyo.github.io/juki-hayami/locations.json";
// Notion の「重機情報」「アタッチメント情報」のデータソース（2026-11-11 確認）
const SOURCES = {
  juki: { ds: "35c3c51f-6fc6-8319-acd5-872ce06932d1", db: "18d3c51f-6fc6-8313-8cbd-01e1ac6ec3e3" },
  att: { ds: "2063c51f-6fc6-8235-9964-079d9068cf52", db: "0843c51f-6fc6-8302-a144-81977ad510ef" },
};

async function queryAll(token, src) {
  // 新しい API（データソース）で読み、だめなら古い API（データベース）で読む
  for (const [url, version] of [
    [`https://api.notion.com/v1/data_sources/${src.ds}/query`, "2025-09-03"],
    [`https://api.notion.com/v1/databases/${src.db}/query`, "2022-06-28"],
  ]) {
    const pages = [];
    let cursor, ok = true;
    do {
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Notion-Version": version, "Content-Type": "application/json" },
        body: JSON.stringify({ page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) }),
      });
      if (!res.ok) { ok = false; console.error(`${url}: ${res.status} ${(await res.text()).slice(0, 200)}`); break; }
      const body = await res.json();
      pages.push(...body.results);
      cursor = body.has_more ? body.next_cursor : undefined;
    } while (cursor);
    if (ok) return pages;
  }
  throw new Error("Notion を読めませんでした");
}

async function main() {
  const token = process.env.NOTION_TOKEN;
  try {
    if (!token) throw new Error("NOTION_TOKEN がありません");
    const [jp, ap] = await Promise.all([queryAll(token, SOURCES.juki), queryAll(token, SOURCES.att)]);
    const data = { updated: new Date().toISOString(), juki: jukiLocations(jp), att: attLocations(ap) };
    fs.writeFileSync(out, JSON.stringify(data));
    console.log(`所在を書きました: 重機${Object.keys(data.juki).length}台・アタッチメント${data.att.length}台`);
  } catch (e) {
    console.error(`所在を読めませんでした（${e.message}）。公開中のものを使います`);
    try {
      const res = await fetch(LIVE, { cache: "no-store" });
      if (!res.ok) throw new Error(res.status);
      fs.writeFileSync(out, await res.text());
    } catch {
      console.error("公開中のものもありません。所在なしで公開します");
    }
  }
}

main();
