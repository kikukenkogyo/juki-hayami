import { filterMachines, sortMachines, parseLimit, formatValue, detailNote } from "./lib.js";

const CLASSES = [0.1, 0.25, 0.45, 0.7, 1.2, 1.6];
const SECTIONS = [
  ["本体", [["mass_t", "運転質量"], ["width_mm", "全幅"], ["height_mm", "全高（輸送時）"], ["length_mm", "全長（輸送時）"],
    ["crawler_width_mm", "シュー幅"], ["tail_radius_mm", "後端旋回半径"], ["ground_pressure_kpa", "接地圧"]]],
  ["作業範囲", [["max_work_height_mm", "最大作業高さ"], ["max_reach_mm", "最大作業半径"], ["max_dig_depth_mm", "最大掘削深さ"]]],
  ["クレーン", [["crane_capacity_t", "最大つり上げ荷重"]]],
];

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const label = (m) => (m.no == null ? "番号なし" : String(m.no).padStart(3, "0"));
const hashOf = (m) => (m.no == null ? `#name-${encodeURIComponent(m.name)}` : `#no-${m.no}`);

let machines = [];
let loaded = false;
let cameFromList = false;
const selected = new Set();

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
    ${src ? `<p class="src">出典: ${src}</p>` : ""}`;
}

function route() {
  let h = "";
  try { h = decodeURIComponent(location.hash); } catch { /* 壊れたアドレスは一覧に戻す */ }
  const m = h.startsWith("#no-") ? machines.find((x) => String(x.no) === h.slice(4))
    : h.startsWith("#name-") ? machines.find((x) => x.no == null && x.name === h.slice(6)) : null;
  const showDetail = Boolean(m);
  $("detail").hidden = !showDetail;
  $("list").hidden = showDetail;
  document.querySelector(".bar").hidden = showDetail;
  if (showDetail) { renderDetail(m); window.scrollTo(0, 0); }
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
  $("clear").addEventListener("click", () => {
    for (const id of ["maxWidth", "maxHeight", "maxMass"]) $(id).value = "";
    renderList();
  });
  $("list").addEventListener("click", (e) => { if (e.target.closest(".card")) cameFromList = true; });
  $("back").addEventListener("click", () => {
    if (cameFromList) { cameFromList = false; history.back(); } else location.hash = "";
  });
  window.addEventListener("hashchange", route);
}

async function main() {
  setup();
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
