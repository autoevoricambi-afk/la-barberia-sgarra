import { canTransition, normalizeText } from '../../platform/booking-domain.mjs';
import { authenticateAdmin } from '../_lib/admin.js';
import { readJsonBody, rejectMethod, sendJson } from '../_lib/http.js';
import { supabaseRequest } from '../_lib/supabase.js';

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

export default async function handler(request, response) {
  if (!['GET', 'PATCH'].includes(request.method)) return rejectMethod(response, ['GET', 'PATCH']);

  let admin;
  try { admin = await authenticateAdmin(request); }
  catch { return sendJson(response, 503, { ok: false, error: { code: 'auth_unavailable', message: 'Accesso temporaneamente non disponibile.' } }); }
  if (!admin) return sendJson(response, 401, { ok: false, error: { code: 'unauthorized', message: 'Accesso scaduto o non autorizzato.' } });

  if (request.method === 'GET') {
    const from = validDate(request.query?.from) ? request.query.from : new Date().toISOString().slice(0, 10);
    const toDate = new Date(`${from}T00:00:00Z`);
    toDate.setUTCDate(toDate.getUTCDate() + 7);
    const to = validDate(request.query?.to) ? request.query.to : toDate.toISOString().slice(0, 10);
    const params = new URLSearchParams({
      select: 'id,reference,status,starts_at,ends_at,notes,source,created_at,customers(name,phone_normalized),appointment_items(service_name_snapshot)',
      starts_at: `gte.${from}T00:00:00+00:00`,
      order: 'starts_at.asc'
    });
    params.append('starts_at', `lt.${to}T23:59:59+00:00`);

    try {
      const appointments = await supabaseRequest(`/rest/v1/appointments?${params.toString()}`);
      return sendJson(response, 200, { ok: true, appointments: Array.isArray(appointments) ? appointments : [] });
    } catch {
      return sendJson(response, 502, { ok: false, error: { code: 'agenda_unavailable', message: 'Agenda temporaneamente non disponibile.' } });
    }
  }

  let body;
  try { body = await readJsonBody(request); }
  catch { return sendJson(response, 400, { ok: false, error: { code: 'invalid_json', message: 'Richiesta non valida.' } }); }

  const appointmentId = normalizeText(body?.appointmentId, 40);
  const toStatus = normalizeText(body?.status, 40);
  const reason = normalizeText(body?.reason, 300);
  if (!/^[0-9a-f-]{36}$/i.test(appointmentId)) {
    return sendJson(response, 400, { ok: false, error: { code: 'invalid_appointment', message: 'Appuntamento non valido.' } });
  }

  try {
    const currentRows = await supabaseRequest(`/rest/v1/appointments?id=eq.${encodeURIComponent(appointmentId)}&select=status&limit=1`);
    const current = Array.isArray(currentRows) ? currentRows[0] : null;
    if (!current) return sendJson(response, 404, { ok: false, error: { code: 'not_found', message: 'Appuntamento non trovato.' } });
    if (!canTransition(current.status, toStatus)) {
      return sendJson(response, 409, { ok: false, error: { code: 'invalid_transition', message: 'Cambio di stato non consentito.' } });
    }

    const updated = await supabaseRequest('/rest/v1/rpc/admin_transition_appointment', {
      method: 'POST',
      body: {
        p_appointment_id: appointmentId,
        p_to_status: toStatus,
        p_actor_id: admin.id,
        p_reason: reason || null
      }
    });
    return sendJson(response, 200, { ok: true, appointment: Array.isArray(updated) ? updated[0] : updated });
  } catch {
    return sendJson(response, 502, { ok: false, error: { code: 'update_failed', message: 'Aggiornamento non riuscito.' } });
  }
}
