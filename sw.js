/* Each Pages application owns only its scoped caches. Vocabulary media is cached on demand. */
const BUILD = "f8b8b7ddf5e9";
const PRECACHE = ["./index.html","./manifest.webmanifest","./favicon.svg","./icon-192.png","./icon-512.png","./LICENSE.txt","./CONTENT_LICENSE.md","./FONT_LICENSE.txt","./atlas/index.json","./assets/fraunces-latin-ext-opsz-italic-CGbN9UgK.woff2","./assets/fraunces-latin-ext-opsz-normal-CJcjJNj7.woff2","./assets/fraunces-latin-opsz-italic-lSdLDfvT.woff2","./assets/fraunces-latin-opsz-normal-DihXLNYH.woff2","./assets/fraunces-vietnamese-opsz-italic-DxWqP7Ku.woff2","./assets/fraunces-vietnamese-opsz-normal-Czevyj-6.woff2","./assets/index-BiTHfj5S.css","./assets/index-i8iKHSWw.js"];
const PREFIX = `shici:${self.registration.scope}:`;
const SHELL = `${PREFIX}${BUILD}:shell`;
// Keep visited vocabulary across app updates; change content-v1 if its schema changes.
const CONTENT = `${PREFIX}content-v1`;
const scope = new URL(self.registration.scope);
const shellURL = new URL("index.html", scope).href;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key.startsWith(PREFIX) &&
                key !== SHELL &&
                key.endsWith(":shell"),
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

async function trim(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  await Promise.all(
    keys
      .slice(0, Math.max(0, keys.length - max))
      .map((key) => cache.delete(key)),
  );
}

async function ranged(response, range) {
  if (!range || response.status !== 200) return response;
  const body = await response.arrayBuffer();
  const size = body.byteLength;
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  const start = match?.[1]
    ? Number(match[1])
    : match?.[2]
      ? Math.max(0, size - Number(match[2]))
      : NaN;
  const end =
    match?.[1] && match?.[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  if (
    !match ||
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start > end ||
    start >= size
  )
    return new Response(null, {
      status: 416,
      headers: { "Content-Range": `bytes */${size}` },
    });
  const headers = new Headers(response.headers);
  headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
  headers.set("Content-Length", String(end - start + 1));
  headers.set("Accept-Ranges", "bytes");
  return new Response(body.slice(start, end + 1), { status: 206, headers });
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (
    request.method !== "GET" ||
    url.origin !== scope.origin ||
    !url.pathname.startsWith(scope.pathname)
  )
    return;
  const isContent = /\/atlas\/(entries|img|thumb|audio)\//.test(url.pathname);
  const isShell =
    request.mode === "navigate" || url.pathname.endsWith("/atlas/index.json");
  // Register persistence while the fetch event is active, so the worker stays alive through the write.
  let persist = Promise.resolve();
  const response = (async () => {
    const cache = await caches.open(isContent ? CONTENT : SHELL);
    const headers = new Headers(request.headers);
    const range = headers.get("range");
    headers.delete("range");
    const full = new Request(request, { headers });
    const hit = await cache.match(full);
    if (!isShell && hit) return ranged(hit, range);
    try {
      const fresh = await fetch(full);
      if (fresh.ok && fresh.status === 200 && fresh.type === "basic") {
        const copy = fresh.clone();
        persist = cache
          .put(full, copy)
          .then(() => isContent && trim(CONTENT, 1500))
          .catch(() => {});
      }
      return ranged(fresh, range);
    } catch {
      if (hit) return ranged(hit, range);
      if (request.mode === "navigate") {
        const fallback = await cache.match(shellURL);
        if (fallback) return fallback;
      }
      return new Response("此内容尚未缓存，请联网后再试。", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
  })();
  event.respondWith(response);
  event.waitUntil(response.then(() => persist));
});
