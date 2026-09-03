import { validateBookingSettingsPayload } from '../../../platform/booking-domain.mjs';
import { authenticateAdmin } from '../../_lib/admin.js';
import { readJsonBody, rejectMethod, sendJson } from '../../_lib/http.js';
import { logError, logInfo, requestContext } from '../../_lib/logging.js';
import { supabaseRequest } from '../../_lib/supabase.js';

async function authorized(request, response) {
  try {
    const admin = await authenticateAdmin(request);
    if (!admin) sendJson(response, 401, { ok: false, error: { code: 'unauthorized', message: 'Accesso scaduto o non autorizzato.' } });
    return admin;
  } catch {
    sendJson(response, 503, { ok: false, error: { code: 'auth_unavailable', message: 'Accesso temporaneamente non disponibile.' } });
    return null;
  }
}

export default async function handler(request, response) {
  const context = requestContext(request, '/api/admin/catalog');
  if (!['GET', 'PUT'].includes(request.method)) return rejectMethod(response, ['GET', 'PUT']);
  const admin = await authorized(request, response);
  if (!admin) return;

  if (request.method === 'GET') {
    try {
      const [locations, services, hours] = await Promise.all([
        supabaseRequest('/rest/v1/locations?slug=eq.via-corato-48&select=min_notice_minutes,booking_horizon_days,slot_interval_minutes,public_booking_enabled,review_url,cancellation_strike_limit,deposit_amount_cents,deposit_payment_url&limit=1'),
        supabaseRequest('/rest/v1/services?select=slug,name,description,duration_minutes,buffer_before_minutes,buffer_after_minutes,price_cents,active,sort_order&order=sort_order.asc'),
        supabaseRequest('/rest/v1/business_hours?select=weekday,opens_at,closes_at,active&order=weekday.asc,opens_at.asc')
      ]);
      return sendJson(response, 200, {
        ok: true,
        location: Array.isArray(locations) ? locations[0] : locations,
        services: Array.isArray(services) ? services : [],
        hours: Array.isArray(hours) ? hours : []
      });
    } catch (error) {
      logError(context, 'admin_catalog_load_failed', error);
      return sendJson(response, 502, { ok: false, error: { code: 'catalog_unavailable', message: 'Configurazione non disponibile.' } });
    }
  }

  let body;
  try { body = await readJsonBody(request); }
  catch { return sendJson(response, 400, { ok: false, error: { code: 'invalid_json', message: 'Richiesta non valida.' } }); }
  const validation = validateBookingSettingsPayload(body);
  if (!validation.ok) return sendJson(response, 400, { ok: false, error: { code: 'invalid_settings', message: 'Controlla servizi e orari.', fields: validation.errors } });
  try {
    const result = await supabaseRequest('/rest/v1/rpc/admin_replace_booking_settings', {
      method: 'POST',
      body: {
        p_staff_slug: 'paolo-sgarra',
        p_services: validation.value.services.map((item) => ({
          slug: item.slug, name: item.name, description: item.description,
          duration_minutes: item.durationMinutes,
          buffer_before_minutes: item.bufferBeforeMinutes,
          buffer_after_minutes: item.bufferAfterMinutes,
          price_cents: item.priceCents, active: item.active, sort_order: item.sortOrder
        })),
        p_hours: validation.value.hours.map((item) => ({
          weekday: item.weekday, opens_at: item.opensAt, closes_at: item.closesAt, active: item.active
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
    logInfo(context, 'admin_catalog_saved');
    return sendJson(response, 200, { ok: true, result });
  } catch (error) {
    logError(context, 'admin_catalog_save_failed', error);
    return sendJson(response, 502, { ok: false, error: { code: 'save_failed', message: 'Configurazione non salvata.' } });
  }
}
