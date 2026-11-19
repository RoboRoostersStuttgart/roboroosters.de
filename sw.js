const CACHE_VERSION = 'v9';
const SHELL_CACHE = `rr-shell-${CACHE_VERSION}`;
const PAGE_CACHE = `rr-pages-${CACHE_VERSION}`;
const MEDIA_CACHE = `rr-media-${CACHE_VERSION}`;
const FONT_CACHE = `rr-fonts-${CACHE_VERSION}`;
const ACTIVE_CACHES = new Set([SHELL_CACHE, PAGE_CACHE, MEDIA_CACHE, FONT_CACHE]);

const CORE_SHELL_URLS = [
  '/manifest.webmanifest',
  '/assets/css/templatemo-electric-xtra.css?v=20261119',
  '/assets/js/templatemo-electric-scripts.js?v=20261119',
  '/assets/js/robot-cad-viewer.js?v=20261119b',
  '/assets/images/opt/logo.webp',
  '/assets/images/logo.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(CORE_SHELL_URLS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => !ACTIVE_CACHES.has(key)).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
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

// Stale-while-revalidate for HTML pages and CSS/JS/font CSS
async function staleWhileRevalidate(request, cacheName, fallbackUrls = []) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchOpts = request.url.startsWith(self.location.origin) ? { cache: 'no-cache' } : undefined;
  const networkPromise = fetch(request, fetchOpts)
    .then(async (networkRes) => {
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
    })
    .catch(() => null);

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

  // CAD model uploads -> Stale-While-Revalidate so replaced models stay fresh while loading fast
  if (
    url.pathname.startsWith('/assets/models/') ||
    /\.(?:glb|gltf|obj|mtl)$/i.test(url.pathname)
  ) {
    event.respondWith(staleWhileRevalidate(request, MEDIA_CACHE));
    return;
  }

  // Static media, WASM decoders & icons -> Cache-First
  if (
    url.pathname.startsWith('/assets/images/') ||
    url.pathname.startsWith('/public/assets/') ||
    /\.(?:webp|png|jpe?g|gif|svg|ico|woff2?|wasm)$/i.test(url.pathname)
  ) {
    event.respondWith(cacheFirst(request, MEDIA_CACHE));
    return;
  }

  // Stylesheets & Scripts -> Stale-While-Revalidate
  if (
    url.pathname.startsWith('/assets/css/') ||
    url.pathname.startsWith('/assets/js/') ||
    url.pathname === '/manifest.webmanifest'
  ) {
    event.respondWith(staleWhileRevalidate(request, SHELL_CACHE));
    return;
  }

  // HTML / Clean Navigation routes -> Stale-While-Revalidate
  if (
    request.mode === 'navigate' ||
    (request.headers.get('accept') || '').includes('text/html') ||
    url.pathname.startsWith('/en/') ||
    url.pathname.startsWith('/de/')
  ) {
    const fallback = url.pathname.startsWith('/de/') ? ['/de/', '/en/'] : ['/en/', '/de/'];
    event.respondWith(staleWhileRevalidate(request, PAGE_CACHE, fallback));
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

            const isMedia = /\.(?:webp|png|jpe?g|svg|ico)$/i.test(absUrl);
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
