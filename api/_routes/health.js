import { sendJson, rejectMethod } from '../_lib/http.js';
import { rateLimitConfigured } from '../_lib/rate-limit.js';
import { getSupabaseConfig } from '../_lib/supabase.js';

export default async function handler(request, response) {
  if (request.method !== 'GET') return rejectMethod(response, ['GET']);
  const config = getSupabaseConfig();
  const backendReady = Boolean(config.url && config.anonKey);
  return sendJson(response, 200, {
    ok: true,
    service: 'sgarra-booking-api',
    bookingConfigured: backendReady,
    adminConfigured: backendReady,
    notificationsConfigured: Boolean(
      (process.env.RESEND_API_KEY && process.env.NOTIFICATION_FROM_EMAIL && process.env.BARBER_NOTIFICATION_EMAIL)
      || process.env.BOOKING_NOTIFICATION_WEBHOOK_URL
    ),
    rateLimitConfigured: rateLimitConfigured(),
    timestamp: new Date().toISOString()
  });
}
