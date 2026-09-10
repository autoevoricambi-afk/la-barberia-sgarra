import { randomUUID } from 'node:crypto';
import {
  isValidUuid, normalizeText,
  validateAdminBookingPayload, validateReschedulePayload
} from '../../../platform/booking-domain.mjs';
import { authenticateAdmin } from '../../_lib/admin.js';
import { readJsonBody, rejectMethod, sendJson } from '../../_lib/http.js';
import { logError, logInfo, requestContext } from '../../_lib/logging.js';
import { processPendingOutboxForReference } from '../../_lib/notifications.js';
import { supabaseRequest } from '../../_lib/supabase.js';

const TRANSITIONS = Object.freeze({
  pending: new Set(['confirmed', 'cancelled_by_customer', 'cancelled_by_shop']),
  confirmed: new Set(['arrived', 'in_progress', 'completed', 'cancelled_by_customer', 'cancelled_by_shop', 'no_show']),
  arrived: new Set(['in_progress', 'completed', 'cancelled_by_shop']),
  in_progress: new Set(['completed', 'cancelled_by_shop']),
  completed: new Set(['reopen'])
});

function canTransition(from, to) {
  return TRANSITIONS[from]?.has(to) === true;
}

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

async function requireAdmin(request, response) {
  try {
    const admin = await authenticateAdmin(request);
    if (!admin) sendJson(response, 401, { ok: false, error: { code: 'unauthorized', message: 'Accesso scaduto o non autorizzato.' } });
    return admin;
  } catch {
    sendJson(response, 503, { ok: false, error: { code: 'auth_unavailable', message: 'Accesso temporaneamente non disponibile.' } });
    return null;
  }
}

async function flushNotification(reference, context, event) {
  try { await processPendingOutboxForReference(reference); }
  catch (error) { logError(context, `${event}_notification_deferred`, error); }
}

async function detectOverdueNoShows(context) {
  try {
    const marked = await supabaseRequest('/rest/v1/rpc/admin_detect_overdue_no_shows', {
      method: 'POST', body: { p_grace_minutes: 20 }
    });
    if (marked) logInfo(context, 'admin_no_show_autodetect', { marked });
  } catch (error) {
    logError(context, 'admin_no_show_autodetect_failed', error);
  }
}

async function listAppointments(request, response, context) {
  if (request.query?.customerId) return customerHistory(request, response, context);
  await detectOverdueNoShows(context);
  const from = validDate(request.query?.from) ? request.query.from : new Date().toISOString().slice(0, 10);
  const toDate = new Date(`${from}T00:00:00Z`);
  toDate.setUTCDate(toDate.getUTCDate() + 7);
  const to = validDate(request.query?.to) ? request.query.to : toDate.toISOString().slice(0, 10);
  const params = new URLSearchParams({
    select: 'id,reference,status,staff_id,customer_id,starts_at,ends_at,notes,source,created_at,deposit_required,deposit_amount_cents,deposit_status,late_cancellation,customers(name,phone_normalized,email,completed_visits,late_cancellations,no_show_count,deposit_required),appointment_items(service_name_snapshot,service_id),appointment_status_history(from_status,to_status,actor_type,reason,created_at)',
    starts_at: `gte.${from}T00:00:00+00:00`,
    order: 'starts_at.asc'
  });
  params.append('starts_at', `lt.${to}T23:59:59+00:00`);
  try {
    const appointments = await supabaseRequest(`/rest/v1/appointments?${params.toString()}`);
    logInfo(context, 'admin_agenda_loaded', { count: Array.isArray(appointments) ? appointments.length : 0 });
    return sendJson(response, 200, { ok: true, appointments: Array.isArray(appointments) ? appointments : [] });
  } catch (error) {
    logError(context, 'admin_agenda_failed', error);
    return sendJson(response, 502, { ok: false, error: { code: 'agenda_unavailable', message: 'Agenda temporaneamente non disponibile.' } });
  }
}

