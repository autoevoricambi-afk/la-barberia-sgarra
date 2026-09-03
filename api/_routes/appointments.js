import { validateBookingPayload } from '../../platform/booking-domain.mjs';
import { getClientIp, publicError, readJsonBody, rejectMethod, sendJson } from '../_lib/http.js';
import { logError, logInfo, requestContext } from '../_lib/logging.js';
import { processPendingOutboxForReference } from '../_lib/notifications.js';
import { consumeRateLimit } from '../_lib/rate-limit.js';
import { supabaseRequest } from '../_lib/supabase.js';

export default async function handler(request, response) {
  const context = requestContext(request, '/api/appointments');
  if (request.method !== 'POST') return rejectMethod(response, ['POST']);

  let body;
  try {
    body = await readJsonBody(request);
  } catch {
    return sendJson(response, 400, { ok: false, error: { code: 'invalid_json', message: 'Richiesta non valida.' } });
  }

  const validation = validateBookingPayload(body);
  if (!validation.ok) {
    return sendJson(response, 400, {
      ok: false,
      error: { code: 'invalid_booking', message: 'Controlla i dati inseriti.', fields: validation.errors }
    });
  }

  try {
    if (!await consumeRateLimit(request, 'booking-create', 8, 900)) {
      logInfo(context, 'rate_limited');
      return sendJson(response, 429, { ok: false, error: { code: 'rate_limited', message: 'Troppe richieste. Riprova tra qualche minuto.' } }, { 'Retry-After': '900' });
    }
    const result = await supabaseRequest('/rest/v1/rpc/create_public_booking_v2', {
      method: 'POST',
      body: {
        p_service_slugs: validation.value.serviceIds,
        p_staff_slug: validation.value.staffSlug,
        p_starts_at: validation.value.startsAt,
        p_customer_name: validation.value.name,
        p_customer_phone: validation.value.phone,
        p_customer_email: validation.value.email || null,
        p_notes: validation.value.notes || null,
        p_privacy_version: validation.value.privacyVersion,
        p_idempotency_key: validation.value.idempotencyKey,
        p_source: 'website',
        p_client_ip_hint: getClientIp(request) ? 'present' : 'absent'
      }
    });
    const booking = Array.isArray(result) ? result[0] : result;
    let deposit = null;
    try {
      const rows = await supabaseRequest(`/rest/v1/appointments?reference=eq.${encodeURIComponent(booking?.reference || '')}&select=deposit_required,deposit_amount_cents,deposit_status&limit=1`);
      deposit = Array.isArray(rows) ? rows[0] : rows;
    } catch { deposit = null; }
    try {
      await processPendingOutboxForReference(booking?.reference);
    } catch (notificationError) {
      logError(context, 'booking_notification_deferred', notificationError);
    }
    logInfo(context, 'booking_created', { status: booking?.status || 'pending' });
    return sendJson(response, 201, {
      ok: true,
      booking: {
        reference: booking?.reference,
        status: booking?.status || 'pending',
        startsAt: booking?.starts_at || validation.value.startsAt,
        depositRequired: deposit?.deposit_required === true,
        depositAmountCents: Number(deposit?.deposit_amount_cents || 0),
        depositStatus: deposit?.deposit_status || 'not_required'
      }
    });
  } catch (error) {
    logError(context, 'booking_create_failed', error);
    const safe = publicError(error);
    return sendJson(response, safe.status, { ok: false, error: { code: safe.code, message: safe.message } });
  }
}
