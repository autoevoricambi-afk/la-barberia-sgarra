import { isValidBookingId, isValidUuid, normalizeText, validateBookingSettingsPayload } from '../../../platform/booking-domain.mjs';
import { authenticateAdmin } from '../../_lib/admin.js';
import { readJsonBody, rejectMethod, sendJson } from '../../_lib/http.js';
import { logError, logInfo, requestContext } from '../../_lib/logging.js';
import { processPendingOutboxForReference } from '../../_lib/notifications.js';
import { supabaseRequest } from '../../_lib/supabase.js';

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

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

async function getStaffState(request, response, context) {
  const from = validDate(request.query?.from) ? request.query.from : new Date().toISOString().slice(0, 10);
  const toDate = new Date(`${from}T00:00:00Z`);
  toDate.setUTCDate(toDate.getUTCDate() + 7);
  const to = validDate(request.query?.to) ? request.query.to : toDate.toISOString().slice(0, 10);
  try {
    const [staff, hours, appointments, blocks] = await Promise.all([
      supabaseRequest('/rest/v1/staff?active=eq.true&select=id,slug,display_name,active&order=display_name.asc'),
      supabaseRequest('/rest/v1/business_hours?active=eq.true&select=id,staff_id,weekday,opens_at,closes_at,active&order=weekday.asc,opens_at.asc'),
      supabaseRequest(`/rest/v1/appointments?select=id,reference,staff_id,starts_at,status,staff(slug,display_name)&starts_at=gte.${encodeURIComponent(from + 'T00:00:00+00:00')}&starts_at=lt.${encodeURIComponent(to + 'T23:59:59+00:00')}&order=starts_at.asc`),
      supabaseRequest(`/rest/v1/schedule_blocks?select=id,staff_id,starts_at,ends_at,kind,reason,staff(slug,display_name)&starts_at=gte.${encodeURIComponent(from + 'T00:00:00+00:00')}&starts_at=lt.${encodeURIComponent(to + 'T23:59:59+00:00')}&order=starts_at.asc`)
    ]);
    return sendJson(response, 200, {
      ok: true,
      staff: Array.isArray(staff) ? staff : [],
      hours: Array.isArray(hours) ? hours : [],
      assignments: Array.isArray(appointments) ? appointments : [],
      blocks: Array.isArray(blocks) ? blocks : []
    });
  } catch (error) {
    logError(context, 'admin_staff_state_failed', error);
    return sendJson(response, 502, { ok: false, error: { code: 'staff_unavailable', message: 'Operatori temporaneamente non disponibili.' } });
  }
}

async function reassignAppointment(body, admin, response, context) {
  const appointmentId = normalizeText(body?.appointmentId, 40);
  const staffSlug = normalizeText(body?.staffSlug, 80);
  if (!isValidUuid(appointmentId) || !isValidBookingId(staffSlug)) {
    return sendJson(response, 400, { ok: false, error: { code: 'invalid_reassign', message: 'Appuntamento o operatore non valido.' } });
  }
  try {
    const result = await supabaseRequest('/rest/v1/rpc/admin_reassign_appointment', {
      method: 'POST',
      body: {
        p_appointment_id: appointmentId,
        p_staff_slug: staffSlug,
        p_actor_id: admin.id,
        p_reason: normalizeText(body?.reason, 300) || null
      }
    });
    const appointment = Array.isArray(result) ? result[0] : result;
    try { await processPendingOutboxForReference(appointment?.reference); }
    catch (notificationError) { logError(context, 'admin_reassign_notification_deferred', notificationError); }
    logInfo(context, 'admin_booking_reassigned', { staffSlug });
    return sendJson(response, 200, { ok: true, appointment });
  } catch (error) {
    logError(context, 'admin_booking_reassign_failed', error);
    const conflict = /slot_unavailable|outside_business_hours|staff_service_unavailable/i.test(`${error?.message} ${error?.details}`);
    const message = /staff_service_unavailable/i.test(`${error?.message} ${error?.details}`)
      ? 'Il nuovo operatore non esegue uno dei servizi selezionati.'
      : conflict ? 'Il nuovo operatore non è libero in questo orario.' : 'Riassegnazione non riuscita.';
    return sendJson(response, conflict ? 409 : 502, { ok: false, error: { code: conflict ? 'staff_slot_unavailable' : 'reassign_failed', message } });
  }
}

