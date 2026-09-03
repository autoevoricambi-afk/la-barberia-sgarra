import assert from 'node:assert/strict';
import test from 'node:test';
import appointmentsHandler from '../api/appointments.js';
import availabilityHandler from '../api/availability.js';
import healthHandler from '../api/health.js';

function responseRecorder() {
  return {
    headers: {},
    statusCode: 200,
    payload: null,
    setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; }
  };
}

test('health non espone segreti e dichiara backend non configurato', async () => {
  const response = responseRecorder();
  await healthHandler({ method: 'GET' }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.payload.ok, true);
  assert.equal(response.payload.bookingConfigured, false);
  assert.deepEqual(Object.keys(response.payload).sort(), [
    'adminConfigured', 'bookingConfigured', 'notificationsConfigured',
    'ok', 'rateLimitConfigured', 'service', 'timestamp'
  ]);
  assert.equal(response.payload.adminConfigured, false);
  assert.equal(response.payload.notificationsConfigured, false);
  assert.equal(response.payload.rateLimitConfigured, false);
});

test('availability rifiuta query non valida prima di contattare il database', async () => {
  const response = responseRecorder();
  await availabilityHandler({ method: 'GET', query: { date: 'domani' } }, response);
  assert.equal(response.statusCode, 400);
  assert.equal(response.payload.error.code, 'invalid_availability_query');
});

test('availability valida risponde 503 finché il database non è collegato', async () => {
  const response = responseRecorder();
  await availabilityHandler({
    method: 'GET',
    query: { date: '2026-09-05', staffSlug: 'paolo-sgarra', serviceIds: 'taglio-uomo' }
  }, response);
  assert.equal(response.statusCode, 503);
  assert.equal(response.payload.error.code, 'booking_not_configured');
});

test('appointments rifiuta payload incompleto senza salvare dati', async () => {
  const response = responseRecorder();
  await appointmentsHandler({ method: 'POST', body: {}, headers: {}, socket: {} }, response);
  assert.equal(response.statusCode, 400);
  assert.equal(response.payload.error.code, 'invalid_booking');
});

test('endpoint espongono Allow sui metodi errati', async () => {
  const response = responseRecorder();
  await appointmentsHandler({ method: 'GET' }, response);
  assert.equal(response.statusCode, 405);
  assert.equal(response.headers.Allow, 'POST');
});

test('availability configurata attraversa rate limit e database', async () => {
  const previous = {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_SERVICE_ROLE_KEY,
    salt: process.env.RATE_LIMIT_SALT,
    fetch: global.fetch
  };
  process.env.SUPABASE_URL = 'https://project.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test';
  process.env.RATE_LIMIT_SALT = '12345678901234567890123456789012';
  const calls = [];
  global.fetch = async (url) => {
    calls.push(String(url));
    const target = String(url);
    const payload = target.includes('public_booking_configuration')
      ? { configured: true, bookingEnabled: true, services: [{ id: 'taglio-uomo' }] }
      : target.includes('consume_public_rate_limit')
        ? true
        : [{ starts_at: '2026-09-05T08:00:00Z', ends_at: '2026-09-05T08:30:00Z', label: '10:00' }];
    return new Response(JSON.stringify(payload), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });
  };
  try {
    const response = responseRecorder();
    await availabilityHandler({
      method: 'GET',
      query: { date: '2026-09-05', staffSlug: 'paolo-sgarra', serviceIds: 'taglio-uomo' },
      headers: { 'x-forwarded-for': '127.0.0.1' }, socket: {}
    }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.payload.slots.length, 1);
    assert.equal(calls.length, 3);
  } finally {
    if (previous.url === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = previous.url;
    if (previous.key === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = previous.key;
    if (previous.salt === undefined) delete process.env.RATE_LIMIT_SALT; else process.env.RATE_LIMIT_SALT = previous.salt;
    global.fetch = previous.fetch;
  }
});

test('booking configurato salva e restituisce un riferimento senza esporre dati', async () => {
  const previous = {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_SERVICE_ROLE_KEY,
    salt: process.env.RATE_LIMIT_SALT,
    fetch: global.fetch
  };
  process.env.SUPABASE_URL = 'https://project.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test';
  process.env.RATE_LIMIT_SALT = '12345678901234567890123456789012';
  global.fetch = async (url) => {
    const target = String(url);
    let payload = [];
    if (target.includes('consume_public_rate_limit')) payload = true;
    else if (target.includes('create_public_booking')) payload = [{ reference: 'SG-TEST-1', status: 'pending', starts_at: '2026-09-05T08:00:00Z' }];
    else if (target.includes('/appointments?reference=')) payload = [{ id: 'a3bb189e-8bf9-4db1-9fa4-55cb43fe1458' }];
    return new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  try {
    const response = responseRecorder();
    await appointmentsHandler({
      method: 'POST',
      body: {
        serviceIds: ['taglio-uomo'], staffSlug: 'paolo-sgarra',
        startsAt: '2026-09-05T10:00:00+02:00', name: 'Mario Rossi',
        phone: '3290001122', notes: '', privacyVersion: '2026-09-01',
        idempotencyKey: 'booking_1234567890abcdef', website: ''
      },
      headers: { 'x-forwarded-for': '127.0.0.1' }, socket: {}
    }, response);
    assert.equal(response.statusCode, 201);
    assert.deepEqual(response.payload.booking, {
      reference: 'SG-TEST-1', status: 'pending', startsAt: '2026-09-05T08:00:00Z',
      depositRequired: false, depositAmountCents: 0, depositStatus: 'not_required'
    });
    assert.equal(JSON.stringify(response.payload).includes('Mario'), false);
    assert.equal(JSON.stringify(response.payload).includes('329'), false);
  } finally {
    if (previous.url === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = previous.url;
    if (previous.key === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = previous.key;
    if (previous.salt === undefined) delete process.env.RATE_LIMIT_SALT; else process.env.RATE_LIMIT_SALT = previous.salt;
    global.fetch = previous.fetch;
  }
});
