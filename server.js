import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';

// Redirect any .html URL to its clean extensionless equivalent (preserving query string)
app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();

  const reqPath = req.path;
  const queryIdx = req.originalUrl.indexOf('?');
  const query = queryIdx !== -1 ? req.originalUrl.slice(queryIdx) : '';

  // /index.html -> /, /en/index.html -> /en/, /de/index.html -> /de/, /games/index.html -> /games/
  if (reqPath === '/index.html') {
    return res.redirect(301, `/${query}`);
  }
  if (/^\/(en|de|games)\/index\.html$/i.test(reqPath)) {
    const dir = reqPath.slice(0, -'index.html'.length);
    return res.redirect(301, `${dir}${query}`);
  }

  // /en/bot.html -> /en/bot, /de/sponsors.html -> /de/sponsors, etc.
  if (/^\/(en|de)\/[^/]+\.html$/i.test(reqPath)) {
    return res.redirect(301, `${reqPath.slice(0, -5)}${query}`);
  }

  // /games/game-XX-name/index.html -> /games/game-XX-name/
  if (/^\/games\/[^/]+\/index\.html$/i.test(reqPath)) {
    return res.redirect(301, `${reqPath.slice(0, -'index.html'.length)}${query}`);
  }

  // If someone visits /en/bot/ with trailing slash where en/bot.html exists (not a dir), redirect to /en/bot
  if (/^\/(en|de)\/[^/]+\/$/.test(reqPath)) {
    const candidateHtml = path.join(__dirname, `${reqPath.slice(1, -1)}.html`);
    if (fs.existsSync(candidateHtml)) {
      return res.redirect(301, `${reqPath.slice(0, -1)}${query}`);
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

app.use(express.static(__dirname, {
  extensions: ['html'],
  index: 'index.html',
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    if (/\.(?:webp|png|jpe?g|gif|svg|ico|woff2?)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=2592000');
    } else if (/\.(?:css|js)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
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
