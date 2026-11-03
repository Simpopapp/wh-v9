// Service worker v5 (projeto 13, Fase 5 — precache gerado pelo build).
//  - install: lê /sw-assets.json (gerado pelo build com TODOS os assets emitidos —
//    chunks de rotas, motores e dependências) + as rotas HTML, e exige o shell
//    COMPLETO: qualquer asset que falhe impede a instalação (estado honesto,
//    nada de "pronto" parcial). `response.ok` validado em todo fetch.
//  - activate: retenção por versão — caches antigos são APAGADOS (não copiados);
//    o download das questões é refeito pelo painel offline quando necessário.
//  - /assets/* (hash, imutável): cache-first; navegação (HTML): rede primeiro,
//    sem rede última cópia da página (ou a Home).
// Mude VERSION a cada mudança deste arquivo — o navegador só detecta SW novo se os bytes mudarem.
const VERSION = "5";
const CACHE = `pte-master-hub-v${VERSION}`;
const PRECACHE_ROUTES = [
  "/",
  "/speaking",
  "/writing",
  "/reading",
  "/listening",
  "/practice",
  "/session",
  "/progress",
  "/exam",
  "/settings",
  "/vocabulary",
  "/manifest.webmanifest",
  "/favicon.svg",
  "/icon-192.png",
  "/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // 1) Manifesto do build: a lista exata de assets publicados. Falha aqui
      //    impede a instalação — não existe offline "mais ou menos".
      const manifestRes = await fetch("/sw-assets.json", { cache: "no-store" });
      if (!manifestRes.ok) {
        await caches.delete(CACHE);
        throw new Error(`sw-assets.json indisponível (${manifestRes.status})`);
      }
      const assets = await manifestRes.json();
      if (!Array.isArray(assets) || assets.length === 0) {
        await caches.delete(CACHE);
        throw new Error("sw-assets.json vazio ou inválido");
      }

      // 2) Shell completo: todo asset + toda rota validados com response.ok.
      const failed = [];
      await Promise.all(
        [...assets, ...PRECACHE_ROUTES].map(async (u) => {
          try {
            const res = await fetch(new Request(u, { cache: "reload" }));
            if (!res.ok) throw new Error(String(res.status));
            await cache.put(u, res);
          } catch {
            failed.push(u);
          }
        }),
      );
      if (failed.length > 0) {
        await caches.delete(CACHE);
        throw new Error(`precache incompleto — ${failed.length} item(ns) falharam`);
      }

      // Primeira instalação: assume já. Atualização: espera o aluno aceitar.
      if (!self.registration.active) await self.skipWaiting();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("pte-master-hub-") && k !== CACHE)
            .map((old) => caches.delete(old)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  const isPage =
    req.mode === "navigate" ||
    (req.headers.get("accept") || "").includes("text/html") ||
    !url.pathname.includes(".");
  if (isPage) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(url.pathname, copy));
          }
          return res;
        })
        .catch(
          async () =>
            (await caches.match(url.pathname)) ?? (await caches.match("/")) ?? Response.error(),
        ),
    );
  }
});
