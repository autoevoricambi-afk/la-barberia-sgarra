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
  assert.deepEqual(Object.keys(response.payload).sort(), ['bookingConfigured', 'ok', 'service', 'timestamp']);
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
