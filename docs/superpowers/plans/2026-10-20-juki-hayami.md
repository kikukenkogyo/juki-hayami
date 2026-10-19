# 重機早見表アプリ（juki-hayami） Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 自社重機34台の寸法・重量を、iPhone・iPad から1タップ・電波なしでも引ける静的 Web アプリを公開する。

**Architecture:** データ（`juki.json`）と画面（`index.html` + `app.js`）を分けた静的サイトを GitHub Pages で公開。検索・絞り込みは `lib.js` の純粋関数に集め、Node 標準の `node:test` で試験する。寸法は Claude が PDF を画像で2回読み、`tools/compare.mjs` で突き合わせて食い違いを「要確認」にする。

**Tech Stack:** HTML/CSS/素の JavaScript（ES モジュール）、Node 24（`node:test`、外部パッケージなし）、Python 3.12 + PyMuPDF（ページ画像化のみ）、GitHub Pages。

**Spec:** `docs/superpowers/specs/2026-10-20-juki-hayami-design.md`

## Global Constraints

- 外部ライブラリ・外部サーバーは使わない（npm パッケージ、CDN も不可）
- 長さは mm、重さは t（小数1桁）、接地圧は kPa
- 読めなかった値は `v: null` + `note: "カタログに記載なし"`、画面でも「カタログに記載なし」と表示（空欄にしない）
- 所在地・点検日・状態は載せない
- カタログ PDF そのものはリポジトリに入れない。載せるのは自社機種の寸法図・仕様表ページの JPEG（横1200px、品質70）だけ
- Notion 台帳（`AI作業場\管理システム構築\juki_info_all.csv`）の34台を正とする。PDF との対応のずれは推測で決めず、酒井さんに確認する
- 数字の修正は `juki.json` だけで済むこと（`index.html` を触らない）
- コミット名義は `kikukenkogyo <kanehachi123@gmail.com>`（設定済み）

## Review Focus

1. 全角・半角や大文字小文字が混ざった検索（Notion の機種名は「ＰＣ２２８」「ZX135USK」が混在）→ 「pc228」でも「ＰＣ228」でも同じ機種が出る（NFKC で正規化）
2. 条件絞り込み中に値が `null` の機種 → 消さずに「寸法不明」として末尾に出る
3. 管理番号のない機種（SK35SR-7）→ 落ちずに「番号なし」と表示され、並びは同じクラスの最後
4. データ更新後に古い内容が残る → `juki.json` は通信できるときは必ず新しい方を取る（network-first）
5. 条件欄に「2.5m」「２５００」「空欄」を入れる → 全角数字は数値として扱い、数字にならない入力と空欄は「条件なし」

---

## ファイル構成

| ファイル | 役割 |
|---|---|
| `tools/mapping.json` | 管理番号 → PDF・ページの対応表（Task 1） |
| `tools/schema.mjs` | `juki.json` の形の検査 `validate()`（Task 2） |
| `tools/compare.mjs` | 2回読みの突き合わせ `compare()`（Task 2） |
| `tools/render_pages.py` | PDF の指定ページを JPEG に（Task 3） |
| `juki.json` | 34台のデータ（Task 3） |
| `img/` | ページ画像（Task 3） |
| `lib.js` | 検索・絞り込み・並べ替え・表示用の整形（Task 4） |
| `app.js` | 画面の組み立てと操作（Task 5） |
| `index.html` / `style.css` | 画面の器と見た目（Task 5） |
| `manifest.json` / `sw.js` / `icon-192.png` / `icon-512.png` | ホーム画面追加・電波なし対応（Task 6） |
| `test/*.test.mjs` | 試験 |

試験の実行: `node --test test/`

---

### Task 1: 管理番号と PDF の対応表（酒井さん確認つき）

**Files:**
- Create: `tools/mapping.json`

**Interfaces:**
- Produces: `tools/mapping.json` = 配列。1要素 `{ "no": number|null, "name": string, "class": number, "spec": string, "maker": string, "pdfs": [{ "file": string, "pages": number[] }], "flag": string }`。`name`・`class`・`spec`・`no` は Notion CSV のまま。`flag` は問題なしなら `""`、あれば理由（例「番号ずれ: ファイルはPC450LC-8」「PDFなし」「候補が2つ」）