async function customerHistory(request, response, context) {
  const customerId = normalizeText(request.query.customerId, 40);
  if (!isValidUuid(customerId)) return sendJson(response, 400, { ok: false, error: { code: 'invalid_customer', message: 'Cliente non valido.' } });
  const params = new URLSearchParams({
    select: 'id,reference,status,starts_at,appointment_items(service_name_snapshot,price_cents_snapshot),staff(display_name)',
    customer_id: `eq.${customerId}`,
    order: 'starts_at.desc',
    limit: '50'
  });
  try {
    const rows = await supabaseRequest(`/rest/v1/appointments?${params.toString()}`);
    logInfo(context, 'admin_customer_history_loaded', { count: Array.isArray(rows) ? rows.length : 0 });
    return sendJson(response, 200, { ok: true, appointments: Array.isArray(rows) ? rows : [] });
  } catch (error) {
    logError(context, 'admin_customer_history_failed', error);
    return sendJson(response, 502, { ok: false, error: { code: 'history_unavailable', message: 'Storico cliente non disponibile.' } });
  }
}

async function createAppointment(body, admin, response, context) {
  const validation = validateAdminBookingPayload({ ...body, idempotencyKey: body?.idempotencyKey || `admin_${randomUUID()}` });
  if (!validation.ok) return sendJson(response, 400, { ok: false, error: { code: 'invalid_booking', message: 'Controlla i dati inseriti.', fields: validation.errors } });
  try {
    const created = await supabaseRequest('/rest/v1/rpc/admin_create_booking', {
      method: 'POST',
      body: {
        p_service_slugs: validation.value.serviceIds,
        p_staff_slug: validation.value.staffSlug,
        p_starts_at: validation.value.startsAt,
        p_customer_name: validation.value.name,
        p_customer_phone: validation.value.phone,
        p_notes: validation.value.notes || null,
        p_source: validation.value.source,
        p_idempotency_key: validation.value.idempotencyKey,
        p_actor_id: admin.id
      }
    });
    const appointment = Array.isArray(created) ? created[0] : created;
    await flushNotification(appointment?.reference, context, 'admin_booking');
    return sendJson(response, 201, { ok: true, appointment });
  } catch (error) {
    logError(context, 'admin_booking_create_failed', error);
    const conflict = /slot_unavailable|overlap|outside_business_hours/i.test(`${error?.message} ${error?.details}`);
    return sendJson(response, conflict ? 409 : 502, { ok: false, error: { code: conflict ? 'slot_unavailable' : 'create_failed', message: conflict ? 'Orario non disponibile.' : 'Creazione non riuscita.' } });
  }
}

async function rescheduleAppointment(body, admin, response, context) {
  const validation = validateReschedulePayload(body);
  if (!validation.ok) return sendJson(response, 400, { ok: false, error: { code: 'invalid_reschedule', message: 'Controlla il nuovo orario.', fields: validation.errors } });
  try {
    const updated = await supabaseRequest('/rest/v1/rpc/admin_reschedule_appointment', {
      method: 'POST',
      body: {
        p_appointment_id: validation.value.appointmentId,
        p_starts_at: validation.value.startsAt,
        p_actor_id: admin.id,
        p_reason: validation.value.reason || null
      }
    });
    const appointment = Array.isArray(updated) ? updated[0] : updated;
    await flushNotification(appointment?.reference, context, 'admin_reschedule');
    return sendJson(response, 200, { ok: true, appointment });
  } catch (error) {
    logError(context, 'admin_booking_reschedule_failed', error);
    const conflict = /slot_unavailable|outside_business_hours|overlap/i.test(`${error?.message} ${error?.details}`);
    return sendJson(response, conflict ? 409 : 502, { ok: false, error: { code: conflict ? 'slot_unavailable' : 'reschedule_failed', message: conflict ? 'Il nuovo orario non è disponibile.' : 'Spostamento non riuscito.' } });
  }
}

async function updateNotes(body, response, context) {
  const appointmentId = normalizeText(body?.appointmentId, 40);
  const notes = normalizeText(body?.notes, 500);
  if (!isValidUuid(appointmentId)) return sendJson(response, 400, { ok: false, error: { code: 'invalid_appointment', message: 'Appuntamento non valido.' } });
  try {
    const rows = await supabaseRequest(`/rest/v1/appointments?id=eq.${encodeURIComponent(appointmentId)}`, {
      method: 'PATCH', body: { notes }, headers: { Prefer: 'return=representation' }
    });
    return sendJson(response, 200, { ok: true, appointment: Array.isArray(rows) ? rows[0] : rows });
  } catch (error) {
    logError(context, 'admin_booking_notes_failed', error);
    return sendJson(response, 502, { ok: false, error: { code: 'update_failed', message: 'Note non aggiornate.' } });
  }
}

