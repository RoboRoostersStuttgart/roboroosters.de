const CACHE_VERSION = 'v27';
const SHELL_CACHE = `rr-shell-${CACHE_VERSION}`;
const PAGE_CACHE = `rr-pages-${CACHE_VERSION}`;
const MEDIA_CACHE = `rr-media-${CACHE_VERSION}`;
const FONT_CACHE = `rr-fonts-${CACHE_VERSION}`;
const ACTIVE_CACHES = new Set([SHELL_CACHE, PAGE_CACHE, MEDIA_CACHE, FONT_CACHE]);

const CORE_SHELL_URLS = [
  '/',
  '/bot',
  '/team-details',
  '/battlebots',
  '/sponsors',
  '/en/index.html',
  '/en/team-details.html',
  '/en/bot.html',
  '/en/battlebots.html',
  '/en/sponsors.html',
  '/manifest.webmanifest',
  '/assets/css/templatemo-electric-xtra.css?v=20261121k',
  '/assets/js/templatemo-electric-scripts.js?v=20261121k',
  '/assets/js/modules/team-spotlight.js?v=20261121k',
  '/assets/js/modules/lightbox-gallery.js?v=20261121k',
  '/assets/js/modules/offline-vault.js?v=20261121k',
  '/assets/js/modules/pwa-install.js?v=20261121k',
  '/assets/js/robot-cad-viewer.js?v=20261121k',
  '/assets/images/opt/logo.webp',
  '/assets/images/logo.png',
  '/assets/images/pwa-192x192.png',
  '/assets/images/pwa-512x512.png',
  '/assets/images/pwa-maskable-512x512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const shellCache = await caches.open(SHELL_CACHE);
    const pageCache = await caches.open(PAGE_CACHE);
    const mediaCache = await caches.open(MEDIA_CACHE);

    await Promise.allSettled(
      CORE_SHELL_URLS.map(async (url) => {
        try {
          const isHtml = url === '/' || !url.includes('.') || /\.html$/i.test(url);
          const isMedia = /\.(?:avif|webp|png|jpe?g|gif|svg|ico|woff2?|wasm)$/i.test(url);
          const targetCache = isHtml ? pageCache : (isMedia ? mediaCache : shellCache);
          const headers = /^\/(en|de)\/[^/]+\.html$/i.test(url) ? { 'X-RR-Raw': '1' } : undefined;
          const res = await fetch(url, { cache: 'no-cache', credentials: 'same-origin', headers });
          if (res && res.status === 200 && !res.redirected) {
            await targetCache.put(url, res);
          }
        } catch {
          // Ignore single transient fetch failure so install never aborts
        }
      })
    );
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((key) => !ACTIVE_CACHES.has(key)).map((key) => caches.delete(key))
    );
    if (self.registration && self.registration.navigationPreload) {
      try {
        await self.registration.navigationPreload.enable();
      } catch {
        // Ignore if navigationPreload is unavailable
      }
    }
    await self.clients.claim();
  })());
});

function isCleanableResponse(res) {
  return res && (res.status === 200 || res.type === 'opaque');
}

async function trimOldMediaEntries(maxToDelete = 12) {
  try {
    const cache = await caches.open(MEDIA_CACHE);
    const keys = await cache.keys();
    if (!keys.length) return;
    const sorted = keys.sort((a, b) => {
      const aHeavy = /\.(?:glb|gltf|obj|wasm)$/i.test(a.url) ? 0 : 1;
      const bHeavy = /\.(?:glb|gltf|obj|wasm)$/i.test(b.url) ? 0 : 1;
      return aHeavy - bHeavy;
    });
    const slice = sorted.slice(0, maxToDelete);
    await Promise.all(slice.map((req) => cache.delete(req)));
  } catch {
    // Ignore eviction failures
  }
}

async function cachePutSafe(cacheName, request, response) {
  if (!isCleanableResponse(response)) return;
  try {
    const cache = await caches.open(cacheName);
    await cache.put(request, response.clone());
  } catch (err) {
    if (err && (err.name === 'QuotaExceededError' || String(err).toLowerCase().includes('quota'))) {
      await trimOldMediaEntries(14);
      if (cacheName !== MEDIA_CACHE) {
        try {
          const cache = await caches.open(cacheName);
          await cache.put(request, response);
        } catch {
          // Storage still tight — fail gracefully and stream from network
        }
      }
    }
  }
}

