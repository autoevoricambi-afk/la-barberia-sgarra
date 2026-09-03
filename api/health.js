import { sendJson, rejectMethod } from './_lib/http.js';
import { getSupabaseConfig } from './_lib/supabase.js';

export default async function handler(request, response) {
  if (request.method !== 'GET') return rejectMethod(response, ['GET']);
  const config = getSupabaseConfig();
  return sendJson(response, 200, {
    ok: true,
    service: 'sgarra-booking-api',
    bookingConfigured: config.ready,
    adminConfigured: Boolean(config.url && config.anonKey && process.env.ADMIN_EMAILS),
    notificationsConfigured: Boolean(
      (process.env.RESEND_API_KEY && process.env.NOTIFICATION_FROM_EMAIL && process.env.BARBER_NOTIFICATION_EMAIL)
      || process.env.BOOKING_NOTIFICATION_WEBHOOK_URL
    ),
    rateLimitConfigured: Boolean(process.env.RATE_LIMIT_SALT),
    timestamp: new Date().toISOString()
  });
}
