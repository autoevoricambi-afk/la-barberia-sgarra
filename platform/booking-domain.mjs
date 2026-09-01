export const APPOINTMENT_STATUSES = Object.freeze([
  'pending',
  'confirmed',
  'completed',
  'cancelled_by_customer',
  'cancelled_by_shop',
  'no_show'
]);

export const APPOINTMENT_TRANSITIONS = Object.freeze({
  pending: Object.freeze(['confirmed', 'cancelled_by_customer', 'cancelled_by_shop']),
  confirmed: Object.freeze(['completed', 'cancelled_by_customer', 'cancelled_by_shop', 'no_show']),
  completed: Object.freeze([]),
  cancelled_by_customer: Object.freeze([]),
  cancelled_by_shop: Object.freeze([]),
  no_show: Object.freeze([])
});

const BOOKING_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ISO_INSTANT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;

export function normalizeText(value, maxLength = 200) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

export function normalizePhone(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const leadingPlus = raw.startsWith('+');
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (leadingPlus) return `+${digits}`;
  if (digits.startsWith('00')) return `+${digits.slice(2)}`;
  if (digits.startsWith('39')) return `+${digits}`;
  return `+39${digits}`;
}

export function isValidPhone(value) {
  return /^\+[1-9]\d{7,14}$/.test(normalizePhone(value));
}

export function isValidBookingId(value) {
  const clean = normalizeText(value, 80);
  return BOOKING_ID_PATTERN.test(clean);
}

export function isValidInstant(value) {
  const clean = normalizeText(value, 40);
  if (!ISO_INSTANT_PATTERN.test(clean)) return false;
  return Number.isFinite(Date.parse(clean));
}

export function canTransition(from, to) {
  return Boolean(APPOINTMENT_TRANSITIONS[from]?.includes(to));
}

export function validateBookingPayload(input) {
  const source = input && typeof input === 'object' ? input : {};
  const serviceIds = Array.isArray(source.serviceIds)
    ? [...new Set(source.serviceIds.map((id) => normalizeText(id, 80)).filter(Boolean))]
    : [];

  const value = {
    serviceIds,
    staffSlug: normalizeText(source.staffSlug || 'paolo-sgarra', 80),
    startsAt: normalizeText(source.startsAt, 40),
    name: normalizeText(source.name, 80),
    phone: normalizePhone(source.phone),
    notes: normalizeText(source.notes, 500),
    privacyVersion: normalizeText(source.privacyVersion, 30),
    idempotencyKey: normalizeText(source.idempotencyKey, 80),
    website: normalizeText(source.website, 200)
  };

  const errors = {};
  if (!value.serviceIds.length || value.serviceIds.length > 4 || value.serviceIds.some((id) => !isValidBookingId(id))) {
    errors.serviceIds = 'Seleziona da uno a quattro servizi validi.';
  }
  if (!isValidBookingId(value.staffSlug)) errors.staffSlug = 'Operatore non valido.';
  if (!isValidInstant(value.startsAt)) errors.startsAt = 'Orario non valido.';
  if (value.name.length < 2) errors.name = 'Inserisci un nome valido.';
  if (!isValidPhone(value.phone)) errors.phone = 'Inserisci un numero di telefono valido.';
  if (!value.privacyVersion) errors.privacyVersion = 'Versione privacy mancante.';
  if (!/^[a-zA-Z0-9_-]{16,80}$/.test(value.idempotencyKey)) errors.idempotencyKey = 'Identificativo richiesta non valido.';
  if (value.website) errors.website = 'Richiesta non valida.';

  return { ok: Object.keys(errors).length === 0, value, errors };
}

export function validateAvailabilityQuery(input) {
  const source = input && typeof input === 'object' ? input : {};
  const date = normalizeText(source.date, 10);
  const staffSlug = normalizeText(source.staffSlug || 'paolo-sgarra', 80);
  const serviceIds = Array.isArray(source.serviceIds)
    ? [...new Set(source.serviceIds.map((id) => normalizeText(id, 80)).filter(Boolean))]
    : normalizeText(source.serviceIds, 340).split(',').map((id) => normalizeText(id, 80)).filter(Boolean);
  const errors = {};

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(`${date}T12:00:00Z`))) {
    errors.date = 'Data non valida.';
  }
  if (!isValidBookingId(staffSlug)) errors.staffSlug = 'Operatore non valido.';
  if (!serviceIds.length || serviceIds.length > 4 || serviceIds.some((id) => !isValidBookingId(id))) {
    errors.serviceIds = 'Servizi non validi.';
  }

  return {
    ok: Object.keys(errors).length === 0,
    value: { date, staffSlug, serviceIds },
    errors
  };
}