// Stale-while-revalidate for HTML templates, ES modules, CSS/JS shell, and Google Fonts CSS
async function staleWhileRevalidate(request, cacheName, fallbackUrls = [], preloadPromise = null) {
  const cached = await caches.match(request);

  const fetchOpts = request.url.startsWith(self.location.origin) ? { cache: 'no-cache' } : undefined;
  const networkPromise = (async () => {
    try {
      const preloaded = preloadPromise ? await preloadPromise : null;
      const networkRes = preloaded || await fetch(request, fetchOpts);
      if (isCleanableResponse(networkRes)) {
        if (networkRes.redirected) {
          const cleanBody = await networkRes.clone().arrayBuffer();
          const cleanRes = new Response(cleanBody, {
            status: networkRes.status,
            statusText: networkRes.statusText,
            headers: networkRes.headers
          });
          await cachePutSafe(cacheName, request, cleanRes);
        } else {
          await cachePutSafe(cacheName, request, networkRes);
        }
      }
      return networkRes;
    } catch {
      return null;
    }
  })();

  if (cached) {
    return cached;
  }

  const networkRes = await networkPromise;
  if (networkRes) return networkRes;

  for (const fb of fallbackUrls) {
    const fbMatch = await caches.match(fb);
    if (fbMatch) return fbMatch;
  }
  return new Response('Offline', { status: 503, statusText: 'Offline' });
}

// Network-first with fast 550ms timeout race so cached repeat visits never stall on weak networks
async function networkFirst(request, cacheName, fallbackUrls = [], preloadPromise = null, timeoutMs = 550) {
  const cached = await caches.match(request);

  const networkAttempt = (async () => {
    const preloaded = preloadPromise ? await preloadPromise : null;
    const fetchOpts = request.url.startsWith(self.location.origin) ? { cache: 'no-cache' } : undefined;
    const networkRes = preloaded || await fetch(request, fetchOpts);
    if (isCleanableResponse(networkRes)) {
      if (networkRes.redirected) {
        const cleanBody = await networkRes.clone().arrayBuffer();
        const cleanRes = new Response(cleanBody, {
          status: networkRes.status,
          statusText: networkRes.statusText,
          headers: networkRes.headers
        });
        await cachePutSafe(cacheName, request, cleanRes);
      } else {
        await cachePutSafe(cacheName, request, networkRes);
      }
      return networkRes;
    }
    return networkRes || null;
  })();

  if (cached) {
    try {
      const winner = await Promise.race([
        networkAttempt.catch(() => null),
        new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs))
      ]);
      if (winner) return winner;
    } catch {
      // Fall back to cached copy immediately
    }
    return cached;
  }

  try {
    const networkRes = await networkAttempt;
    if (networkRes) return networkRes;
  } catch {
    // Fall back to shell fallback URLs when offline
  }

  for (const fb of fallbackUrls) {
    const fbMatch = await caches.match(fb);
    if (fbMatch) return fbMatch;
  }
  return new Response('Offline', { status: 503, statusText: 'Offline' });
}

// Cache-first for immutable / versioned media, Three.js modules & font binaries (with AVIF <-> WebP offline sibling fallback)
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const networkRes = await fetch(request);
    if (isCleanableResponse(networkRes)) {
      await cachePutSafe(cacheName, request, networkRes);
    }
    return networkRes;
  } catch {
    const urlStr = request.url;
    if (/\.avif$/i.test(urlStr)) {
      const webpFallback = await caches.match(urlStr.replace(/\.avif$/i, '.webp'));
      if (webpFallback) return webpFallback;
    } else if (/\.webp$/i.test(urlStr)) {
      const avifFallback = await caches.match(urlStr.replace(/\.webp$/i, '.avif'));
      if (avifFallback) return avifFallback;
    }
    return new Response('', { status: 408 });
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  // Never intercept partial-content / Range probes (e.g. .glb magic-byte checks)
  if (request.headers.has('range')) return;

  const url = new URL(request.url);

  // Google Fonts caching
  if (url.origin === 'https://fonts.googleapis.com') {
    event.respondWith(staleWhileRevalidate(request, FONT_CACHE));
    return;
  }
  if (url.origin === 'https://fonts.gstatic.com') {
    event.respondWith(cacheFirst(request, FONT_CACHE));
    return;
  }

  if (url.origin !== self.location.origin) return;
  if (url.pathname === '/sw.js' || url.pathname.startsWith('/api/')) return;

  if (url.pathname.endsWith('/models.json')) {
    event.respondWith(networkFirst(request, SHELL_CACHE, [], null, 1200));
    return;
  }

  // CAD model files -> cache-first for 0ms repeat loads once downloaded
  if (
    url.pathname.startsWith('/assets/models/') ||
    /\.(?:glb|gltf|obj|mtl)$/i.test(url.pathname)
  ) {
    event.respondWith(cacheFirst(request, MEDIA_CACHE));
    return;
  }

  // Optimized & static images, WASM decoders, fonts & icons -> Cache-First
  if (
    url.pathname.startsWith('/assets/images/') ||
    url.pathname.startsWith('/public/assets/') ||
    /\.(?:avif|webp|png|jpe?g|gif|svg|ico|woff2?|wasm)$/i.test(url.pathname)
  ) {
    event.respondWith(cacheFirst(request, MEDIA_CACHE));
    return;
  }

  // Versioned Stylesheets, Route Modules & Three.js runtime -> Cache-First
  if (
    ((url.pathname.startsWith('/assets/css/') || url.pathname.startsWith('/assets/js/')) && url.searchParams.has('v')) ||
    url.pathname.startsWith('/assets/js/three/')
  ) {
    event.respondWith(cacheFirst(request, SHELL_CACHE));
    return;
  }

  // Unversioned CSS/JS & Manifest -> Stale-While-Revalidate
  if (
    url.pathname.startsWith('/assets/css/') ||
    url.pathname.startsWith('/assets/js/') ||
    url.pathname === '/manifest.webmanifest'
  ) {
    event.respondWith(staleWhileRevalidate(request, SHELL_CACHE));
    return;
  }

  // Raw EN/DE HTML templates fetched by instant client router -> Stale-While-Revalidate for 0ms switches
  if (
    request.headers.get('x-rr-raw') === '1' ||
    /^\/(en|de)\/[^/]+\.html$/i.test(url.pathname)
  ) {
    event.respondWith(staleWhileRevalidate(request, PAGE_CACHE));
    return;
  }

  // Games section -> Stale-While-Revalidate so offline play works once opened
  if (url.pathname.startsWith('/games/')) {
    event.respondWith(staleWhileRevalidate(request, PAGE_CACHE, ['/games/index.html']));
    return;
  }

  // HTML / Clean Navigation routes -> Fast 550ms timeout race with instant cache fallback
  if (
    request.mode === 'navigate' ||
    (request.headers.get('accept') || '').includes('text/html') ||
    url.pathname === '/' ||
    url.pathname === '/bot' ||
    url.pathname === '/team-details' ||
    url.pathname === '/battlebots' ||
    url.pathname === '/sponsors' ||
    url.pathname === '/chemie_ka' ||
    url.pathname === '/en' ||
    url.pathname === '/de' ||
    url.pathname.startsWith('/en/') ||
    url.pathname.startsWith('/de/')
  ) {
    event.respondWith(networkFirst(request, PAGE_CACHE, ['/'], event.preloadResponse, 550));
  }
});

