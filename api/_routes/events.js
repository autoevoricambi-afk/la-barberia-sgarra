import { normalizeText } from '../../platform/booking-domain.mjs';
import { readJsonBody, rejectMethod, sendJson } from '../_lib/http.js';
import { consumeRateLimit } from '../_lib/rate-limit.js';
import { supabaseRequest } from '../_lib/supabase.js';

const EVENTS = new Set([
  'service_view', 'booking_start', 'slot_view', 'slot_selected', 'booking_confirmed',
  'booking_cancelled', 'appointment_completed', 'no_show', 'review_requested',
  'review_clicked', 'rebooking_confirmed', 'waitlist_joined'
]);
const FORBIDDEN_KEY = /name|phone|note|email|message|customer|date|address|token/i;

function safeProperties(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([key, item]) => {
    return !FORBIDDEN_KEY.test(key) && /^[a-z0-9_]{1,40}$/i.test(key)
      && ['string', 'number', 'boolean'].includes(typeof item)
      && String(item).length <= 80;
  }).slice(0, 12));
}

export default async function handler(request, response) {
  if (request.method !== 'POST') return rejectMethod(response, ['POST']);
  let body;
  try { body = await readJsonBody(request); }
  catch { return sendJson(response, 400, { ok: false, error: { code: 'invalid_json', message: 'Richiesta non valida.' } }); }
  const eventName = normalizeText(body?.eventName, 40);
  if (!EVENTS.has(eventName)) return sendJson(response, 400, { ok: false, error: { code: 'invalid_event', message: 'Evento non valido.' } });
  try {
    if (!await consumeRateLimit(request, 'events', 120, 900)) return sendJson(response, 429, { ok: false, error: { code: 'rate_limited', message: 'Troppe richieste.' } });
    await supabaseRequest('/rest/v1/rpc/record_public_event', {
      method: 'POST',
      body: {
        p_event_name: eventName,
        p_path: normalizeText(body?.path || '/', 160),
        p_source: normalizeText(body?.source || 'website', 40),
        p_properties: safeProperties(body?.properties)
      }
    });
    return sendJson(response, 202, { ok: true });
  } catch {
    return sendJson(response, 202, { ok: true });
  }
}
