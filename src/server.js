#!/usr/bin/env node

/**
 * Production server for TaskZM PWA
 * Serves static files with proper headers for PWA support
 * Falls back to index.html for SPA routing
 */

import { createServer } from 'http';
import { readFileSync, existsSync, statSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.env.PORT || 4173;
const DIST_DIR = join(__dirname, 'dist');

// MIME types for proper file serving
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.webp': 'image/webp',
};

// Static files that should be served directly (not through SPA routing)
const STATIC_PATHS = [
  '/manifest.json',
  '/favicon.ico',
  '/icon-16.png',
  '/icon-32.png',
  '/icon-180.png',
  '/icon-192.png',
  '/icon-512.png',
  '/service-worker.js',
  '/build-info.json',
  '/robots.txt',
  '/sitemap.xml',
];

function getMimeType(path) {
  const ext = extname(path);
  return MIME_TYPES[ext] || 'application/octet-stream';
}

function serveStaticFile(path, res) {
  const filePath = join(DIST_DIR, path);
  
  if (!existsSync(filePath)) {
    return false;
  }

  const stats = statSync(filePath);
  if (!stats.isFile()) {
    return false;
  }

  try {
    const content = readFileSync(filePath);
    const mimeType = getMimeType(filePath);
    
    // Set headers for PWA files
    const headers = {
      'Content-Type': mimeType,
      'Content-Length': content.length,
    };

    // Cache headers for static assets
    if (path.startsWith('/assets/') && (path.endsWith('.js') || path.endsWith('.css'))) {
      headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    } else if (path.startsWith('/assets/') || STATIC_PATHS.includes(path)) {
      headers['Cache-Control'] = 'public, max-age=31536000, immutable';
    } else if (path.startsWith('/avatars/')) {
      // Avatar files: cache for 1 week, but allow revalidation
      headers['Cache-Control'] = 'public, max-age=604800, must-revalidate';
    } else {
      headers['Cache-Control'] = 'public, max-age=0, must-revalidate';
    }

    // Service Worker must be served with no-cache header
    if (path === '/service-worker.js') {
      headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
      headers['Service-Worker-Allowed'] = '/';
    }

    // Manifest.json should be cacheable but not too long
    if (path === '/manifest.json') {
      headers['Cache-Control'] = 'public, max-age=3600';
    }

    res.writeHead(200, headers);
    res.end(content);
    return true;
  } catch (error) {
    console.error('Error serving file:', error);
    return false;
  }
}

function serveSPA(req, res) {
  const indexPath = join(DIST_DIR, 'index.html');
  
  if (!existsSync(indexPath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 - Not Found');
    return;
  }

  try {
    const content = readFileSync(indexPath);
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Length': content.length,
      // Revalidate so browsers don't show stale app after deploy
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    });
    res.end(content);
  } catch (error) {
    console.error('Error serving index.html:', error);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('500 - Internal Server Error');
  }
}

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  // Serve static assets from /assets directory (CSS, JS, images, fonts)
  if (pathname.startsWith('/assets/')) {
    if (serveStaticFile(pathname, res)) {
      return;
    }
    // If asset file not found, return 404
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 - Asset Not Found');
    return;
  }

  // Serve avatar files from /avatars directory
  if (pathname.startsWith('/avatars/')) {
    if (serveStaticFile(pathname, res)) {
      return;
    }
    // If avatar file not found, return 404
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 - Avatar Not Found');
    return;
  }

  // Serve known static files
  if (STATIC_PATHS.includes(pathname)) {
    if (serveStaticFile(pathname, res)) {
      return;
    }
  }

  // For all other routes, serve index.html (SPA routing)
  serveSPA(req, res);
});

server.listen(PORT, () => {
  console.log(`🚀 TaskZM PWA Server running on port ${PORT}`);
  console.log(`📁 Serving from: ${DIST_DIR}`);
  console.log(`🌐 Access at: http://localhost:${PORT}`);
  console.log(`✅ PWA ready for deployment`);
});