async function transitionAppointment(body, admin, response, context) {
  const appointmentId = normalizeText(body?.appointmentId, 40);
  const toStatus = normalizeText(body?.status, 40);
  const reason = normalizeText(body?.reason, 300);
  if (!isValidUuid(appointmentId)) return sendJson(response, 400, { ok: false, error: { code: 'invalid_appointment', message: 'Appuntamento non valido.' } });
  try {
    const currentRows = await supabaseRequest(`/rest/v1/appointments?id=eq.${encodeURIComponent(appointmentId)}&select=status&limit=1`);
    const current = Array.isArray(currentRows) ? currentRows[0] : null;
    if (!current) return sendJson(response, 404, { ok: false, error: { code: 'not_found', message: 'Appuntamento non trovato.' } });
    if (!canTransition(current.status, toStatus)) return sendJson(response, 409, { ok: false, error: { code: 'invalid_transition', message: 'Cambio di stato non consentito.' } });
    const updated = await supabaseRequest('/rest/v1/rpc/admin_transition_appointment', {
      method: 'POST',
      body: { p_appointment_id: appointmentId, p_to_status: toStatus, p_actor_id: admin.id, p_reason: reason || null }
    });
    const appointment = Array.isArray(updated) ? updated[0] : updated;
    await flushNotification(appointment?.reference, context, 'admin_transition');
    return sendJson(response, 200, { ok: true, appointment });
  } catch (error) {
    logError(context, 'admin_booking_transition_failed', error);
    const conflict = /slot_unavailable/i.test(`${error?.message} ${error?.details}`);
    return sendJson(response, conflict ? 409 : 502, {
      ok: false,
      error: { code: conflict ? 'slot_unavailable' : 'update_failed', message: conflict ? 'Lo slot non è più disponibile.' : 'Aggiornamento non riuscito.' }
    });
  }
}

async function updateDeposit(body, admin, response, context) {
  const appointmentId = normalizeText(body?.appointmentId, 40);
  const status = normalizeText(body?.depositStatus, 30);
  if (!isValidUuid(appointmentId) || !['pending', 'paid', 'waived', 'refunded'].includes(status)) {
    return sendJson(response, 400, { ok: false, error: { code: 'invalid_deposit', message: 'Stato caparra non valido.' } });
  }
  try {
    const result = await supabaseRequest('/rest/v1/rpc/admin_set_deposit_status', {
      method: 'POST', body: { p_appointment_id: appointmentId, p_status: status, p_actor_id: admin.id }
    });
    const appointment = Array.isArray(result) ? result[0] : result;
    await flushNotification(appointment?.reference, context, 'deposit');
    return sendJson(response, 200, { ok: true, appointment });
  } catch (error) {
    logError(context, 'deposit_status_failed', error);
    return sendJson(response, 502, { ok: false, error: { code: 'deposit_update_failed', message: 'Caparra non aggiornata.' } });
  }
}

export default async function handler(request, response) {
  const context = requestContext(request, '/api/admin/appointments');
  if (!['GET', 'POST', 'PATCH'].includes(request.method)) return rejectMethod(response, ['GET', 'POST', 'PATCH']);
  const admin = await requireAdmin(request, response);
  if (!admin) return;
  if (request.method === 'GET') return listAppointments(request, response, context);

  let body;
  try { body = await readJsonBody(request); }
  catch { return sendJson(response, 400, { ok: false, error: { code: 'invalid_json', message: 'Richiesta non valida.' } }); }
  if (request.method === 'POST') return createAppointment(body, admin, response, context);
  if (body?.action === 'reschedule') return rescheduleAppointment(body, admin, response, context);
  if (body?.action === 'notes') return updateNotes(body, response, context);
  if (body?.action === 'deposit') return updateDeposit(body, admin, response, context);
  return transitionAppointment(body, admin, response, context);
}
