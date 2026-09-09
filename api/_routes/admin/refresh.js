import { readJsonBody, rejectMethod, sendJson } from '../../_lib/http.js';
import { getSupabaseConfig } from '../../_lib/supabase.js';

export default async function handler(request, response) {
  if (request.method !== 'POST') return rejectMethod(response, ['POST']);

  let body;
  try { body = await readJsonBody(request); }
  catch {
    return sendJson(response, 400, { ok: false, error: { code: 'invalid_json', message: 'Richiesta non valida.' } });
  }

  const refreshToken = String(body?.refreshToken || '').trim();
  if (refreshToken.length < 32 || refreshToken.length > 512) {
    return sendJson(response, 401, { ok: false, error: { code: 'session_expired', message: 'Sessione scaduta. Accedi di nuovo.' } });
  }

  const config = getSupabaseConfig();
  if (!config.url || !config.anonKey) {
    return sendJson(response, 503, { ok: false, error: { code: 'admin_not_configured', message: 'Gestionale non ancora collegato.' } });
  }

  const bearer = String(config.anonKey).startsWith('eyJ') ? config.anonKey : '';
  let upstream;
  try {
    upstream = await fetch(`${config.url}/rest/v1/rpc/admin_refresh_session`, {
      method: 'POST',
      headers: {
        apikey: config.anonKey,
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({ p_token: refreshToken })
    });
  } catch {
    return sendJson(response, 502, { ok: false, error: { code: 'auth_refresh_failed', message: 'Rinnovo accesso temporaneamente non disponibile.' } });
  }

  const payload = await upstream.json().catch(() => null);
  if (!upstream.ok || !payload?.ok || !payload?.accessToken) {
    return sendJson(response, 401, { ok: false, error: { code: 'session_expired', message: 'Sessione scaduta. Accedi di nuovo.' } });
  }

  return sendJson(response, 200, {
    ok: true,
    session: {
      accessToken: payload.accessToken,
      refreshToken: payload.refreshToken || payload.accessToken,
      expiresAt: Number(payload.expiresAt || Date.now() + 12 * 60 * 60 * 1000)
    }
  }, { 'Cache-Control': 'no-store' });
}
