import { timingSafeEqual } from 'node:crypto';
import { rejectMethod, sendJson } from '../_lib/http.js';
import { logError, logInfo, requestContext } from '../_lib/logging.js';
import { processOutboxEvent } from '../_lib/notifications.js';
import { supabaseRequest } from '../_lib/supabase.js';

function authorized(request) {
  const secret = String(process.env.CRON_SECRET || '');
  const supplied = String(request.headers?.authorization || '').replace(/^Bearer\s+/i, '');
  if (!secret || secret.length !== supplied.length) return false;
  return timingSafeEqual(Buffer.from(secret), Buffer.from(supplied));
}

async function markProcessed(event) {
  return supabaseRequest(`/rest/v1/integration_outbox?id=eq.${event.id}`, {
    method: 'PATCH',
    body: { processed_at: new Date().toISOString(), attempts: Number(event.attempts || 0) + 1, last_error: null },
    headers: { Prefer: 'return=minimal' }
  });
}

async function markFailed(event, error) {
  const attempts = Number(event.attempts || 0) + 1;
  const delayMinutes = Math.min(60, 2 ** Math.min(attempts, 5));
  return supabaseRequest(`/rest/v1/integration_outbox?id=eq.${event.id}`, {
    method: 'PATCH',
    body: {
      attempts,
      last_error: String(error?.message || error || 'notification_failed').slice(0, 300),
      available_at: new Date(Date.now() + delayMinutes * 60_000).toISOString()
    },
    headers: { Prefer: 'return=minimal' }
  });
}

export default async function handler(request, response) {
  const context = requestContext(request, '/api/cron/process-outbox');
  if (request.method !== 'GET') return rejectMethod(response, ['GET']);
  if (!authorized(request)) return sendJson(response, 401, { ok: false, error: { code: 'unauthorized', message: 'Non autorizzato.' } });
  let events;
  try {
    const params = new URLSearchParams({
      processed_at: 'is.null', available_at: 'lte.' + new Date().toISOString(),
      select: 'id,appointment_id,event_type,payload,attempts,idempotency_key',
      order: 'created_at.asc', limit: '20'
    });
    events = await supabaseRequest(`/rest/v1/integration_outbox?${params.toString()}`);
  } catch (error) {
    logError(context, 'outbox_load_failed', error);
    return sendJson(response, 502, { ok: false, error: { code: 'outbox_unavailable', message: 'Coda non disponibile.' } });
  }

  let processed = 0;
  let failed = 0;
  for (const event of Array.isArray(events) ? events : []) {
    try {
      await processOutboxEvent(event);
      await markProcessed(event);
      processed += 1;
    } catch (error) {
      await markFailed(event, error).catch(() => {});
      failed += 1;
      logError(context, 'outbox_event_failed', error, { eventType: event.event_type, eventId: event.id });
    }
  }
  logInfo(context, 'outbox_batch_done', { processed, failed });
  return sendJson(response, 200, { ok: true, processed, failed });
}