async function saveStaffSchedules(body, admin, response, context) {
  const staffHours = Array.isArray(body?.staffHours) ? body.staffHours : [];
  if (!staffHours.length) {
    return sendJson(response, 400, { ok: false, error: { code: 'invalid_settings', message: 'Mancano gli orari degli operatori.' } });
  }

  const activeStaff = await supabaseRequest('/rest/v1/staff?active=eq.true&select=slug');
  const allowed = new Set((Array.isArray(activeStaff) ? activeStaff : []).map((item) => item.slug));
  const results = [];

  try {
    for (const schedule of staffHours) {
      const staffSlug = normalizeText(schedule?.staffSlug, 80);
      if (!isValidBookingId(staffSlug) || !allowed.has(staffSlug)) {
        return sendJson(response, 400, { ok: false, error: { code: 'invalid_staff', message: 'Operatore non valido.' } });
      }
      const validation = validateBookingSettingsPayload({
        services: body.services,
        hours: schedule.hours,
        location: body.location
      });
      if (!validation.ok) {
        return sendJson(response, 400, { ok: false, error: { code: 'invalid_settings', message: `Controlla servizi e orari di ${staffSlug}.`, fields: validation.errors } });
      }
      const result = await supabaseRequest('/rest/v1/rpc/admin_replace_booking_settings', {
        method: 'POST',
        body: {
          p_staff_slug: staffSlug,
          p_services: validation.value.services.map((item) => ({
            slug: item.slug,
            name: item.name,
            description: item.description,
            duration_minutes: item.durationMinutes,
            buffer_before_minutes: item.bufferBeforeMinutes,
            buffer_after_minutes: item.bufferAfterMinutes,
            price_cents: item.priceCents,
            active: item.active,
            sort_order: item.sortOrder
          })),
          p_hours: validation.value.hours.map((item) => ({
            weekday: item.weekday,
            opens_at: item.opensAt,
            closes_at: item.closesAt,
            active: item.active
          })),
          p_location: {
            min_notice_minutes: validation.value.location.minNoticeMinutes,
            booking_horizon_days: validation.value.location.bookingHorizonDays,
            slot_interval_minutes: validation.value.location.slotIntervalMinutes,
            public_booking_enabled: validation.value.location.publicBookingEnabled,
            review_url: validation.value.location.reviewUrl,
            cancellation_strike_limit: validation.value.location.cancellationStrikeLimit,
            deposit_amount_cents: validation.value.location.depositAmountCents,
            deposit_payment_url: validation.value.location.depositPaymentUrl
          },
          p_actor_id: admin.id
        }
      });
      results.push({ staffSlug, result });
    }
    logInfo(context, 'admin_staff_schedules_saved', { count: results.length });
    return sendJson(response, 200, { ok: true, results });
  } catch (error) {
    logError(context, 'admin_staff_schedules_failed', error);
    return sendJson(response, 502, { ok: false, error: { code: 'save_failed', message: 'Configurazione operatori non salvata.' } });
  }
}

export default async function handler(request, response) {
  const context = requestContext(request, '/api/admin/staff');
  if (!['GET', 'PATCH', 'PUT'].includes(request.method)) return rejectMethod(response, ['GET', 'PATCH', 'PUT']);
  const admin = await requireAdmin(request, response);
  if (!admin) return;
  if (request.method === 'GET') return getStaffState(request, response, context);

  let body;
  try { body = await readJsonBody(request); }
  catch { return sendJson(response, 400, { ok: false, error: { code: 'invalid_json', message: 'Richiesta non valida.' } }); }

  if (request.method === 'PATCH') return reassignAppointment(body, admin, response, context);
  return saveStaffSchedules(body, admin, response, context);
}
