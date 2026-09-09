import { authenticateAdmin } from '../../_lib/admin.js';
import { rejectMethod, sendJson } from '../../_lib/http.js';
import { logError, requestContext } from '../../_lib/logging.js';
import { supabaseRequest } from '../../_lib/supabase.js';

function notificationsConfigured() {
  const emailReady = Boolean(
    process.env.RESEND_API_KEY
    && process.env.NOTIFICATION_FROM_EMAIL
    && process.env.BARBER_NOTIFICATION_EMAIL
  );
  const webhookReady = Boolean(process.env.BOOKING_NOTIFICATION_WEBHOOK_URL);
  return emailReady || webhookReady;
}

export default async function handler(request, response) {
  const context = requestContext(request, '/api/admin/notifications');
  if (request.method !== 'GET') return rejectMethod(response, ['GET']);

  let admin;
  try { admin = await authenticateAdmin(request); }
  catch {
    return sendJson(response, 503, {
      ok: false,
      error: { code: 'auth_unavailable', message: 'Accesso temporaneamente non disponibile.' }
    });
  }
  if (!admin) {
    return sendJson(response, 401, {
      ok: false,
      error: { code: 'unauthorized', message: 'Accesso scaduto o non autorizzato.' }
    });
  }

  try {
    const params = new URLSearchParams({
      select: 'id,appointment_id,event_type,payload,attempts,available_at,processed_at,last_error,created_at',
      order: 'created_at.desc',
      limit: '80'
    });
    const rows = await supabaseRequest(`/rest/v1/integration_outbox?${params.toString()}`);
    const notifications = Array.isArray(rows) ? rows : [];
    return sendJson(response, 200, {
      ok: true,
      connected: notificationsConfigured(),
      pending: notifications.filter((item) => !item.processed_at).length,
      notifications
    });
  } catch (error) {
    logError(context, 'admin_notifications_failed', error);
    return sendJson(response, 502, {
      ok: false,
      error: { code: 'notifications_unavailable', message: 'Centro notifiche temporaneamente non disponibile.' }
    });
  }
}
