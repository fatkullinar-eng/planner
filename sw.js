/* Service worker: офлайн-кеш приложения.
   Стратегия «сначала сеть»: онлайн файлы всегда свежие, офлайн — из кеша.
   Версию CACHE увеличивают, когда из списка ASSETS что-то удалили:
   иначе старые записи останутся в хранилище. */

const CACHE = "planner-v2";

const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
      .catch((error) => console.warn("Не удалось закешировать файлы:", error)),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      // Удаляем только свои старые кеши: на github.io один origin на все проекты.
      .then((keys) => Promise.all(
        keys.filter((key) => key.startsWith("planner-") && key !== CACHE).map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  // Сначала сеть: при интернете всегда свежие файлы. Без сети — кеш.
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Кешируем только успешные ответы: страницы ошибок в кеш не нужны.
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy)).catch(() => {});
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => {
        if (cached) return cached;
        if (event.request.mode === "navigate") {
          return caches.match("./index.html").then((fallback) => (
            fallback || new Response("Офлайн: страница недоступна", {
              status: 503,
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            })
          ));
        }
        return new Response("", { status: 504 });
      })),
  );
});
