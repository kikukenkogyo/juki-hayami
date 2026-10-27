// Claude の「重機選び」プロジェクトに入れる表（CSV）を juki.json・att.json から作る
// 使い方: node tools/make_claude_files.mjs <出力フォルダ>
// データを直したら作り直して、プロジェクトのファイルを入れかえる
import fs from "node:fs";
import path from "node:path";
import { attFit, fitText } from "../lib.js";

const out = process.argv[2];
if (!out) { console.error("出力フォルダを指定してください"); process.exit(1); }
fs.mkdirSync(out, { recursive: true });

const juki = JSON.parse(fs.readFileSync("juki.json", "utf8"));
const att = JSON.parse(fs.readFileSync("att.json", "utf8"));

const cell = (x) => {
  const s = x === null || x === undefined ? "" : String(x);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
// Excel で文字化けしないよう先頭に BOM を付ける
const writeCsv = (name, header, rows) => {
  const text = [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
  fs.writeFileSync(path.join(out, name), "﻿" + text + "\r\n");
};
const v = (c) => (c?.v === null || c?.v === undefined ? "不明" : Array.isArray(c.v) ? `${c.v[0]}〜${c.v[1]}` : c.v);
const notes = (vals, keys) => keys.map((k) => vals[k]?.note && vals[k].note !== "カタログに記載なし" ? `${k}: ${vals[k].note}` : "").filter(Boolean).join(" / ");

const JK = ["mass_t", "width_mm", "height_mm", "length_mm", "crawler_width_mm", "tail_radius_mm", "ground_pressure_kpa", "max_work_height_mm", "max_reach_mm", "max_dig_depth_mm", "crane_capacity_t"];
writeCsv("重機一覧.csv",
  ["管理番号", "機種名", "クラス(㎥)", "仕様", "メーカー", "重さ(t・アタッチメントなし)", "全幅(mm)", "全高・輸送時(mm)", "全長・輸送時(mm)", "シュー幅(mm)", "後端旋回半径(mm)", "接地圧(kPa)", "最大作業高さ(mm)", "最大作業半径(mm)", "最大掘削深さ(mm)", "クレーン最大つり上げ(t)", "付くアタッチメントのクラス", "注意", "数字の注記"],
  juki.map((m) => [m.no ?? "", m.name, m.class, m.spec, m.maker, ...JK.map((k) => (k === "crane_capacity_t" && !m.values[k] ? "" : v(m.values[k]))),
    fitText(attFit(m)), m.caution ?? "", notes(m.values, JK)]));

const AK = ["mass_kg", "length_mm", "width_mm", "height_mm", "open_mm", "force_kn", "blows_per_min", "chisel_mm", "base_t", "oil_lpm", "pressure_mpa"];
writeCsv("アタッチメント一覧.csv",
  ["機種名", "種類", "クラス(㎥)", "メーカー", "保有台数", "管理番号", "重さ(kg)", "全長(mm)", "全幅(mm)", "全高(mm)", "最大開口幅(mm)", "破砕力・切断力(kN)", "打撃数(回/分)", "チゼル径(mm)", "適合ベースマシン(t)", "必要油量(L/min)", "使用圧力(MPa)", "カタログ", "備考", "数字の注記"],
  att.map((a) => [a.name, a.kind, a.class, a.maker, a.units.length, a.units.join("・"), ...AK.map((k) => v(a.values[k])),
    a.catalog ? "あり" : "なし", [a.memo, a.caution].filter(Boolean).join(" / "), notes(a.values, AK)]));

console.log(`作りました: ${out}（重機${juki.length}台・アタッチメント${att.length}機種）`);
