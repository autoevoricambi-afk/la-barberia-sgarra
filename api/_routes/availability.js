import { validateAvailabilityQuery } from '../../platform/booking-domain.mjs';
import { publicError, rejectMethod, sendJson } from '../_lib/http.js';
import { logError, logInfo, requestContext } from '../_lib/logging.js';
import { consumeRateLimit } from '../_lib/rate-limit.js';
import { ensurePublicBookingEnabled, supabaseRequest } from '../_lib/supabase.js';

export default async function handler(request, response) {
  const context = requestContext(request, '/api/availability');
  if (request.method !== 'GET') return rejectMethod(response, ['GET']);

  const validation = validateAvailabilityQuery({
    date: request.query?.date,
    staffSlug: request.query?.staffSlug,
    serviceIds: request.query?.serviceIds
  });
  if (!validation.ok) {
    return sendJson(response, 400, {
      ok: false,
      error: { code: 'invalid_availability_query', message: 'Controlla data e servizi.', fields: validation.errors }
    });
  }

  try {
    await ensurePublicBookingEnabled();
    if (!await consumeRateLimit(request, 'availability', 120, 900)) {
      logInfo(context, 'rate_limited');
      return sendJson(response, 429, { ok: false, error: { code: 'rate_limited', message: 'Troppe richieste. Riprova tra qualche minuto.' } }, { 'Retry-After': '900' });
    }
    const slots = await supabaseRequest('/rest/v1/rpc/public_available_slots', {
      method: 'POST',
      body: {
        p_date: validation.value.date,
        p_staff_slug: validation.value.staffSlug,
        p_service_slugs: validation.value.serviceIds
      }
    });
    logInfo(context, 'availability_loaded', { slots: Array.isArray(slots) ? slots.length : 0 });
    return sendJson(response, 200, { ok: true, date: validation.value.date, slots: Array.isArray(slots) ? slots : [] });
  } catch (error) {
    logError(context, 'availability_failed', error);
    const safe = publicError(error);
    return sendJson(response, safe.status, { ok: false, error: { code: safe.code, message: safe.message } });
  }
}
