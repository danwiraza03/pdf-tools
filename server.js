/**
 * PDF Tools — Smart Dual-Mode Local Server
 * 1. Checks if Laragon (port 80) is running -> if yes, opens http://localhost/pdf/
 * 2. If Laragon is not running -> starts standalone server on http://localhost:8080/
 * 100% Zero-Dependency (uses only Node.js core modules).
 */
const http = require('http');
const net = require('net');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = process.env.PORT || 8080;
const ROOT_DIR = __dirname;

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

function startStandaloneServer() {
  const server = http.createServer((req, res) => {
    let cleanUrl = req.url.split('?')[0];
    if (cleanUrl === '/' || cleanUrl === '') {
      cleanUrl = '/index.html';
    }

    const safePath = path.normalize(decodeURIComponent(cleanUrl)).replace(/^(\.\.[\/\\])+/, '');
    let filePath = path.join(ROOT_DIR, safePath);

    fs.stat(filePath, (err, stats) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
        return;
      }

      if (stats.isDirectory()) {
        filePath = path.join(filePath, 'index.html');
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      res.setHeader('Content-Type', contentType);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'no-cache');

      const stream = fs.createReadStream(filePath);
      stream.on('error', () => {
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('500 Internal Server Error');
        }
      });
      stream.pipe(res);
    });
  });

  server.listen(PORT, () => {
    const url = `http://localhost:${PORT}/`;
    console.log(`\n==================================================`);
    console.log(`  PDF Tools — Server Mandiri Portabel Aktif!`);
    console.log(`==================================================`);
    console.log(`  Alamat: ${url}`);
    console.log(`  Status: Berjalan lancar tanpa Laragon.`);
    console.log(`  Tekan Ctrl + C di jendela ini untuk berhenti.\n`);

    const startCmd = process.platform === 'win32' ? `start "" "${url}"` : `open "${url}"`;
    exec(startCmd);
  });
}

// First check if Laragon is running
checkLaragon((isLaragonRunning) => {
  if (isLaragonRunning) {
    console.log(`\n==================================================`);
    console.log(`  PDF Tools — Laragon Terdeteksi Aktif!`);
    console.log(`==================================================`);
    console.log(`  Membuka via Laragon: http://localhost/pdf/\n`);

    const startCmd = process.platform === 'win32' ? `start "" "http://localhost/pdf/"` : `open "http://localhost/pdf/"`;
    exec(startCmd, () => {
      setTimeout(() => process.exit(0), 1000);
    });
    return;
  }

  // Otherwise, start standalone zero-config server
  console.log(`\n[INFO] Laragon tidak terdeteksi. Memulai server portabel mandiri...`);
  startStandaloneServer();
});
