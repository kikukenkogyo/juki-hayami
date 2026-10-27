// 電波なしでも開けるようにする仕組み
// - juki.json・att.json: 通信できれば新しい方。3秒たっても返事がない・エラーのときは保存分
// - 画面のファイルと画像: すぐ保存分を出し、裏で新しいものを取ってきて保存（次に開いたとき新しくなる）
// 保存の形を大きく変えたときだけ VERSION を上げる（古い保存分を消す）
const VERSION = "v4";
const CACHE = `juki-hayami-${VERSION}`;
const CORE = ["./", "index.html", "style.css", "app.js", "lib.js", "juki.json", "att.json", "manifest.json", "icon-192.png", "icon-512.png"];
const DATA = ["juki.json", "att.json"];
const DATA_TIMEOUT_MS = 3000;

const fresh = (u) => new Request(u, { cache: "reload" });

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(CORE.map(async (u) => cache.put(u, await fetch(fresh(u)))));
    // ページ画像も全部保存しておく（juki.json・att.json に書かれたもの）
    const lists = await Promise.all(DATA.map(async (u) => (await cache.match(u)).json()));
    const imgs = [...new Set(lists.flat().flatMap((m) => m.images))];
    await Promise.all(imgs.map(async (u) => {
      try { const res = await fetch(fresh(u)); if (res.ok) await cache.put(u, res); } catch { /* 次回に回す */ }
    }));
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

async function dataFirst(request, name) {
  const cache = await caches.open(CACHE);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), DATA_TIMEOUT_MS);
  try {
    const res = await fetch(request, { cache: "no-cache", signal: ctrl.signal });
    if (!res.ok) throw new Error(String(res.status));
    await cache.put(name, res.clone());
    // 新しい機種の画像があれば、電波のあるうちに保存しておく
    res.clone().json().then((ms) => ms.flatMap((m) => m.images).forEach(async (u) => {
      if (!(await cache.match(u))) cache.add(u).catch(() => {});
    })).catch(() => {});
    return res;
  } catch {
    return (await cache.match(name)) || Response.error();
  } finally {
    clearTimeout(timer);
  }
}

async function cacheThenUpdate(e) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(e.request, { ignoreSearch: true });
  const update = fetch(fresh(e.request.url)).then((res) => {
    if (res.ok) cache.put(e.request, res.clone());
    return res;
  });
  if (hit) {
    e.waitUntil(update.catch(() => {}));
    return hit;
  }
  return update;
}

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  const data = DATA.find((n) => url.pathname.endsWith("/" + n));
  if (data) e.respondWith(dataFirst(e.request, data));
  else e.respondWith(cacheThenUpdate(e));
});
