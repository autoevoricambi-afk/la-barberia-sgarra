import { validateWaitlistAdminPayload } from '../../../platform/booking-domain.mjs';
import { authenticateAdmin } from '../../_lib/admin.js';
import { readJsonBody, rejectMethod, sendJson } from '../../_lib/http.js';
import { logError, logInfo, requestContext } from '../../_lib/logging.js';
import { processPendingOutboxForWaitlistReference } from '../../_lib/notifications.js';
import { supabaseRequest } from '../../_lib/supabase.js';

export default async function handler(request, response) {
  const context = requestContext(request, '/api/admin/waitlist');
  if (!['GET', 'PATCH'].includes(request.method)) return rejectMethod(response, ['GET', 'PATCH']);
  let admin;
  try { admin = await authenticateAdmin(request); }
  catch { return sendJson(response, 503, { ok: false, error: { code: 'auth_unavailable', message: 'Accesso temporaneamente non disponibile.' } }); }
  if (!admin) return sendJson(response, 401, { ok: false, error: { code: 'unauthorized', message: 'Accesso scaduto o non autorizzato.' } });

  if (request.method === 'GET') {
    const status = ['waiting', 'notified', 'booked', 'cancelled', 'expired'].includes(request.query?.status) ? request.query.status : '';
    const params = new URLSearchParams({
      select: 'id,reference,service_slugs,desired_date,time_preference,notes,status,notified_at,created_at,customers(name,phone_normalized,email)',
      order: 'desired_date.asc,created_at.asc',
      limit: '100'
    });
    if (status) params.set('status', `eq.${status}`);
    else params.set('status', 'in.(waiting,notified)');
    try {
      const rows = await supabaseRequest(`/rest/v1/waitlist_entries?${params.toString()}`);
      return sendJson(response, 200, { ok: true, entries: Array.isArray(rows) ? rows : [] });
    } catch (error) {
      logError(context, 'waitlist_load_failed', error);
      return sendJson(response, 502, { ok: false, error: { code: 'waitlist_unavailable', message: 'Lista d’attesa non disponibile.' } });
    }
  }

  let body;
  try { body = await readJsonBody(request); }
  catch { return sendJson(response, 400, { ok: false, error: { code: 'invalid_json', message: 'Richiesta non valida.' } }); }
  const validation = validateWaitlistAdminPayload(body);
  if (!validation.ok) return sendJson(response, 400, { ok: false, error: { code: 'invalid_waitlist_update', message: 'Aggiornamento non valido.', fields: validation.errors } });
  try {
    const entry = await supabaseRequest('/rest/v1/rpc/admin_update_waitlist', {
      method: 'POST',
      body: {
        p_waitlist_id: validation.value.waitlistId,
        p_status: validation.value.status,
        p_note: validation.value.note || null,
        p_actor_id: admin.id
      }
    });
    const record = Array.isArray(entry) ? entry[0] : entry;
    let notificationDeferred = false;
    if (validation.value.status === 'notified') {
      try { await processPendingOutboxForWaitlistReference(record?.reference); }
      catch (notificationError) {
        notificationDeferred = true;
        logError(context, 'waitlist_delivery_deferred', notificationError);
      }
    }
    logInfo(context, 'waitlist_updated', { status: validation.value.status });
    return sendJson(response, 200, { ok: true, entry: record, notificationDeferred });
  } catch (error) {
    logError(context, 'waitlist_update_failed', error);
    return sendJson(response, 502, { ok: false, error: { code: 'waitlist_update_failed', message: 'Lista d’attesa non aggiornata.' } });
  }
}
