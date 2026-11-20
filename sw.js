const CACHE_VERSION = 'v15';
const SHELL_CACHE = `rr-shell-${CACHE_VERSION}`;
const PAGE_CACHE = `rr-pages-${CACHE_VERSION}`;
const MEDIA_CACHE = `rr-media-${CACHE_VERSION}`;
const FONT_CACHE = `rr-fonts-${CACHE_VERSION}`;
const ACTIVE_CACHES = new Set([SHELL_CACHE, PAGE_CACHE, MEDIA_CACHE, FONT_CACHE]);

const CORE_SHELL_URLS = [
  '/',
  '/en/',
  '/de/',
  '/manifest.webmanifest',
  '/assets/css/templatemo-electric-xtra.css?v=20261119c',
  '/assets/css/templatemo-electric-xtra.css?v=20261120a',
  '/assets/js/templatemo-electric-scripts.js?v=20261120b',
  '/assets/js/robot-cad-viewer.js?v=20261120c',
  '/assets/images/opt/logo.webp',
  '/assets/images/logo.png',
  '/assets/images/pwa-192x192.png',
  '/assets/images/pwa-512x512.png',
  '/assets/images/pwa-maskable-512x512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => Promise.allSettled(
        CORE_SHELL_URLS.map(async (url) => {
          const res = await fetch(url, { cache: 'no-cache', credentials: 'same-origin' });
          if (res && res.status === 200 && !res.redirected) {
            await cache.put(url, res);
          }
        })
      ))
      .then(() => self.skipWaiting())
  );
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

async function cachePutSafe(cacheName, request, response) {
  if (!isCleanableResponse(response)) return;
  try {
    const cache = await caches.open(cacheName);
    await cache.put(request, response);
  } catch {
    // Ignore quota or transient storage errors
  }
}

// Stale-while-revalidate for HTML pages, CSS/JS shell, and CAD models
async function staleWhileRevalidate(request, cacheName, fallbackUrls = [], preloadPromise = null) {
  const cached = await caches.match(request);

  const fetchOpts = request.url.startsWith(self.location.origin) ? { cache: 'no-cache' } : undefined;
  const networkPromise = (async () => {
    try {
      const preloaded = preloadPromise ? await preloadPromise : null;
      const networkRes = preloaded || await fetch(request, fetchOpts);
      if (isCleanableResponse(networkRes)) {
        // Avoid storing redirected responses that browsers reject for navigation
        if (networkRes.redirected) {
          const cleanBody = await networkRes.clone().arrayBuffer();
          const cleanRes = new Response(cleanBody, {
            status: networkRes.status,
            statusText: networkRes.statusText,
            headers: networkRes.headers
          });
          await cachePutSafe(cacheName, request, cleanRes);
        } else {
          await cachePutSafe(cacheName, request, networkRes.clone());
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

// Network-first for HTML pages, JS, CSS, and CAD manifests so GitHub Pages updates apply on first reload
async function networkFirst(request, cacheName, fallbackUrls = [], preloadPromise = null) {
  try {
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
        await cachePutSafe(cacheName, request, networkRes.clone());
      }
      return networkRes;
    }
    if (networkRes) return networkRes;
  } catch {
    // Fall back to cache when offline
  }

  const cached = await caches.match(request);
  if (cached) return cached;

  for (const fb of fallbackUrls) {
    const fbMatch = await caches.match(fb);
    if (fbMatch) return fbMatch;
  }
  return new Response('Offline', { status: 503, statusText: 'Offline' });
}

// Cache-first for immutable / versioned media & font binaries
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const networkRes = await fetch(request);
    if (isCleanableResponse(networkRes)) {
      await cachePutSafe(cacheName, request, networkRes.clone());
    }
    return networkRes;
  } catch {
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

  // Only handle same-origin requests from here on
  if (url.origin !== self.location.origin) return;

  // Never intercept sw.js or dynamic /api/ routes
  if (url.pathname === '/sw.js' || url.pathname.startsWith('/api/')) return;

  // Dynamic model manifest should always prefer fresh network
  if (url.pathname.endsWith('/models.json')) {
    event.respondWith(networkFirst(request, SHELL_CACHE));
    return;
  }

  // CAD model files -> network-first so updated .glb files appear immediately while remaining cached offline
  if (
    url.pathname.startsWith('/assets/models/') ||
    /\.(?:glb|gltf|obj|mtl)$/i.test(url.pathname)
  ) {
    event.respondWith(networkFirst(request, MEDIA_CACHE));
    return;
  }

  // Static media, WASM decoders, fonts & icons -> Cache-First
  if (
    url.pathname.startsWith('/assets/images/') ||
    url.pathname.startsWith('/public/assets/') ||
    /\.(?:webp|png|jpe?g|gif|svg|ico|woff2?|wasm)$/i.test(url.pathname)
  ) {
    event.respondWith(cacheFirst(request, MEDIA_CACHE));
    return;
  }

  // Stylesheets, Scripts & Manifest -> Network-First with offline cache fallback
  if (
    url.pathname.startsWith('/assets/css/') ||
    url.pathname.startsWith('/assets/js/') ||
    url.pathname === '/manifest.webmanifest'
  ) {
    event.respondWith(networkFirst(request, SHELL_CACHE));
    return;
  }

  // HTML / Clean Navigation routes -> Network-First with offline cache fallback
  if (
    request.mode === 'navigate' ||
    (request.headers.get('accept') || '').includes('text/html') ||
    url.pathname === '/' ||
    url.pathname === '/en' ||
    url.pathname === '/de' ||
    url.pathname.startsWith('/en/') ||
    url.pathname.startsWith('/de/')
  ) {
    const fallback = url.pathname.startsWith('/de') ? ['/de/', '/en/', '/'] : ['/en/', '/de/', '/'];
    event.respondWith(networkFirst(request, PAGE_CACHE, fallback, event.preloadResponse));
  }
});

// Background precache handler triggered during idle time after page load
let precacheRunning = false;
self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || data.type !== 'PRECACHE' || !Array.isArray(data.urls) || precacheRunning) {
    return;
  }

  precacheRunning = true;
  event.waitUntil((async () => {
    try {
      const queue = [...new Set(data.urls)].filter(Boolean);
      const concurrency = 2;

      async function worker() {
        while (queue.length > 0) {
          const rawUrl = queue.shift();
          try {
            const absUrl = new URL(rawUrl, self.location.origin).href;
            const existing = await caches.match(absUrl);
            if (existing) continue;

            const isMedia = /\.(?:webp|png|jpe?g|gif|svg|ico|woff2?|wasm)$/i.test(absUrl);
            const targetCache = isMedia ? MEDIA_CACHE : PAGE_CACHE;
            const res = await fetch(absUrl, { credentials: 'same-origin' });
            if (isCleanableResponse(res) && !res.redirected) {
              await cachePutSafe(targetCache, absUrl, res);
            }
          } catch {
            // Skip failed individual precache item silently
          }
        }
      }

      await Promise.all(Array.from({ length: concurrency }, worker));
    } finally {
      precacheRunning = false;
    }
  })());
});
