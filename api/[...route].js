import appointments from './_routes/appointments.js';
import availability from './_routes/availability.js';
import events from './_routes/events.js';
import health from './_routes/health.js';
import publicConfig from './_routes/public-config.js';
import waitlist from './_routes/waitlist.js';
import adminAppointments from './_routes/admin/appointments.js';
import adminAuth from './_routes/admin/auth.js';
import adminBlocks from './_routes/admin/blocks.js';
import adminCatalog from './_routes/admin/catalog.js';
import adminInventory from './_routes/admin/inventory.js';
import adminMetrics from './_routes/admin/metrics.js';
import adminWaitlist from './_routes/admin/waitlist.js';
import processOutbox from './_routes/cron/process-outbox.js';
import { sendJson } from './_lib/http.js';

const handlers = new Map([
  ['health', health],
  ['public-config', publicConfig],
  ['availability', availability],
  ['appointments', appointments],
  ['waitlist', waitlist],
  ['events', events],
  ['admin/auth', adminAuth],
  ['admin/appointments', adminAppointments],
  ['admin/blocks', adminBlocks],
  ['admin/catalog', adminCatalog],
  ['admin/inventory', adminInventory],
  ['admin/waitlist', adminWaitlist],
  ['admin/metrics', adminMetrics],
  ['cron/process-outbox', processOutbox]
]);

function routeKey(request) {
  const route = request.query?.route;
  if (Array.isArray(route)) return route.join('/');
  if (typeof route === 'string' && route) return route.replace(/^\/+|\/+$/g, '');
  try {
    return new URL(request.url, 'https://sgarra.invalid').pathname.replace(/^\/api\/?|\/+$/g, '');
  } catch {
    return '';
  }
}

export default async function handler(request, response) {
  const selected = handlers.get(routeKey(request));
  if (!selected) {
    return sendJson(response, 404, {
      ok: false,
      error: { code: 'route_not_found', message: 'Risorsa non disponibile.' }
    });
  }
  return selected(request, response);
}
