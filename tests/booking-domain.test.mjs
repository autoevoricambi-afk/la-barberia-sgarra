import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canTransition,
  isValidPhone,
  normalizePhone,
  validateAvailabilityQuery,
  validateBookingPayload
} from '../platform/booking-domain.mjs';

test('normalizza i numeri italiani senza alterare un prefisso internazionale', () => {
  assert.equal(normalizePhone('329 641 0828'), '+393296410828');
  assert.equal(normalizePhone('0039 329 641 0828'), '+393296410828');
  assert.equal(normalizePhone('+44 7700 900123'), '+447700900123');
  assert.equal(isValidPhone('+393296410828'), true);
});

test('rifiuta payload incompleti e honeypot compilato', () => {
  const result = validateBookingPayload({ website: 'spam.example' });
  assert.equal(result.ok, false);
  assert.deepEqual(Object.keys(result.errors).sort(), [
    'idempotencyKey',
    'name',
    'phone',
    'privacyVersion',
    'serviceIds',
    'startsAt',
    'website'
  ]);
});

test('accetta un payload booking completo e rimuove servizi duplicati', () => {
  const result = validateBookingPayload({
    serviceIds: ['taglio-uomo', 'taglio-uomo'],
    staffSlug: 'paolo-sgarra',
    startsAt: '2026-09-04T08:30:00+02:00',
    name: ' Mario  Rossi ',
    phone: '329 000 1122',
    notes: '  preferenza   sfumatura bassa ',
    privacyVersion: '2026-09-01',
    idempotencyKey: 'booking_1234567890abcdef',
    website: ''
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.value.serviceIds, ['taglio-uomo']);
  assert.equal(result.value.name, 'Mario Rossi');
  assert.equal(result.value.phone, '+393290001122');
});

test('valida la richiesta disponibilità', () => {
  const result = validateAvailabilityQuery({
    date: '2026-09-05',
    staffSlug: 'paolo-sgarra',
    serviceIds: 'taglio-uomo,barba'
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.value.serviceIds, ['taglio-uomo', 'barba']);
});

test('consente solo transizioni di stato esplicite', () => {
  assert.equal(canTransition('pending', 'confirmed'), true);
  assert.equal(canTransition('confirmed', 'completed'), true);
  assert.equal(canTransition('completed', 'confirmed'), false);
  assert.equal(canTransition('pending', 'completed'), false);
});
