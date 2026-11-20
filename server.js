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

// Detect uploaded .glb / .gltf / .obj / .mtl CAD files in /assets/models without causing client-side 404s
app.get('/api/robot-models', (req, res) => {
  const modelsDir = path.join(__dirname, 'assets', 'models');
  const result = {
    biobuzz: null,
    decode: null
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
          model = modelFiles.find((f) => !/decode/i.test(f)) || modelFiles[0];
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
      result.decode = findPair((f) => /decode/i.test(f), false);
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
