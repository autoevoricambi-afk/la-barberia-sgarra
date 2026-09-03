import { authenticateAdmin } from '../_lib/admin.js';
import { rejectMethod, sendJson } from '../_lib/http.js';
import { supabaseRequest } from '../_lib/supabase.js';

function dateOr(value, fallback) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? value : fallback;
}

export default async function handler(request, response) {
  if (request.method !== 'GET') return rejectMethod(response, ['GET']);
  let admin;
  try { admin = await authenticateAdmin(request); }
  catch { return sendJson(response, 503, { ok: false, error: { code: 'auth_unavailable', message: 'Accesso temporaneamente non disponibile.' } }); }
  if (!admin) return sendJson(response, 401, { ok: false, error: { code: 'unauthorized', message: 'Accesso scaduto o non autorizzato.' } });
  const today = new Date().toISOString().slice(0, 10);
  const fromDate = new Date(); fromDate.setUTCDate(fromDate.getUTCDate() - 30);
  const from = dateOr(request.query?.from, fromDate.toISOString().slice(0, 10));
  const to = dateOr(request.query?.to, today);
  try {
    const data = await supabaseRequest('/rest/v1/rpc/admin_pilot_metrics', {
      method: 'POST', body: { p_from: `${from}T00:00:00+00:00`, p_to: `${to}T23:59:59+00:00` }
    });
    return sendJson(response, 200, { ok: true, from, to, metrics: data || {} });
  } catch {
    return sendJson(response, 502, { ok: false, error: { code: 'metrics_unavailable', message: 'Metriche temporaneamente non disponibili.' } });
  }
}
