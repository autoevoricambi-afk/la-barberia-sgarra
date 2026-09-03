import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canTransition,
  isValidPhone,
  normalizePhone,
  validateAdminBookingPayload,
  validateAvailabilityQuery,
  validateBlockPayload,
  validateBookingPayload,
  validateBookingSettingsPayload,
  validateReschedulePayload
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

test('valida creazione manuale, spostamento e blocco agenda', () => {
  const manual = validateAdminBookingPayload({
    serviceIds: ['taglio-uomo'], startsAt: '2026-09-10T10:00:00+02:00',
    name: 'Mario Rossi', phone: '3290001122', source: 'phone',
    idempotencyKey: 'admin_1234567890abcdef'
  });
  assert.equal(manual.ok, true);
  const reschedule = validateReschedulePayload({
    appointmentId: 'a3bb189e-8bf9-4db1-9fa4-55cb43fe1458',
    startsAt: '2026-09-10T11:00:00+02:00'
  });
  assert.equal(reschedule.ok, true);
  const block = validateBlockPayload({
    startsAt: '2026-09-10T13:00:00+02:00',
    endsAt: '2026-09-10T15:00:00+02:00',
    kind: 'break'
  });
  assert.equal(block.ok, true);
});

test('rifiuta blocchi inversi e configurazioni ambigue', () => {
  assert.equal(validateBlockPayload({
    startsAt: '2026-09-10T15:00:00+02:00',
    endsAt: '2026-09-10T13:00:00+02:00'
  }).ok, false);
  const settings = validateBookingSettingsPayload({
    services: [
      { slug: 'taglio-uomo', name: 'Taglio uomo', durationMinutes: 30, priceCents: 2000, active: true },
      { slug: 'taglio-uomo', name: 'Duplicato', durationMinutes: 20, priceCents: 1000, active: true }
    ],
    hours: [{ weekday: 1, opensAt: '15:00', closesAt: '13:00' }],
    location: { minNoticeMinutes: 120, bookingHorizonDays: 45, slotIntervalMinutes: 15 }
  });
  assert.equal(settings.ok, false);
  assert.ok(settings.errors.services);
  assert.ok(settings.errors.hours);
});
