import { validateAvailabilityQuery } from '../platform/booking-domain.mjs';
import { publicError, rejectMethod, sendJson } from './_lib/http.js';
import { supabaseRequest } from './_lib/supabase.js';

export default async function handler(request, response) {
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
    const slots = await supabaseRequest('/rest/v1/rpc/public_available_slots', {
      method: 'POST',
      body: {
        p_date: validation.value.date,
        p_staff_slug: validation.value.staffSlug,
        p_service_slugs: validation.value.serviceIds
      }
    });
    return sendJson(response, 200, { ok: true, date: validation.value.date, slots: Array.isArray(slots) ? slots : [] });
  } catch (error) {
    const safe = publicError(error);
    return sendJson(response, safe.status, { ok: false, error: { code: safe.code, message: safe.message } });
  }
}
