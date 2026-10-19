// 電波なしでも開けるようにする仕組み。画面のファイルを直したら VERSION を上げる
const VERSION = "v1";
const CACHE = `juki-hayami-${VERSION}`;
const CORE = ["./", "index.html", "style.css", "app.js", "lib.js", "juki.json", "manifest.json", "icon-192.png"];

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(CORE);
    // ページ画像も全部保存しておく（juki.json に書かれたもの）
    const machines = await (await cache.match("juki.json")).json();
    const imgs = [...new Set(machines.flatMap((m) => m.images))];
    await Promise.all(imgs.map((u) => cache.add(u).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  if (url.pathname.endsWith("/juki.json")) {
    // データは通信できれば新しい方、だめなら保存分
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const res = await fetch(e.request, { cache: "no-cache" });
        if (res.ok) cache.put("juki.json", res.clone());
        return res;
      } catch {
        return (await cache.match("juki.json")) || Response.error();
      }
    })());
    return;
  }
  e.respondWith((async () => {
    const hit = await caches.match(e.request, { ignoreSearch: true });
    if (hit) return hit;
    const res = await fetch(e.request);
    if (res.ok && url.pathname.includes("/img/")) (await caches.open(CACHE)).put(e.request, res.clone());
    return res;
  })());
});
