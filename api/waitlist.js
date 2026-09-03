import { validateWaitlistPayload } from '../platform/booking-domain.mjs';
import { readJsonBody, rejectMethod, sendJson } from './_lib/http.js';
import { logError, logInfo, requestContext } from './_lib/logging.js';
import { processPendingOutboxForWaitlistReference } from './_lib/notifications.js';
import { consumeRateLimit } from './_lib/rate-limit.js';
import { supabaseRequest } from './_lib/supabase.js';

export default async function handler(request, response) {
  const context = requestContext(request, '/api/waitlist');
  if (request.method !== 'POST') return rejectMethod(response, ['POST']);
  let body;
  try { body = await readJsonBody(request); }
  catch { return sendJson(response, 400, { ok: false, error: { code: 'invalid_json', message: 'Richiesta non valida.' } }); }

  const validation = validateWaitlistPayload(body);
  if (!validation.ok) {
    return sendJson(response, 400, {
      ok: false,
      error: { code: 'invalid_waitlist', message: 'Controlla i dati inseriti.', fields: validation.errors }
    });
  }

  try {
    if (!await consumeRateLimit(request, 'waitlist-create', 6, 900)) {
      return sendJson(response, 429, { ok: false, error: { code: 'rate_limited', message: 'Troppe richieste. Riprova tra qualche minuto.' } }, { 'Retry-After': '900' });
    }
    const result = await supabaseRequest('/rest/v1/rpc/join_public_waitlist', {
      method: 'POST',
      body: {
        p_service_slugs: validation.value.serviceIds,
        p_staff_slug: validation.value.staffSlug,
        p_desired_date: validation.value.desiredDate,
        p_time_preference: validation.value.timePreference,
        p_customer_name: validation.value.name,
        p_customer_phone: validation.value.phone,
        p_customer_email: validation.value.email || null,
        p_notes: validation.value.notes || null,
        p_privacy_version: validation.value.privacyVersion,
        p_idempotency_key: validation.value.idempotencyKey
      }
    });
    const entry = Array.isArray(result) ? result[0] : result;
    try { await processPendingOutboxForWaitlistReference(entry?.reference); }
    catch (notificationError) { logError(context, 'waitlist_notification_deferred', notificationError); }
    logInfo(context, 'waitlist_created');
    return sendJson(response, 201, {
      ok: true,
      waitlist: { reference: entry?.reference, status: entry?.status || 'waiting' }
    });
  } catch (error) {
    logError(context, 'waitlist_create_failed', error);
    const unavailable = /booking_not_enabled|booking_not_configured|rate_limit_not_configured/i.test(String(error?.message || error));
    return sendJson(response, unavailable ? 503 : 502, {
      ok: false,
      error: { code: unavailable ? 'waitlist_not_available' : 'waitlist_failed', message: unavailable ? 'Lista d’attesa non ancora attiva.' : 'Iscrizione non riuscita.' }
    });
  }
}
