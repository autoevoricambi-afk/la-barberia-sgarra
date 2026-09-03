import { isValidUuid, validateBlockPayload } from '../../../platform/booking-domain.mjs';
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
  const context = requestContext(request, '/api/admin/blocks');
  if (!['GET', 'POST', 'DELETE'].includes(request.method)) return rejectMethod(response, ['GET', 'POST', 'DELETE']);
  const admin = await authorized(request, response);
  if (!admin) return;
  if (request.method === 'GET') {
    const from = /^\d{4}-\d{2}-\d{2}$/.test(request.query?.from || '') ? request.query.from : new Date().toISOString().slice(0, 10);
    const to = /^\d{4}-\d{2}-\d{2}$/.test(request.query?.to || '') ? request.query.to : from;
    const params = new URLSearchParams({
      select: 'id,starts_at,ends_at,kind,reason,external_id',
      starts_at: `gte.${from}T00:00:00+00:00`,
      order: 'starts_at.asc'
    });
    params.append('starts_at', `lt.${to}T23:59:59+00:00`);
    try {
      const rows = await supabaseRequest(`/rest/v1/schedule_blocks?${params.toString()}`);
      return sendJson(response, 200, { ok: true, blocks: Array.isArray(rows) ? rows : [] });
    } catch (error) {
      logError(context, 'admin_blocks_load_failed', error);
      return sendJson(response, 502, { ok: false, error: { code: 'blocks_unavailable', message: 'Blocchi agenda non disponibili.' } });
    }
  }

  let body;
  try { body = await readJsonBody(request); }
  catch { return sendJson(response, 400, { ok: false, error: { code: 'invalid_json', message: 'Richiesta non valida.' } }); }

  if (request.method === 'DELETE') {
    if (!isValidUuid(body?.blockId)) return sendJson(response, 400, { ok: false, error: { code: 'invalid_block', message: 'Blocco non valido.' } });
    try {
      const result = await supabaseRequest('/rest/v1/rpc/admin_delete_schedule_block', {
        method: 'POST', body: { p_block_id: body.blockId, p_actor_id: admin.id }
      });
      if (result !== true) return sendJson(response, 404, { ok: false, error: { code: 'not_found', message: 'Blocco non trovato o sincronizzato esternamente.' } });
      logInfo(context, 'admin_block_deleted');
      return sendJson(response, 200, { ok: true });
    } catch (error) {
      logError(context, 'admin_block_delete_failed', error);
      return sendJson(response, 502, { ok: false, error: { code: 'delete_failed', message: 'Rimozione non riuscita.' } });
    }
  }

  const validation = validateBlockPayload(body);
  if (!validation.ok) return sendJson(response, 400, { ok: false, error: { code: 'invalid_block', message: 'Controlla il blocco agenda.', fields: validation.errors } });
  try {
    const created = await supabaseRequest('/rest/v1/rpc/admin_create_schedule_block', {
      method: 'POST',
      body: {
        p_staff_slug: validation.value.staffSlug,
        p_starts_at: validation.value.startsAt,
        p_ends_at: validation.value.endsAt,
        p_kind: validation.value.kind,
        p_reason: validation.value.reason || null,
        p_actor_id: admin.id
      }
    });
    logInfo(context, 'admin_block_created', { kind: validation.value.kind });
    return sendJson(response, 201, { ok: true, block: Array.isArray(created) ? created[0] : created });
  } catch (error) {
    logError(context, 'admin_block_create_failed', error);
    const conflict = /overlaps_appointment/i.test(`${error?.message} ${error?.details}`);
    return sendJson(response, conflict ? 409 : 502, { ok: false, error: { code: conflict ? 'block_overlaps_appointment' : 'create_failed', message: conflict ? 'Il blocco si sovrappone a un appuntamento attivo.' : 'Blocco non creato.' } });
  }
}
