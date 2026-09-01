import { validateBookingPayload } from '../platform/booking-domain.mjs';
import { getClientIp, publicError, readJsonBody, rejectMethod, sendJson } from './_lib/http.js';
import { supabaseRequest } from './_lib/supabase.js';

export default async function handler(request, response) {
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
    const result = await supabaseRequest('/rest/v1/rpc/create_public_booking', {
      method: 'POST',
      body: {
        p_service_slugs: validation.value.serviceIds,
        p_staff_slug: validation.value.staffSlug,
        p_starts_at: validation.value.startsAt,
        p_customer_name: validation.value.name,
        p_customer_phone: validation.value.phone,
        p_notes: validation.value.notes || null,
        p_privacy_version: validation.value.privacyVersion,
        p_idempotency_key: validation.value.idempotencyKey,
        p_source: 'website',
        p_client_ip_hint: getClientIp(request) ? 'present' : 'absent'
      }
    });
    const booking = Array.isArray(result) ? result[0] : result;
    return sendJson(response, 201, {
      ok: true,
      booking: {
        reference: booking?.reference,
        status: booking?.status || 'pending',
        startsAt: booking?.starts_at || validation.value.startsAt
      }
    });
  } catch (error) {
    const safe = publicError(error);
    return sendJson(response, safe.status, { ok: false, error: { code: safe.code, message: safe.message } });
  }
}
