import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';

function parseLangCookie(cookieHeader) {
  if (!cookieHeader || typeof cookieHeader !== 'string') return null;
  const match = cookieHeader.match(/(?:^|;\s*)rr_lang=(en|de)(?:;|$)/i);
  return match ? match[1].toLowerCase() : null;
}

function detectAcceptLanguage(header) {
  if (!header || typeof header !== 'string') return 'en';
  const parts = header.toLowerCase().split(',');
  let bestLang = 'en';
  let bestQ = -1;
  for (const part of parts) {
    const [rawTag, ...params] = part.trim().split(';');
    const tag = rawTag.trim();
    if (!tag) continue;
    let q = 1;
    for (const p of params) {
      const m = p.trim().match(/^q=([0-9.]+)$/);
      if (m) q = parseFloat(m[1]);
    }
    if (Number.isNaN(q) || q <= 0) continue;
    const base = tag.split('-')[0];
    if ((base === 'de' || base === 'en') && q > bestQ) {
      bestQ = q;
      bestLang = base;
    }
  }
  return bestLang;
}

function setLangCookie(res, req, lang) {
  const proto = String((req && req.headers && req.headers['x-forwarded-proto']) || '').toLowerCase();
  const isHttps = Boolean((req && req.secure) || proto.includes('https'));
  if (isHttps) {
    res.setHeader('Set-Cookie', `rr_lang=${lang}; Path=/; Max-Age=31536000; SameSite=None; Secure; Partitioned`);
  } else {
    res.setHeader('Set-Cookie', `rr_lang=${lang}; Path=/; Max-Age=31536000; SameSite=Lax`);
  }
}

const CLEAN_PAGE_SLUGS = new Set(['bot', 'team-details', 'battlebots', 'sponsors', 'chemie_ka']);

function getCleanPathFromSlug(slug) {
  if (!slug || slug === 'index') return '/';
  return CLEAN_PAGE_SLUGS.has(slug) ? `/${slug}` : null;
}

// Language-less clean URL normalization, legacy /en/ & /de/ redirects, and extensionless routing
app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();

  const reqPath = req.path;

  // Allow explicit raw language HTML fetches from client/static loaders without redirecting
  if (req.headers['x-rr-raw'] === '1' && /^\/(en|de)\/[a-z0-9_-]+\.html$/i.test(reqPath)) {
    const rawFile = path.join(__dirname, reqPath.slice(1));
    if (fs.existsSync(rawFile)) {
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
      return res.sendFile(rawFile);
    }
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(req.originalUrl, 'http://localhost');
  } catch {
    return next();
  }

  const rawLangParam = (parsedUrl.searchParams.get('lang') || '').toLowerCase();
  const hasValidLangParam = rawLangParam === 'en' || rawLangParam === 'de';
  if (hasValidLangParam) {
    parsedUrl.searchParams.delete('lang');
  }
  const cleanSearch = parsedUrl.searchParams.toString();
  const query = cleanSearch ? `?${cleanSearch}` : '';

  // Legacy /en/... or /de/... paths -> persist language cookie and redirect to clean URL without prefix
  const langPrefixMatch = reqPath.match(/^\/(en|de)(?:\/(.*))?$/i);
  if (langPrefixMatch) {
    const targetLang = langPrefixMatch[1].toLowerCase();
    let subPath = (langPrefixMatch[2] || '').replace(/\/+$/, '');
    if (subPath.toLowerCase() === 'index' || subPath.toLowerCase() === 'index.html' || subPath === '') {
      setLangCookie(res, req, targetLang);
      res.setHeader('Cache-Control', 'no-store');
      return res.redirect(302, `/${query}`);
    }
    if (subPath.toLowerCase().endsWith('.html')) {
      subPath = subPath.slice(0, -5);
    }
    const cleanTarget = getCleanPathFromSlug(subPath);
    if (cleanTarget) {
      setLangCookie(res, req, targetLang);
      res.setHeader('Cache-Control', 'no-store');
      return res.redirect(302, `${cleanTarget}${query}`);
    }
  }

  // /index.html -> /
  if (reqPath.toLowerCase() === '/index.html') {
    if (hasValidLangParam) setLangCookie(res, req, rawLangParam);
    return res.redirect(301, `/${query}`);
  }

  // /bot.html -> /bot, /bot/ -> /bot, etc.
  const rootHtmlMatch = reqPath.match(/^\/([^/]+)\.html$/i);
  if (rootHtmlMatch && CLEAN_PAGE_SLUGS.has(rootHtmlMatch[1])) {
    if (hasValidLangParam) setLangCookie(res, req, rawLangParam);
    return res.redirect(301, `/${rootHtmlMatch[1]}${query}`);
  }
  const rootSlashMatch = reqPath.match(/^\/([^/]+)\/$/);
  if (rootSlashMatch && CLEAN_PAGE_SLUGS.has(rootSlashMatch[1])) {
    if (hasValidLangParam) setLangCookie(res, req, rawLangParam);
    return res.redirect(301, `/${rootSlashMatch[1]}${query}`);
  }

  // /games/index.html & /games/game-XX-name/index.html -> extensionless directory URL
  if (/^\/games\/index\.html$/i.test(reqPath)) {
    return res.redirect(301, `/games/${query}`);
  }
  if (/^\/games\/[^/]+\/index\.html$/i.test(reqPath)) {
    return res.redirect(301, `${reqPath.slice(0, -'index.html'.length)}${query}`);
  }

  // Handle ?lang=en|de on clean page routes -> set cookie and redirect cleanly without ?lang=
  const normalizedSlug = reqPath === '/' ? 'index' : reqPath.slice(1);
  const isCleanPage = reqPath === '/' || CLEAN_PAGE_SLUGS.has(normalizedSlug);
  if (isCleanPage && hasValidLangParam) {
    setLangCookie(res, req, rawLangParam);
    res.setHeader('Cache-Control', 'no-store');
    return res.redirect(302, `${reqPath}${query}`);
  }

  // Serve EN or DE HTML directly on clean URLs (/, /bot, /team-details, /battlebots, /sponsors, /chemie_ka)
  if (isCleanPage) {
    const lang = parseLangCookie(req.headers.cookie) || detectAcceptLanguage(req.headers['accept-language']);
    let targetFile = path.join(__dirname, lang, `${normalizedSlug}.html`);
    if (!fs.existsSync(targetFile)) {
      targetFile = path.join(__dirname, 'en', `${normalizedSlug}.html`);
    }
    if (fs.existsSync(targetFile)) {
      res.setHeader('Vary', 'Cookie, Accept-Language');
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
      return res.sendFile(targetFile);
    }
  }

  return next();
});

