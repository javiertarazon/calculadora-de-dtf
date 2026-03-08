const http = require('http');
const fs = require('fs');
const path = require('path');

const DEFAULT_PORT = 4173;
const PREFERRED_PORT = Number(process.env.PORT) || DEFAULT_PORT;
const MAX_PORT_ATTEMPTS = process.env.PORT ? 1 : 10;
const ROOT = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8'
};

function safePath(urlPath) {
  const cleanPath = decodeURIComponent(urlPath.split('?')[0]);
  const normalizedPath = cleanPath === '/' ? '/index.html' : cleanPath;
  const resolved = path.normalize(path.join(ROOT, normalizedPath));
  if (!resolved.startsWith(ROOT)) {
    return null;
  }
  return resolved;
}

function createServer() {
  return http.createServer((req, res) => {
    const filePath = safePath(req.url || '/');
    if (!filePath) {
      res.writeHead(403, {'Content-Type': 'text/plain; charset=utf-8'});
      res.end('Forbidden');
      return;
    }

    fs.readFile(filePath, (error, data) => {
      if (error) {
        if (error.code === 'ENOENT') {
          res.writeHead(404, {'Content-Type': 'text/plain; charset=utf-8'});
          res.end('Not found');
          return;
        }

        res.writeHead(500, {'Content-Type': 'text/plain; charset=utf-8'});
        res.end('Internal server error');
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
        'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600'
      });
      res.end(data);
    });
  });
}

function startServer(port, attempt = 1) {
  const server = createServer();

  server.listen(port, () => {
    console.log(`Calculadora DTF PRO disponible en http://127.0.0.1:${port}`);
    if (port !== PREFERRED_PORT) {
      console.log(`Puerto alternativo usado porque ${PREFERRED_PORT} estaba ocupado.`);
    }
  });

  server.once('error', (error) => {
    if (error.code === 'EADDRINUSE' && attempt < MAX_PORT_ATTEMPTS) {
      const nextPort = port + 1;
      console.warn(`Puerto ${port} ocupado. Reintentando en ${nextPort}...`);
      startServer(nextPort, attempt + 1);
      return;
    }

    throw error;
  });
}

startServer(PREFERRED_PORT);