- [ ] **Step 1:** `juki_info_all.csv` から機種名が空でない34行を読み、`no`・`name`・`class`・`spec` を入れる（CSV 末尾のメモ行・空行は除く）
- [ ] **Step 2:** PDF 72件のファイル名と、各 PDF の1〜2ページ目の画像を見て、各台に `pdfs` と該当ページ（主要諸元表・寸法図のページ）を割り当てる。決めきれない所は `flag` に理由を書き、推測で埋めない
- [ ] **Step 3:** `flag` が空でない台だけを表にして酒井さんに見せ、1問ずつ確認する。少なくとも 009・032・004/005/007/008/012/017/025/026 の重複、33番 ZX20U-5A（PDFなし）、SK35SR-7（番号なし）が含まれること
- [ ] **Step 4:** 回答を反映し、`flag` を `""` にする（PDF が無い台は `pdfs: []`、`flag: "PDFなし"` のまま残す）
- [ ] **Step 5: Commit** `git add tools/mapping.json && git commit -m "data: 管理番号とPDFの対応表"`

**この Task が終わるまで Task 3 に進まない。**

---

### Task 2: データの形の検査と2回読みの突き合わせ

**Files:**
- Create: `tools/schema.mjs`, `tools/compare.mjs`
- Test: `test/schema.test.mjs`, `test/compare.test.mjs`

**Interfaces:**
- Produces:
  - `export const VALUE_KEYS = ["mass_t","width_mm","height_mm","length_mm","crawler_width_mm","tail_radius_mm","ground_pressure_kpa","max_work_height_mm","max_reach_mm","max_dig_depth_mm","crane_capacity_t"]`（`schema.mjs`）
  - `export function validate(machines: Machine[]): string[]`（エラー文の配列。空なら合格）
  - `export function compare(a: Machine[], b: Machine[]): Machine[]`（`compare.mjs`）
  - `Machine` = `{ no: number|null, name: string, class: number, spec: string, maker: string, values: { [key in VALUE_KEYS]?: { v: number|null, note: string, check: boolean } }, source: [{ file: string, page: number, where: string }], images: string[] }`

- [ ] **Step 1: 試験を書く**（`test/schema.test.mjs`）
  - `validate([正しい1台])` → `[]`
  - `values.width_mm.v` が文字列 `"2490"` → エラー文に `"width_mm"` を含む
  - `values` に `VALUE_KEYS` 以外のキー `"color"` → エラー
  - `v: null` なのに `note` が空 → エラー（「カタログに記載なし」等の注記が必須）
  - `crane_capacity_t` を持つのに `spec` に「クレーン」を含まない → エラー
  - `no` が同じ台が2つ → エラー（`null` 同士は可）
  - `images` のパスが `img/` で始まらない → エラー
- [ ] **Step 2:** `node --test test/schema.test.mjs` → FAIL（`validate` 未定義）
- [ ] **Step 3:** `tools/schema.mjs` に `VALUE_KEYS` と `validate()` を実装
- [ ] **Step 4:** 同コマンド → PASS
- [ ] **Step 5: 試験を書く**（`test/compare.test.mjs`）
  - 同じ値どうし → `check: false`、値はそのまま
  - `a` が 2490、`b` が 2400 → 結果 `v: 2490`、`check: true`、`note` の末尾に `"（2回目: 2400）"`
  - 片方だけ `null` → `check: true`
  - `a` にある台が `b` に無い → 例外（台の組み合わせは `no` と `name` で照合）
- [ ] **Step 6:** `node --test test/compare.test.mjs` → FAIL
- [ ] **Step 7:** `tools/compare.mjs` に `compare()` を実装（`a` を基準にする）
- [ ] **Step 8:** `node --test test/` → 全 PASS
- [ ] **Step 9: Commit** `git commit -m "tools: データ形式の検査と2回読み照合"`

---

### Task 3: 34台の寸法を読み取って `juki.json` と画像を作る

**Files:**
- Create: `tools/render_pages.py`, `juki.json`, `img/*.jpg`, `tools/pass_a.json`, `tools/pass_b.json`

**Interfaces:**
- Consumes: `tools/mapping.json`（Task 1）、`validate()`・`compare()`（Task 2）
- Produces: `juki.json`（`Machine[]`、34件）、`img/{no3桁}-{連番}.jpg`（番号なしは `img/none-{連番}.jpg`）