// Service Worker & Manifest headers
app.get('/sw.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Service-Worker-Allowed', '/');
  res.sendFile(path.join(__dirname, 'sw.js'));
});

app.get('/manifest.webmanifest', (req, res) => {
  res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.sendFile(path.join(__dirname, 'manifest.webmanifest'));
});

// Detect uploaded .glb / .gltf / .obj / .mtl CAD files in /assets/models without causing client-side 404s
app.get('/api/robot-models', (req, res) => {
  const modelsDir = path.join(__dirname, 'assets', 'models');
  const result = {
    biobuzz: null
  };

  function isValidModelFile(fileName) {
    const fullPath = path.join(modelsDir, fileName);
    try {
      const stat = fs.statSync(fullPath);
      if (!stat.isFile()) return false;
      if (/\.glb$/i.test(fileName)) {
        if (stat.size < 20) return false;
        const fd = fs.openSync(fullPath, 'r');
        try {
          const header = Buffer.alloc(4);
          fs.readSync(fd, header, 0, 4, 0);
          return header.toString('ascii') === 'glTF';
        } finally {
          fs.closeSync(fd);
        }
      }
      return stat.size >= 16;
    } catch {
      return false;
    }
  }

  try {
    if (fs.existsSync(modelsDir)) {
      const files = fs.readdirSync(modelsDir);
      // Prefer .glb over .gltf over .obj
      const extRank = (name) => (/\.glb$/i.test(name) ? 0 : /\.gltf$/i.test(name) ? 1 : 2);
      const modelFiles = files
        .filter((f) => /\.(?:glb|gltf|obj)$/i.test(f) && isValidModelFile(f))
        .sort((a, b) => extRank(a) - extRank(b));

      const findPair = (matcher, fallbackToFirst = false) => {
        let model = modelFiles.find(matcher);
        if (!model && fallbackToFirst && modelFiles.length > 0) {
          model = modelFiles[0];
        }
        if (!model) return null;

        const isObj = /\.obj$/i.test(model);
        const format = /\.glb$/i.test(model) ? 'glb' : /\.gltf$/i.test(model) ? 'gltf' : 'obj';
        const baseName = model.replace(/\.(?:glb|gltf|obj)$/i, '');
        const mtl = isObj
          ? (files.find((f) => f.toLowerCase() === `${baseName.toLowerCase()}.mtl`) || null)
          : null;
        const url = `/assets/models/${encodeURIComponent(model)}`;

        return {
          format,
          url,
          obj: isObj ? url : null,
          mtl: mtl ? `/assets/models/${encodeURIComponent(mtl)}` : null,
          name: model
        };
      };

      result.biobuzz = findPair((f) => /biobuzz/i.test(f), true);
    }
  } catch {
    // Ignore directory read errors and return empty manifest
  }

  res.setHeader('Cache-Control', 'no-cache, must-revalidate');
  res.json(result);
});

app.use(express.static(__dirname, {
  extensions: ['html'],
  index: 'index.html',
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    if (/\.glb$/i.test(filePath)) {
      res.setHeader('Content-Type', 'model/gltf-binary');
    } else if (/\.gltf$/i.test(filePath)) {
      res.setHeader('Content-Type', 'model/gltf+json; charset=utf-8');
    } else if (/\.(?:obj|mtl)$/i.test(filePath)) {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    } else if (/\.wasm$/i.test(filePath)) {
      res.setHeader('Content-Type', 'application/wasm');
    }

    if (/\.(?:webp|png|jpe?g|gif|svg|ico|woff2?|obj|mtl|glb|gltf|wasm)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=2592000');
    } else if (/\.(?:css|js|mjs)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    } else if (/\.html$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    }
  }
}));

app.get('/', (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`RoboRooster static server listening on http://${HOST}:${PORT}`);
});