// Adaptive background precaching with foreground navigation pause/resume yielding
let precacheRunning = false;
let precachePaused = false;
let resumeResolvers = [];
let quotaExhausted = false;

function waitWhilePaused() {
  if (!precachePaused) return Promise.resolve();
  return new Promise((resolve) => {
    resumeResolvers.push(resolve);
  });
}

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || !data.type) return;

  if (data.type === 'PAUSE_PRECACHE') {
    precachePaused = true;
    return;
  }

  if (data.type === 'RESUME_PRECACHE') {
    precachePaused = false;
    while (resumeResolvers.length > 0) {
      const resolve = resumeResolvers.shift();
      if (resolve) resolve();
    }
    return;
  }

  if (data.type !== 'PRECACHE' || !Array.isArray(data.urls) || precacheRunning || quotaExhausted) {
    return;
  }

  precacheRunning = true;
  event.waitUntil((async () => {
    try {
      const queue = [...new Set(data.urls)].filter(Boolean);
      const concurrency = data.tier === 'max' ? 2 : 1;

      async function worker() {
        while (queue.length > 0 && !quotaExhausted) {
          await waitWhilePaused();
          const rawUrl = queue.shift();
          if (!rawUrl) continue;

          try {
            const absUrl = new URL(rawUrl, self.location.origin).href;
            const existing = await caches.match(absUrl);
            if (existing) continue;

            const pathOnly = new URL(absUrl).pathname;
            const isShell = /\.(?:css|js|mjs|json)$/i.test(pathOnly);
            const isMedia = /\.(?:avif|webp|png|jpe?g|gif|svg|ico|woff2?|wasm|glb|gltf|obj|mtl)$/i.test(pathOnly);
            const targetCache = isShell ? SHELL_CACHE : (isMedia ? MEDIA_CACHE : PAGE_CACHE);
            const headers = /^\/(en|de)\/[^/]+\.html$/i.test(pathOnly) ? { 'X-RR-Raw': '1' } : undefined;

            const res = await fetch(absUrl, { credentials: 'same-origin', headers });
            if (isCleanableResponse(res) && !res.redirected) {
              try {
                const cache = await caches.open(targetCache);
                await cache.put(absUrl, res);
              } catch (err) {
                if (err && (err.name === 'QuotaExceededError' || String(err).toLowerCase().includes('quota'))) {
                  quotaExhausted = true;
                  break;
                }
              }
            }
          } catch {
            // Skip failed individual item without breaking remaining precache queue
          }
        }
      }

      await Promise.all(Array.from({ length: concurrency }, worker));
    } finally {
      precacheRunning = false;
    }
  })());
});
