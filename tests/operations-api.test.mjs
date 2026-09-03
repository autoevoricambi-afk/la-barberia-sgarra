import assert from 'node:assert/strict';
import test from 'node:test';
import publicConfigHandler from '../api/public-config.js';
import waitlistHandler from '../api/waitlist.js';
import inventoryHandler from '../api/admin/inventory.js';
import adminWaitlistHandler from '../api/admin/waitlist.js';
import cronHandler from '../api/cron/process-outbox.js';

function responseRecorder() {
  return {
    headers: {}, statusCode: 200, payload: null,
    setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; }
  };
}

async function withBackend(fetchImplementation, run) {
  const names = [
    'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY',
    'RATE_LIMIT_SALT', 'ADMIN_EMAILS', 'CRON_SECRET'
  ];
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  const previousFetch = global.fetch;
  process.env.SUPABASE_URL = 'https://project.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'anon-test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test';
  process.env.RATE_LIMIT_SALT = '12345678901234567890123456789012';
  process.env.ADMIN_EMAILS = 'paolo@example.com';
  process.env.CRON_SECRET = 'cron-secret-123456789012345678901';
  global.fetch = fetchImplementation;
  try { await run(); }
  finally {
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
    global.fetch = previousFetch;
  }
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } });
}

test('configurazione pubblica usa il catalogo live senza esporre segreti', async () => {
  await withBackend(async (url) => {
    assert.match(String(url), /public_booking_configuration/);
    return jsonResponse({
      configured: true, bookingEnabled: false, bookingHorizonDays: 45,
      services: [{ id: 'taglio-uomo', label: 'Taglio uomo', durationMinutes: 30, priceCents: 2000 }]
    });
  }, async () => {
    const response = responseRecorder();
    await publicConfigHandler({ method: 'GET' }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.payload.configured, true);
    assert.equal(response.payload.bookingEnabled, false);
    assert.equal(JSON.stringify(response.payload).includes('service-role-test'), false);
  });
});

test('lista d’attesa pubblica passa da rate limit, database e coda', async () => {
  const calls = [];
  await withBackend(async (url) => {
    const target = String(url); calls.push(target);
    if (target.includes('consume_public_rate_limit')) return jsonResponse(true);
    if (target.includes('join_public_waitlist')) return jsonResponse([{ reference: 'WL-TEST-1', status: 'waiting' }]);
    if (target.includes('/waitlist_entries?reference=')) return jsonResponse([{ id: 'a3bb189e-8bf9-4db1-9fa4-55cb43fe1458' }]);
    if (target.includes('/integration_outbox?')) return jsonResponse([]);
    return jsonResponse([]);
  }, async () => {
    const response = responseRecorder();
    await waitlistHandler({
      method: 'POST', headers: { 'x-forwarded-for': '127.0.0.1' }, socket: {},
      body: {
        serviceIds: ['taglio-uomo'], staffSlug: 'paolo-sgarra', desiredDate: '2026-09-10',
        timePreference: 'morning', name: 'Mario Rossi', phone: '3290001122',
        email: 'mario@example.com', privacyVersion: '2026-09-03',
        idempotencyKey: 'waitlist_1234567890abcdef', website: ''
      }
    }, response);
    assert.equal(response.statusCode, 201);
    assert.equal(response.payload.waitlist.reference, 'WL-TEST-1');
    assert.ok(calls.some((item) => item.includes('join_public_waitlist')));
  });
});

test('gestionale registra uno scarico di giacenza solo per Paolo autorizzato', async () => {
  const calls = [];
  await withBackend(async (url) => {
    const target = String(url); calls.push(target);
    if (target.includes('/auth/v1/user')) return jsonResponse({ id: 'admin-1', email: 'paolo@example.com' });
    if (target.includes('admin_record_inventory_movement')) {
      return jsonResponse({ id: 'a3bb189e-8bf9-4db1-9fa4-55cb43fe1458', name: 'Cera', stock_quantity: 2 });
    }
    return jsonResponse([]);
  }, async () => {
    const response = responseRecorder();
    await inventoryHandler({
      method: 'POST', headers: { authorization: 'Bearer valid-token' },
      body: {
        action: 'movement', productId: 'a3bb189e-8bf9-4db1-9fa4-55cb43fe1458',
        quantityDelta: -1, reason: 'sale'
      }
    }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.payload.ok, true);
    assert.ok(calls.some((item) => item.includes('admin_record_inventory_movement')));
  });
});

test('gestionale aggiorna la lista d’attesa e conserva la consegna in coda', async () => {
  await withBackend(async (url) => {
    const target = String(url);
    if (target.includes('/auth/v1/user')) return jsonResponse({ id: 'admin-1', email: 'paolo@example.com' });
    if (target.includes('admin_update_waitlist')) return jsonResponse({
      id: 'a3bb189e-8bf9-4db1-9fa4-55cb43fe1458', reference: 'WL-TEST-1', status: 'notified'
    });
    if (target.includes('/waitlist_entries?reference=')) return jsonResponse([{ id: 'a3bb189e-8bf9-4db1-9fa4-55cb43fe1458' }]);
    if (target.includes('/integration_outbox?')) return jsonResponse([]);
    return jsonResponse([]);
  }, async () => {
    const response = responseRecorder();
    await adminWaitlistHandler({
      method: 'PATCH', headers: { authorization: 'Bearer valid-token' },
      body: { waitlistId: 'a3bb189e-8bf9-4db1-9fa4-55cb43fe1458', status: 'notified' }
    }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.payload.entry.status, 'notified');
    assert.equal(response.payload.notificationDeferred, false);
  });
});

test('cron pianifica promemoria e processa una coda vuota con segreto valido', async () => {
  const calls = [];
  await withBackend(async (url) => {
    const target = String(url); calls.push(target);
    if (target.includes('enqueue_due_automations')) return jsonResponse({ dayBefore: 1, sameDay: 1, waitlistExpired: 0 });
    if (target.includes('/integration_outbox?')) return jsonResponse([]);
    return jsonResponse([]);
  }, async () => {
    const response = responseRecorder();
    await cronHandler({
      method: 'GET', headers: { authorization: 'Bearer cron-secret-123456789012345678901' }
    }, response);
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.payload, { ok: true, processed: 0, failed: 0 });
    assert.ok(calls.some((item) => item.includes('enqueue_due_automations')));
  });
});
