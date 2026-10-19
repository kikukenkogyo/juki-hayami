import { filterMachines, sortMachines, parseLimit, formatValue, detailNote, KINDS, filterAtts, sortAtts, formatAttValue } from "./lib.js";

const CLASSES = [0.1, 0.25, 0.45, 0.7, 1.2, 1.6];
const SECTIONS = [
  ["本体", [["mass_t", "運転質量"], ["width_mm", "全幅"], ["height_mm", "全高（輸送時）"], ["length_mm", "全長（輸送時）"],
    ["crawler_width_mm", "シュー幅"], ["tail_radius_mm", "後端旋回半径"], ["ground_pressure_kpa", "接地圧"]]],
  ["作業範囲", [["max_work_height_mm", "最大作業高さ"], ["max_reach_mm", "最大作業半径"], ["max_dig_depth_mm", "最大掘削深さ"]]],
  ["クレーン", [["crane_capacity_t", "最大つり上げ荷重"]]],
];

// アタッチメント詳細の区分。能力はブレーカとそれ以外で出す項目が違う
const ATT_SECTIONS = (a) => [
  ["本体", [["mass_kg", "質量"], ["length_mm", "全長"], ["width_mm", "全幅"], ["height_mm", "全高"]]],
  ["能力", a.kind === "ブレーカ"
    ? [["blows_per_min", "打撃数"], ["chisel_mm", "チゼル径"]]
    : [["open_mm", "最大開口幅"], ["force_kn", a.kind === "カッター" ? "切断力" : "破砕力"]]],
  ["付けられる重機", [["base_t", "適合ベースマシン"]]],
  ["油圧・配管", [["oil_lpm", "必要油量"], ["pressure_mpa", "使用圧力"], ["rotation", "旋回"], ["pipes", "配管"]]],
];

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const label = (m) => (m.no == null ? "番号なし" : String(m.no).padStart(3, "0"));
const hashOf = (m) => (m.no == null ? `#name-${encodeURIComponent(m.name)}` : `#no-${m.no}`);

let machines = [];
let loaded = false;
let atts = [];
let attState = "loading"; // loading / ok / error
let tab = "juki";
let cameFromList = false;
const selected = new Set();
const aSelected = new Set(), kSelected = new Set();

// 何か入っているのに数字として読めない欄は赤枠にして、条件が効いていないことを知らせる
function limit(id) {
  const el = $(id), v = parseLimit(el.value);
  el.classList.toggle("bad", el.value.trim() !== "" && v === null);
  return v;
}

function cond() {
  return {
    query: $("q").value,
    classes: [...selected],
    maxWidth: limit("maxWidth"),
    maxHeight: limit("maxHeight"),
    maxMass: limit("maxMass"),
  };
}

function card(m) {
  const short = (k) => formatValue(k, m.values[k]).replace("カタログに記載なし", "記載なし").replace(" ⚠要確認", "⚠");
  const n = (k, t) => `<div><small>${t}</small><b>${esc(short(k))}</b></div>`;
  return `<a class="card" href="${hashOf(m)}">
    <div class="top"><span class="no">${label(m)}</span><span class="name">${esc(m.name)}</span>
    <span class="spec">${m.class}㎥・${esc(m.spec)}</span>${m.caution ? `<span class="ref">※参考値</span>` : ""}</div>
    <div class="nums">${n("width_mm", "全幅")}${n("height_mm", "全高")}${n("mass_t", "重量")}</div></a>`;
}

function renderList() {
  if (!loaded) return;
  const { hits, unknown } = filterMachines(machines, cond());
  let html = sortMachines(hits).map(card).join("");
  if (unknown.length) {
    html += `<h2 class="group">寸法不明（条件で判定できない機種）</h2>` + sortMachines(unknown).map(card).join("");
  }
  $("list").innerHTML = html || `<p class="count">当てはまる機種がありません</p>`;
  $("count").textContent = `${hits.length}台` + (unknown.length ? `＋寸法不明${unknown.length}台` : "") + ` / 全${machines.length}台`;
}

function renderDetail(m) {
  const rows = (items) => items
    .filter(([k]) => k !== "crane_capacity_t" || m.values[k])
    .map(([k, t]) => {
      const c = m.values[k];
      const n = detailNote(c);
      const note = n ? `<small>${esc(n)}</small>` : "";
      return `<div><dt>${t}</dt><dd class="${c?.check ? "warn" : ""}">${esc(formatValue(k, c))}${note}</dd></div>`;
    }).join("");
  const secs = SECTIONS.map(([title, items]) => {
    const r = rows(items);
    return r ? `<h2 class="sec">${title}</h2><dl>${r}</dl>` : "";
  }).join("");
  const pages = m.images.length
    ? `<h2 class="sec">カタログのページ</h2><div class="pages">${m.images.map((p) =>
        `<a href="${esc(p)}"><img src="${esc(p)}" alt="カタログのページ" loading="lazy"></a>`).join("")}</div>`
    : "";
  const src = m.source.map((s) => `${esc(s.file)} ${s.page}ページ（${esc(s.where)}）`).join("<br>");
  $("detailBody").innerHTML = `
    <div class="dhead"><span class="no">${label(m)}</span> <span class="name">${esc(m.name)}</span>
      <div class="spec">${esc(m.maker)}・${m.class}㎥・${esc(m.spec)}</div></div>
    ${m.caution ? `<p class="caution">${esc(m.caution)}</p>` : ""}
    ${secs}${pages}
    ${src ? `<p class="src">出典: ${src}</p>` : ""}
    <a class="jump" href="#att/c/${m.class}">このクラス（${m.class}㎥）に付くアタッチメント →</a>`;
}

