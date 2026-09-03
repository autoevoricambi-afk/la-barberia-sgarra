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
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ADMIN_SOURCES = new Set(['admin', 'phone', 'whatsapp', 'walk_in']);
const BLOCK_KINDS = new Set(['manual', 'closure', 'break']);
const INVENTORY_REASONS = new Set(['sale', 'use', 'restock', 'correction', 'waste']);
const WAITLIST_STATUSES = new Set(['waiting', 'notified', 'booked', 'cancelled', 'expired']);

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

export function isValidUuid(value) {
  return UUID_PATTERN.test(normalizeText(value, 40));
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
    email: normalizeText(source.email, 160).toLowerCase(),
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
  if (value.email && !/^\S+@\S+\.\S+$/.test(value.email)) errors.email = 'Inserisci un indirizzo email valido.';
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

export function validateAdminBookingPayload(input) {
  const source = input && typeof input === 'object' ? input : {};
  const base = validateBookingPayload({
    ...source,
    privacyVersion: source.privacyVersion || 'admin-recorded-v1',
    idempotencyKey: source.idempotencyKey || 'admin_missing_key_0000',
    website: ''
  });
  const value = {
    ...base.value,
    source: normalizeText(source.source || 'admin', 20)
  };
  const errors = { ...base.errors };
  delete errors.website;
  if (!ADMIN_SOURCES.has(value.source)) errors.source = 'Origine appuntamento non valida.';
  return { ok: Object.keys(errors).length === 0, value, errors };
}

export function validateReschedulePayload(input) {
  const source = input && typeof input === 'object' ? input : {};
  const value = {
    appointmentId: normalizeText(source.appointmentId, 40),
    startsAt: normalizeText(source.startsAt, 40),
    reason: normalizeText(source.reason, 300)
  };
  const errors = {};
  if (!isValidUuid(value.appointmentId)) errors.appointmentId = 'Appuntamento non valido.';
  if (!isValidInstant(value.startsAt)) errors.startsAt = 'Nuovo orario non valido.';
  return { ok: Object.keys(errors).length === 0, value, errors };
}

export function validateBlockPayload(input) {
  const source = input && typeof input === 'object' ? input : {};
  const value = {
    blockId: normalizeText(source.blockId, 40),
    staffSlug: normalizeText(source.staffSlug || 'paolo-sgarra', 80),
    startsAt: normalizeText(source.startsAt, 40),
    endsAt: normalizeText(source.endsAt, 40),
    kind: normalizeText(source.kind || 'manual', 20),
    reason: normalizeText(source.reason, 200)
  };
  const errors = {};
  if (value.blockId && !isValidUuid(value.blockId)) errors.blockId = 'Blocco non valido.';
  if (!isValidBookingId(value.staffSlug)) errors.staffSlug = 'Operatore non valido.';
  if (!isValidInstant(value.startsAt)) errors.startsAt = 'Inizio non valido.';
  if (!isValidInstant(value.endsAt) || Date.parse(value.endsAt) <= Date.parse(value.startsAt)) {
    errors.endsAt = 'La fine deve essere successiva all’inizio.';
  }
  if (!BLOCK_KINDS.has(value.kind)) errors.kind = 'Tipo di blocco non valido.';
  return { ok: Object.keys(errors).length === 0, value, errors };
}

export function validateBookingSettingsPayload(input) {
  const source = input && typeof input === 'object' ? input : {};
  const services = Array.isArray(source.services) ? source.services.map((item) => ({
    slug: normalizeText(item?.slug, 80),
    name: normalizeText(item?.name, 100),
    description: normalizeText(item?.description, 240),
    durationMinutes: Number(item?.durationMinutes),
    bufferBeforeMinutes: Number(item?.bufferBeforeMinutes || 0),
    bufferAfterMinutes: Number(item?.bufferAfterMinutes || 0),
    priceCents: item?.priceCents === null || item?.priceCents === '' ? null : Number(item?.priceCents),
    active: item?.active === true,
    sortOrder: Number(item?.sortOrder || 0)
  })) : [];
  const hours = Array.isArray(source.hours) ? source.hours.map((item) => ({
    weekday: Number(item?.weekday),
    opensAt: normalizeText(item?.opensAt, 5),
    closesAt: normalizeText(item?.closesAt, 5),
    active: item?.active !== false
  })) : [];
  const location = {
    minNoticeMinutes: Number(source.location?.minNoticeMinutes ?? 120),
    bookingHorizonDays: Number(source.location?.bookingHorizonDays ?? 45),
    slotIntervalMinutes: Number(source.location?.slotIntervalMinutes ?? 15),
    publicBookingEnabled: source.location?.publicBookingEnabled === true,
    reviewUrl: normalizeText(source.location?.reviewUrl, 500),
    cancellationStrikeLimit: Number(source.location?.cancellationStrikeLimit ?? 3),
    depositAmountCents: Number(source.location?.depositAmountCents ?? 0),
    depositPaymentUrl: normalizeText(source.location?.depositPaymentUrl, 500)
  };
  const errors = {};
  if (!services.length || services.length > 40) errors.services = 'Inserisci da uno a quaranta servizi.';
  if (services.some((item) => !isValidBookingId(item.slug) || item.name.length < 2)) errors.services = 'Nome o identificativo servizio non valido.';
  if (new Set(services.map((item) => item.slug)).size !== services.length) errors.services = 'Gli identificativi dei servizi devono essere univoci.';
  if (services.some((item) => !Number.isInteger(item.durationMinutes) || item.durationMinutes < 5 || item.durationMinutes > 480)) errors.services = 'Durata servizio non valida.';
  if (services.some((item) => !Number.isInteger(item.bufferBeforeMinutes) || item.bufferBeforeMinutes < 0 || item.bufferBeforeMinutes > 120 || !Number.isInteger(item.bufferAfterMinutes) || item.bufferAfterMinutes < 0 || item.bufferAfterMinutes > 120)) errors.services = 'Buffer servizio non valido.';
  if (services.some((item) => item.priceCents !== null && (!Number.isInteger(item.priceCents) || item.priceCents < 0 || item.priceCents > 100000))) errors.services = 'Prezzo servizio non valido.';
  if (hours.length > 28 || hours.some((item) => !Number.isInteger(item.weekday) || item.weekday < 0 || item.weekday > 6 || !TIME_PATTERN.test(item.opensAt) || !TIME_PATTERN.test(item.closesAt) || item.closesAt <= item.opensAt)) errors.hours = 'Fascia oraria non valida.';
  if (!Number.isInteger(location.minNoticeMinutes) || location.minNoticeMinutes < 0 || location.minNoticeMinutes > 10080) errors.location = 'Anticipo minimo non valido.';
  if (!Number.isInteger(location.bookingHorizonDays) || location.bookingHorizonDays < 1 || location.bookingHorizonDays > 365) errors.location = 'Orizzonte prenotazioni non valido.';
  if (![5, 10, 15, 20, 30, 60].includes(location.slotIntervalMinutes)) errors.location = 'Intervallo slot non valido.';
  if (location.reviewUrl && !/^https:\/\//i.test(location.reviewUrl)) errors.location = 'Link recensioni non valido.';
  if (!Number.isInteger(location.cancellationStrikeLimit) || location.cancellationStrikeLimit < 1 || location.cancellationStrikeLimit > 10) errors.location = 'Soglia cancellazioni non valida.';
  if (!Number.isInteger(location.depositAmountCents) || location.depositAmountCents < 0 || location.depositAmountCents > 100000) errors.location = 'Importo caparra non valido.';
  if (location.depositPaymentUrl && !/^https:\/\//i.test(location.depositPaymentUrl)) errors.location = 'Link caparra non valido.';
  return { ok: Object.keys(errors).length === 0, value: { services, hours, location }, errors };
}

export function validateWaitlistPayload(input) {
  const source = input && typeof input === 'object' ? input : {};
  const serviceIds = Array.isArray(source.serviceIds)
    ? [...new Set(source.serviceIds.map((id) => normalizeText(id, 80)).filter(Boolean))]
    : [];
  const value = {
    serviceIds,
    staffSlug: normalizeText(source.staffSlug || 'paolo-sgarra', 80),
    desiredDate: normalizeText(source.desiredDate, 10),
    timePreference: normalizeText(source.timePreference || 'any', 20),
    name: normalizeText(source.name, 80),
    phone: normalizePhone(source.phone),
    email: normalizeText(source.email, 160).toLowerCase(),
    notes: normalizeText(source.notes, 300),
    privacyVersion: normalizeText(source.privacyVersion, 30),
    idempotencyKey: normalizeText(source.idempotencyKey, 80),
    website: normalizeText(source.website, 200)
  };
  const errors = {};
  if (!value.serviceIds.length || value.serviceIds.length > 4 || value.serviceIds.some((id) => !isValidBookingId(id))) errors.serviceIds = 'Servizi non validi.';
  if (!isValidBookingId(value.staffSlug)) errors.staffSlug = 'Operatore non valido.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.desiredDate) || !Number.isFinite(Date.parse(`${value.desiredDate}T12:00:00Z`))) errors.desiredDate = 'Data non valida.';
  if (!['morning', 'afternoon', 'any'].includes(value.timePreference)) errors.timePreference = 'Preferenza oraria non valida.';
  if (value.name.length < 2) errors.name = 'Inserisci un nome valido.';
  if (!isValidPhone(value.phone)) errors.phone = 'Inserisci un numero di telefono valido.';
  if (value.email && !/^\S+@\S+\.\S+$/.test(value.email)) errors.email = 'Inserisci un indirizzo email valido.';
  if (!value.privacyVersion) errors.privacyVersion = 'Versione privacy mancante.';
  if (!/^[a-zA-Z0-9_-]{16,80}$/.test(value.idempotencyKey)) errors.idempotencyKey = 'Identificativo richiesta non valido.';
  if (value.website) errors.website = 'Richiesta non valida.';
  return { ok: Object.keys(errors).length === 0, value, errors };
}

export function validateInventoryProductPayload(input) {
  const source = input && typeof input === 'object' ? input : {};
  const value = {
    productId: normalizeText(source.productId, 40),
    sku: normalizeText(source.sku, 80),
    name: normalizeText(source.name, 120),
    unit: normalizeText(source.unit || 'pz', 20),
    lowStockThreshold: Number(source.lowStockThreshold ?? 2),
    active: source.active !== false
  };
  const errors = {};
  if (value.productId && !isValidUuid(value.productId)) errors.productId = 'Prodotto non valido.';
  if (value.name.length < 2) errors.name = 'Nome prodotto non valido.';
  if (!/^[a-zA-Z0-9à-öø-ÿ._ -]{1,20}$/i.test(value.unit)) errors.unit = 'Unità non valida.';
  if (!Number.isFinite(value.lowStockThreshold) || value.lowStockThreshold < 0 || value.lowStockThreshold > 100000) errors.lowStockThreshold = 'Soglia giacenza non valida.';
  return { ok: Object.keys(errors).length === 0, value, errors };
}

export function validateInventoryMovementPayload(input) {
  const source = input && typeof input === 'object' ? input : {};
  const value = {
    productId: normalizeText(source.productId, 40),
    quantityDelta: Number(source.quantityDelta),
    reason: normalizeText(source.reason, 30),
    note: normalizeText(source.note, 200)
  };
  const errors = {};
  if (!isValidUuid(value.productId)) errors.productId = 'Prodotto non valido.';
  if (!Number.isFinite(value.quantityDelta) || value.quantityDelta === 0 || Math.abs(value.quantityDelta) > 100000) errors.quantityDelta = 'Quantità non valida.';
  if (!INVENTORY_REASONS.has(value.reason)) errors.reason = 'Causale non valida.';
  return { ok: Object.keys(errors).length === 0, value, errors };
}

export function validateWaitlistAdminPayload(input) {
  const source = input && typeof input === 'object' ? input : {};
  const value = {
    waitlistId: normalizeText(source.waitlistId, 40),
    status: normalizeText(source.status, 30),
    note: normalizeText(source.note, 200)
  };
  const errors = {};
  if (!isValidUuid(value.waitlistId)) errors.waitlistId = 'Richiesta non valida.';
  if (!WAITLIST_STATUSES.has(value.status)) errors.status = 'Stato non valido.';
  return { ok: Object.keys(errors).length === 0, value, errors };
}
