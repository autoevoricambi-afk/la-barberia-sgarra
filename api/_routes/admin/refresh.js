import { isAllowedAdminEmail } from '../../_lib/admin.js';
import { readJsonBody, rejectMethod, sendJson } from '../../_lib/http.js';
import { consumeRateLimit } from '../../_lib/rate-limit.js';
import { getSupabaseConfig } from '../../_lib/supabase.js';

export default async function handler(request, response) {
  if (request.method !== 'POST') return rejectMethod(response, ['POST']);
  const config = getSupabaseConfig();
  if (!config.url || !config.anonKey) {
    return sendJson(response, 503, { ok: false, error: { code: 'admin_not_configured', message: 'Gestionale non ancora collegato.' } });
  }

  try {
    if (!await consumeRateLimit(request, 'admin-refresh', 20, 900)) {
      return sendJson(response, 429, { ok: false, error: { code: 'rate_limited', message: 'Troppi tentativi. Riprova tra qualche minuto.' } }, { 'Retry-After': '900' });
    }
  } catch {
    return sendJson(response, 503, { ok: false, error: { code: 'admin_not_configured', message: 'Gestionale non ancora collegato.' } });
  }

  let body;
  try { body = await readJsonBody(request); }
  catch { return sendJson(response, 400, { ok: false, error: { code: 'invalid_json', message: 'Richiesta non valida.' } }); }

  const refreshToken = String(body?.refreshToken || '').trim();
  if (refreshToken.length < 32 || refreshToken.length > 4096) {
    return sendJson(response, 401, { ok: false, error: { code: 'session_expired', message: 'Sessione scaduta. Richiedi un nuovo link di accesso.' } });
  }

  let authResponse;
  try {
    authResponse = await fetch(`${config.url}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { apikey: config.anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken })
    });
  } catch {
    return sendJson(response, 502, { ok: false, error: { code: 'auth_refresh_failed', message: 'Rinnovo accesso temporaneamente non disponibile.' } });
  }

  const data = await authResponse.json().catch(() => ({}));
  if (!authResponse.ok || !data.access_token || !data.refresh_token || !isAllowedAdminEmail(data.user?.email)) {
    return sendJson(response, 401, { ok: false, error: { code: 'session_expired', message: 'Sessione scaduta. Richiedi un nuovo link di accesso.' } });
  }

  const expiresIn = Math.max(60, Number(data.expires_in || 3600));
  return sendJson(response, 200, {
    ok: true,
    session: {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + expiresIn * 1000
    }
  });
}