// ---- アタッチメント ----
const unitNos = (a) => a.units.map((u) => "No." + String(u).padStart(3, "0")).join("・");

function attCard(a) {
  const short = (k) => formatAttValue(k, a.values[k], a.catalog).replace("カタログに記載なし", "記載なし").replace(" ⚠要確認", "⚠");
  const n = (k, t) => `<div><small>${t}</small><b>${esc(short(k))}</b></div>`;
  return `<a class="card" href="#att/${a.id}">
    <div class="top"><span class="name">${esc(a.name)}</span>
    <span class="spec">${esc(a.maker)}・${a.class}㎥・${esc(a.kind)}・保有${a.units.length}台</span>${a.caution ? `<span class="ref">※参考値</span>` : ""}</div>
    <div class="nums">${n("mass_kg", "重量")}${a.kind === "ブレーカ" ? n("chisel_mm", "チゼル径") : n("open_mm", "開口幅")}${n("base_t", "適合")}</div></a>`;
}

function renderAttList() {
  if (attState === "loading") return;
  if (attState === "error") {
    $("alist").innerHTML = `<p class="count">アタッチメントのデータを読み込めませんでした。電波のある所でもう一度開いてください。</p>`;
    return;
  }
  const hits = sortAtts(filterAtts(atts, { query: $("aq").value, classes: [...aSelected], kinds: [...kSelected] }));
  $("alist").innerHTML = hits.map(attCard).join("") || `<p class="count">当てはまる機種がありません</p>`;
  const units = hits.reduce((s, a) => s + a.units.length, 0);
  $("acount").textContent = `${hits.length}機種（${units}台） / 全${atts.length}機種`;
}

function renderAttDetail(a) {
  const rows = (items) => items.map(([k, t]) => {
    const c = a.values[k];
    const n = detailNote(c);
    return `<div><dt>${t}</dt><dd class="${c?.check ? "warn" : ""}">${esc(formatAttValue(k, c, a.catalog))}${n ? `<small>${esc(n)}</small>` : ""}</dd></div>`;
  }).join("");
  const classRow = `<div><dt>台帳のクラス</dt><dd>${a.class}㎥</dd></div>`;
  // カタログの無い機種は「カタログなし」が並ぶだけなので、数字の区分は出さない
  const secs = a.catalog
    ? ATT_SECTIONS(a).map(([title, items]) =>
        `<h2 class="sec">${title}</h2><dl>${rows(items)}${title === "付けられる重機" ? classRow : ""}</dl>`).join("")
    : `<h2 class="sec">付けられる重機</h2><dl>${classRow}</dl>`;
  const own = `<h2 class="sec">保有</h2><dl><div><dt>管理番号</dt><dd class="units">${unitNos(a)}（${a.units.length}台）</dd></div>${
    a.memo ? `<div><dt>備考</dt><dd>${esc(a.memo)}</dd></div>` : ""}</dl>`;
  const pages = a.images.length
    ? `<h2 class="sec">カタログのページ</h2><div class="pages">${a.images.map((p) =>
        `<a href="${esc(p)}"><img src="${esc(p)}" alt="カタログのページ" loading="lazy"></a>`).join("")}</div>`
    : "";
  const src = a.source.map((s) => `${esc(s.file)} ${s.page}ページ（${esc(s.where)}）`).join("<br>");
  const caution = a.catalog ? a.caution : "この機種のカタログが手元にありません（台帳の情報のみ）";
  $("detailBody").innerHTML = `
    <div class="dhead"><span class="name">${esc(a.name)}</span>
      <div class="spec">${esc(a.maker)}・${a.class}㎥・${esc(a.kind)}</div></div>
    ${caution ? `<p class="caution">${esc(caution)}</p>` : ""}
    ${secs}${own}${pages}
    ${src ? `<p class="src">出典: ${src}</p>` : ""}`;
}