- [ ] **Step 1:** `tools/render_pages.py <pdf> <page> <out.jpg>` を書く（PyMuPDF で描画→横1200pxに縮小→JPEG 品質70）。読み取り用には別に 200dpi の画像をスクラッチ領域に出す（リポジトリには入れない）
- [ ] **Step 2: 1回目の読み取り** — `mapping.json` の各台について 200dpi 画像を拡大して見て、**その台の機種の列だけ**から値を読み `tools/pass_a.json` に書く。`source` にファイル・ページ・表の名前、`note` に条件（「輸送時」「シュー幅600mm時」等）。シュー幅違いなど複数値があるときは Notion の `spec` に合う方、決まらなければ小さい方の全幅を入れて `note` に両方書く
- [ ] **Step 3: 2回目の読み取り** — 1回目を見ずに、別のエージェントが同じ手順で `tools/pass_b.json` を作る
- [ ] **Step 4:** `compare(pass_a, pass_b)` の結果を `juki.json` に書き出す
- [ ] **Step 5:** `validate(juki.json)` → エラー0件。34件あること
- [ ] **Step 6:** 掲載ページを `img/` に出し、各台の `images` に入れる。`img/` 合計が 20MB 以下であること
- [ ] **Step 7:** `check: true` の値だけを一覧（機種・項目・1回目・2回目・ページ画像の場所）にして酒井さんに見せ、正しい値を確認 → `juki.json` を直して `check: false` にする
- [ ] **Step 8: Commit** `git commit -m "data: 重機34台の寸法データとページ画像"`（`pass_a/b.json` も記録として入れる）

---

### Task 4: 検索・絞り込みの部品（`lib.js`）

**Files:**
- Create: `lib.js`
- Test: `test/lib.test.mjs`

**Interfaces:**
- Consumes: `Machine` 型（Task 2）
- Produces:
  - `export function normalize(s: string): string` — NFKC + 小文字化 + 空白除去
  - `export function parseLimit(input: string): number|null` — 正規化後に数値化。数字にならなければ `null`
  - `export function filterMachines(machines: Machine[], cond: { query: string, classes: number[], maxWidth: number|null, maxHeight: number|null, maxMass: number|null }): { hits: Machine[], unknown: Machine[] }`
  - `export function sortMachines(machines: Machine[]): Machine[]` — クラス昇順 → `no` 昇順（`null` は同クラスの最後）
  - `export function formatValue(key: string, cell: {v,note,check}|undefined): string`

- [ ] **Step 1: 試験を書く**
  - `normalize("ＰＣ２２８ US")` === `"pc228us"`
  - `filterMachines` で `query: "pc228"` → 機種名「ＰＣ228US-3②」と「PC228US-10⑤」の両方が `hits`
  - `query: "26"` → `no: 26` の台が出る。`query: "026"` でも出る
  - `query: "ロング"` → `spec` が「ロングブーム」の台が出る
  - `classes: [0.7, 1.2]` → その2クラスだけ。`classes: []` → 全クラス
  - `maxWidth: 2500` → `width_mm.v <= 2500` は `hits`、`> 2500` は除外、`v: null` は `unknown`
  - 条件がすべて `null` のとき `unknown` は空
  - `parseLimit("２５００")` === 2500、`parseLimit("")` === null、`parseLimit("2.5m")` === null
  - `sortMachines`: クラス 0.25 の `no: null` は 0.25 の最後、0.45 より前
  - `formatValue("mass_t", {v: 7.45, note:"", check:false})` === `"7.5 t"`、`formatValue("width_mm", {v: 2490,...})` === `"2,490 mm"`、`formatValue("ground_pressure_kpa", {v: 37,...})` === `"37 kPa"`、`v: null` → `"カタログに記載なし"`、`undefined` → `"カタログに記載なし"`、`check: true` → 末尾に `" ⚠要確認"`
- [ ] **Step 2:** `node --test test/lib.test.mjs` → FAIL
- [ ] **Step 3:** `lib.js` を実装（DOM を触らない）
- [ ] **Step 4:** `node --test test/` → 全 PASS
- [ ] **Step 5: Commit** `git commit -m "feat: 検索・絞り込み・表示整形"`

---

### Task 5: 画面（一覧・詳細）

**Files:**
- Create: `index.html`, `style.css`, `app.js`

**Interfaces:**
- Consumes: `lib.js` の全関数（Task 4）、`juki.json`（Task 3）
- Produces: 画面。詳細は URL の `#no-26`（番号なしは `#name-<encodeURIComponent(name)>`）で開く。戻るボタン（ブラウザの戻る）で一覧に戻る

