import { sendJson, rejectMethod } from './_lib/http.js';
import { getSupabaseConfig } from './_lib/supabase.js';

export default async function handler(request, response) {
  if (request.method !== 'GET') return rejectMethod(response, ['GET']);
  const config = getSupabaseConfig();
  return sendJson(response, 200, {
    ok: true,
    service: 'sgarra-booking-api',
    bookingConfigured: config.ready,
    timestamp: new Date().toISOString()
  });
}