function setTab(t) {
  if (!$("tabs")) return;
  if (t !== tab) window.scrollTo(0, 0);
  tab = t;
  for (const b of $("tabs").querySelectorAll("button")) b.setAttribute("aria-pressed", String(b.dataset.tab === t));
  $("jukiBar").hidden = t !== "juki";
  $("attBar").hidden = t !== "att";
  $("list").hidden = t !== "juki";
  $("alist").hidden = t !== "att";
}

// 重機からのジャンプ: 検索と種類は消して、そのクラスだけ選んだ状態にする
function showOnlyClass(value) {
  $("aq").value = "";
  kSelected.clear();
  for (const b of $("akinds").querySelectorAll("button")) b.setAttribute("aria-pressed", "false");
  aSelected.clear();
  if (CLASSES.includes(value)) aSelected.add(value);
  for (const b of $("aclasses").querySelectorAll("button")) b.setAttribute("aria-pressed", String(Number(b.dataset.c) === value));
}

function route() {
  let h = "";
  try { h = decodeURIComponent(location.hash); } catch { /* 壊れたアドレスは一覧に戻す */ }
  // 重機の詳細から「このクラスに付くアタッチメント」: そのクラスだけ選んだ一覧にする
  if (h.startsWith("#att/c/") && $("attBar")) {
    showOnlyClass(Number(h.slice(7)));
    history.replaceState(null, "", "#att");
    h = "#att";
    renderAttList();
    window.scrollTo(0, 0);
  }
  const m = h.startsWith("#no-") ? machines.find((x) => String(x.no) === h.slice(4))
    : h.startsWith("#name-") ? machines.find((x) => x.no == null && x.name === h.slice(6)) : null;
  const a = h.startsWith("#att/") ? atts.find((x) => x.id === h.slice(5)) : null;
  const showDetail = Boolean(m || a);
  setTab(h === "#att" || h.startsWith("#att/") ? "att" : "juki");
  $("detail").hidden = !showDetail;
  document.querySelector(".bar").hidden = showDetail;
  if (showDetail) {
    $("list").hidden = true;
    if ($("alist")) $("alist").hidden = true;
    if (m) renderDetail(m); else renderAttDetail(a);
    window.scrollTo(0, 0);
  }
}

function setup() {
  $("classes").innerHTML = CLASSES.map((c) => `<button type="button" data-c="${c}" aria-pressed="false">${c}</button>`).join("");
  $("classes").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    const c = Number(b.dataset.c);
    selected.has(c) ? selected.delete(c) : selected.add(c);
    b.setAttribute("aria-pressed", String(selected.has(c)));
    renderList();
  });
  for (const id of ["q", "maxWidth", "maxHeight", "maxMass"]) $(id).addEventListener("input", renderList);
  // 古い index.html（アタッチメントの欄なし）と組み合わさっても重機側は動かす
  if (!$("attBar")) return;
  $("aclasses").innerHTML = $("classes").innerHTML;
  $("akinds").innerHTML = KINDS.map((k) => `<button type="button" data-k="${k}" aria-pressed="false">${k}</button>`).join("");
  const toggle = (box, set, key, conv) => $(box).addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    const v = conv(b.dataset[key]);
    set.has(v) ? set.delete(v) : set.add(v);
    b.setAttribute("aria-pressed", String(set.has(v)));
    renderAttList();
  });
  toggle("aclasses", aSelected, "c", Number);
  toggle("akinds", kSelected, "k", String);
  $("aq").addEventListener("input", renderAttList);
  $("alist").addEventListener("click", (e) => { if (e.target.closest(".card")) cameFromList = true; });
  $("tabs").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b || b.dataset.tab === tab) return;
    location.hash = b.dataset.tab === "att" ? "#att" : "";
  });
  $("clear").addEventListener("click", () => {
    for (const id of ["maxWidth", "maxHeight", "maxMass"]) $(id).value = "";
    renderList();
  });
  $("list").addEventListener("click", (e) => { if (e.target.closest(".card")) cameFromList = true; });
  $("back").addEventListener("click", () => {
    if (cameFromList) { cameFromList = false; history.back(); } else location.hash = tab === "att" ? "#att" : "";
  });
  window.addEventListener("hashchange", route);
}

// アタッチメントは重機と別に読む（読めなくても重機側は使える）
async function loadAtts() {
  if (!$("attBar")) return;
  try {
    const res = await fetch("att.json", { cache: "no-cache" });
    if (!res.ok) throw new Error(res.status);
    atts = await res.json();
    attState = "ok";
  } catch {
    attState = "error";
  }
  renderAttList();
  if (location.hash.startsWith("#att/")) route();
}

async function main() {
  setup();
  loadAtts();
  try {
    const res = await fetch("juki.json", { cache: "no-cache" });
    if (!res.ok) throw new Error(res.status);
    machines = await res.json();
    loaded = true;
  } catch {
    $("list").innerHTML = `<p class="count">データを読み込めませんでした。電波のある所でもう一度開いてください。</p>`;
    return;
  }
  renderList();
  route();
}

main();

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
