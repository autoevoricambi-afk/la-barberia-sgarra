import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import appointments from '../api/appointments.js';
import availability from '../api/availability.js';
import publicConfig from '../api/public-config.js';
import waitlist from '../api/waitlist.js';
import events from '../api/events.js';
import health from '../api/health.js';
import adminAuth from '../api/admin/auth.js';
import adminAppointments from '../api/admin/appointments.js';
import adminBlocks from '../api/admin/blocks.js';
import adminCatalog from '../api/admin/catalog.js';
import adminInventory from '../api/admin/inventory.js';
import adminWaitlist from '../api/admin/waitlist.js';
import adminMetrics from '../api/admin/metrics.js';
import processOutbox from '../api/cron/process-outbox.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.SGARRA_DEV_PORT || 8080);
const apiRoutes = new Map([
  ['/api/health', health],
  ['/api/public-config', publicConfig],
  ['/api/availability', availability],
  ['/api/appointments', appointments],
  ['/api/waitlist', waitlist],
  ['/api/events', events],
  ['/api/admin/auth', adminAuth],
  ['/api/admin/appointments', adminAppointments],
  ['/api/admin/blocks', adminBlocks],
  ['/api/admin/catalog', adminCatalog],
  ['/api/admin/inventory', adminInventory],
  ['/api/admin/waitlist', adminWaitlist],
  ['/api/admin/metrics', adminMetrics],
  ['/api/cron/process-outbox', processOutbox]
]);

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
  '.webp': 'image/webp',
  '.xml': 'application/xml; charset=utf-8'
};

function bodyFrom(request) {
  return new Promise((resolve, reject) => {
    let total = 0;
    const chunks = [];
    request.on('data', (chunk) => {
      total += chunk.length;
      if (total > 64 * 1024) {
        reject(new Error('body_too_large'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      if (!chunks.length) return resolve(undefined);
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(new Error('invalid_json')); }
    });
    request.on('error', reject);
  });
}

function attachVercelResponse(response) {
  response.status = function status(code) { this.statusCode = code; return this; };
  response.json = function json(payload) { this.end(JSON.stringify(payload)); return this; };
  return response;
}

function staticPath(pathname) {
  const aliases = new Map([
    ['/', 'index.html'],
    ['/privacy', 'privacy.html'],
    ['/admin', 'admin/index.html'],
    ['/admin/', 'admin/index.html']
  ]);
  const relative = aliases.get(pathname) || pathname.replace(/^\/+/, '');
  const resolved = path.resolve(root, relative);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) return null;
  return resolved;
}

const server = http.createServer(async (request, rawResponse) => {
  const response = attachVercelResponse(rawResponse);
  const url = new URL(request.url, `http://${request.headers.host || '127.0.0.1'}`);
  const handler = apiRoutes.get(url.pathname);

  if (handler) {
    request.query = Object.fromEntries(url.searchParams.entries());
    try { request.body = await bodyFrom(request); }
    catch {
      response.statusCode = 400;
      response.setHeader('Content-Type', 'application/json; charset=utf-8');
      response.end(JSON.stringify({ ok: false, error: { code: 'invalid_json', message: 'Richiesta non valida.' } }));
      return;
    }
    await handler(request, response);
    return;
  }

  const filePath = staticPath(decodeURIComponent(url.pathname));
  if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    response.statusCode = 404;
    response.setHeader('Content-Type', 'text/plain; charset=utf-8');
    response.end('Not found');
    return;
  }

  response.statusCode = 200;
  response.setHeader('Content-Type', mimeTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  if (request.method === 'HEAD') return response.end();
  fs.createReadStream(filePath).pipe(response);
});

server.listen(port, '127.0.0.1', () => {
  process.stdout.write(`Sgarra dev server: http://127.0.0.1:${port}\n`);
});