- [ ] **Step 1:** `index.html`: 見出し「重機早見表」、検索窓、クラスボタン6個（0.1/0.25/0.45/0.7/1.2/1.6、押すと色が変わる・もう一度で解除）、条件欄3つ（全幅mm以下／全高mm以下／重量t以下、`inputmode="decimal"`）、件数表示、一覧、詳細の器。`<script type="module" src="app.js">`
- [ ] **Step 2:** `app.js`: `juki.json` を読み込み、入力のたびに `filterMachines` → `sortMachines` で一覧を描き直す。カードは「管理番号（3桁、なしは"番号なし"）・機種名・仕様・全幅・全高・重量」。`unknown` があれば見出し「寸法不明（条件で判定できない機種）」の下に並べる
- [ ] **Step 3:** 詳細: 設計書4章の3区分（本体／作業範囲／クレーン＝`crane_capacity_t` がある台のみ）を `formatValue` で表示、`note` を小さく下に。「カタログのページを見る」で `images` を画面いっぱいに表示（ピンチで拡大できる `<img>`）。出典（ファイル名・ページ）を一番下に小さく
- [ ] **Step 4:** `style.css`: 文字は本文16px以上、ボタンは高さ44px以上、横スクロールなし。ピンク系のアクセント色（会社のブランド）
- [ ] **Step 5: 確認** — `.claude/launch.json` に `python -m http.server 8080`（外部パッケージ不要）を登録してプレビュー。幅375px と 768px で: 「228」で2台以上出る／0.7 を押すと 0.7 だけ／全幅2500で絞ると該当のみ＋寸法不明が末尾／カード→詳細→戻る／画像が開く。スクリーンショットで文字の見切れ・重なりがないこと
- [ ] **Step 6: Commit** `git commit -m "feat: 一覧と詳細の画面"`

---

### Task 6: ホーム画面追加と電波なし対応

**Files:**
- Create: `manifest.json`, `sw.js`, `icon-192.png`, `icon-512.png`
- Modify: `index.html`（manifest・apple-touch-icon の指定、`sw.js` の登録）

**Interfaces:**
- Consumes: Task 5 の全ファイル
- Produces: `sw.js` 内 `const VERSION = "v1"`（画面ファイルを直したら上げる）

- [ ] **Step 1:** `manifest.json`: 名前「重機早見表」、`display: "standalone"`、アイコン2種。アイコンはピンク地に白でショベルの形（Python で作る）。`index.html` に `<link rel="apple-touch-icon" href="icon-192.png">` と `apple-mobile-web-app-capable`
- [ ] **Step 2:** `sw.js`: インストール時に `index.html`・`style.css`・`app.js`・`lib.js`・`juki.json`・`img/` 全件を保存。`juki.json` は network-first（通信できれば新しい方を取り保存、だめなら保存分）、それ以外は cache-first。`VERSION` が変わったら古い保存分を消す
- [ ] **Step 3: 確認** — プレビューで一度開いたあと、ブラウザの開発ツールでオフラインにして再読み込み → 一覧・詳細・画像が出る。`juki.json` の1値を書き換えてオンラインで再読み込み → 新しい値が出る（確認後に戻す）
- [ ] **Step 4: Commit** `git commit -m "feat: ホーム画面追加と電波なし対応"`

---

### Task 7: GitHub に公開して iPhone で確認

**Files:**
- Create: `README.md`（使い方: ホーム画面への追加手順、データの直し方、機種の追加の頼み方）

- [ ] **Step 1:** GitHub に空のリポジトリ `kikukenkogyo/juki-hayami`（Public）を作る。このPCには `gh` が無いので、酒井さんに github.com で作ってもらう（画面の名前どおり1手順ずつ案内）か、アプリ内ブラウザでサインイン済みなら酒井さんの了承を得て Claude が作る
- [ ] **Step 2:** `git remote add origin https://github.com/kikukenkogyo/juki-hayami.git` → `git push -u origin main`
- [ ] **Step 3:** GitHub の Settings → Pages で「Deploy from a branch」「main」「/(root)」を選ぶ（酒井さんに案内、または了承を得て Claude が操作）
- [ ] **Step 4: 確認** — `https://kikukenkogyo.github.io/juki-hayami/` を開き、Task 5 Step 5 と同じ項目を確かめる
- [ ] **Step 5:** 酒井さんの iPhone で開いてもらい「ホーム画面に追加」→ 機内モードで開けるかを見てもらう
- [ ] **Step 6:** `AI作業場\重機・アタッチメント情報\引き継ぎメモ.md` に公開URLと更新のしかたを書き足す
- [ ] **Step 7: Commit & push** `git commit -m "docs: README" && git push`
