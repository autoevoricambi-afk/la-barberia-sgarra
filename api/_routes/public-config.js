import { rejectMethod, sendJson } from '../_lib/http.js';
import { logError, logInfo, requestContext } from '../_lib/logging.js';
import { supabaseRequest } from '../_lib/supabase.js';

export default async function handler(request, response) {
  const context = requestContext(request, '/api/public-config');
  if (request.method !== 'GET') return rejectMethod(response, ['GET']);
  try {
    const data = await supabaseRequest('/rest/v1/rpc/public_booking_configuration', { method: 'POST', body: {} });
    logInfo(context, 'public_configuration_loaded', {
      bookingEnabled: data?.bookingEnabled === true,
      services: Array.isArray(data?.services) ? data.services.length : 0
    });
    return sendJson(response, 200, { ok: true, ...(data || {}) }, {
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=300'
    });
  } catch (error) {
    logError(context, 'public_configuration_unavailable', error);
    return sendJson(response, 200, {
      ok: true,
      configured: false,
      bookingEnabled: false,
      services: []
    }, { 'Cache-Control': 'public, max-age=30' });
  }
}
