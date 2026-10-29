/**
 * PDF Tools — Smart Dual-Mode Local Server
 * 1. Checks if Laragon (port 80) is running -> if yes, opens http://127.0.0.1/pdf/
 * 2. If Laragon is not running -> starts standalone server on http://127.0.0.1:8080/
 * 100% Zero-Dependency (uses only Node.js core modules).
 * Strict security: Binds exclusively to 127.0.0.1, strict path traversal defense, zero external CORS.
 */
const http = require('http');
const net = require('net');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = parseInt(process.env.PORT, 10) || 8080;
const HOST = '127.0.0.1';
const ROOT_DIR = path.resolve(__dirname, '..');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

function checkLaragon(callback) {
  const socket = new net.Socket();
  socket.setTimeout(600);
  socket.on('connect', () => {
    socket.destroy();
    callback(true);
  });
  socket.on('error', () => {
    socket.destroy();
    callback(false);
  });
  socket.on('timeout', () => {
    socket.destroy();
    callback(false);
  });
  socket.connect(80, '127.0.0.1');
}

/**
 * Core HTTP Request Handler with strict path traversal defense
 */
function handleRequest(req, res) {
  let decodedUrl = '';
  try {
    decodedUrl = decodeURIComponent(req.url.split('?')[0]);
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('400 Bad Request');
    return;
  }

  // Reject null bytes to prevent null byte poisoning
  if (decodedUrl.includes('\0')) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('400 Bad Request');
    return;
  }

  if (decodedUrl === '/' || decodedUrl === '') {
    decodedUrl = '/index.html';
  }

  // Remove leading slashes so path resolves relative to ROOT_DIR
  const cleanRelative = decodedUrl.replace(/^[\/\\]+/, '');
  let filePath = path.resolve(ROOT_DIR, cleanRelative);

  // Path traversal defense: resolved path must stay strictly inside ROOT_DIR
  const relFromRoot = path.relative(ROOT_DIR, filePath);
  if (relFromRoot.startsWith('..') || path.isAbsolute(relFromRoot)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('403 Forbidden: Access denied');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }

    if (stats.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
      const relDirFromRoot = path.relative(ROOT_DIR, filePath);
      if (relDirFromRoot.startsWith('..') || path.isAbsolute(relDirFromRoot)) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('403 Forbidden: Access denied');
        return;
      }
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    const stream = fs.createReadStream(filePath);
    stream.on('error', () => {
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('500 Internal Server Error');
      }
    });
    stream.pipe(res);
  });
}

function startStandaloneServer(port = PORT, host = HOST, autoOpen = true) {
  const server = http.createServer(handleRequest);

  server.listen(port, host, () => {
    const url = `http://${host}:${port}/`;
    console.log(`\n==================================================`);
    console.log(`  PDF Tools — Server Mandiri Portabel Aktif!`);
    console.log(`==================================================`);
    console.log(`  Alamat: ${url}`);
    console.log(`  Host: ${host} (Lokal saja)`);
    console.log(`  Status: Berjalan lancar tanpa Laragon.`);
    console.log(`  Tekan Ctrl + C di jendela ini untuk berhenti.\n`);

    if (autoOpen) {
      const startCmd = process.platform === 'win32' ? `start "" "${url}"` : `open "${url}"`;
      exec(startCmd);
    }
  });

  return server;
}

if (require.main === module) {
  // First check if Laragon is running
  checkLaragon((isLaragonRunning) => {
    if (isLaragonRunning) {
      console.log(`\n==================================================`);
      console.log(`  PDF Tools — Laragon Terdeteksi Aktif!`);
      console.log(`==================================================`);
      console.log(`  Membuka via Laragon: http://127.0.0.1/pdf/\n`);

      const startCmd = process.platform === 'win32' ? `start "" "http://127.0.0.1/pdf/"` : `open "http://127.0.0.1/pdf/"`;
      exec(startCmd, () => {
        setTimeout(() => process.exit(0), 1000);
      });
      return;
    }

    // Otherwise, start standalone zero-config server bound to 127.0.0.1
    console.log(`\n[INFO] Laragon tidak terdeteksi. Memulai server portabel mandiri pada 127.0.0.1...`);
    startStandaloneServer(PORT, HOST, true);
  });
}

module.exports = {
  startStandaloneServer,
  handleRequest,
  checkLaragon,
  HOST,
  PORT,
  ROOT_DIR,
  MIME_TYPES
};
