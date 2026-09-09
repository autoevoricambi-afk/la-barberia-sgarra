import { adminEmails } from '../../_lib/admin.js';
import { readJsonBody, rejectMethod, sendJson } from '../../_lib/http.js';
import { consumeRateLimit } from '../../_lib/rate-limit.js';
import { getSupabaseConfig } from '../../_lib/supabase.js';

const ADMIN_USERNAME = 'paolo';

export default async function handler(request, response) {
  if (request.method !== 'POST') return rejectMethod(response, ['POST']);
  const config = getSupabaseConfig();
  const allowedEmails = [...adminEmails()];
  if (!config.url || !config.anonKey || allowedEmails.length !== 1) {
    return sendJson(response, 503, { ok: false, error: { code: 'admin_not_configured', message: 'Gestionale non ancora collegato.' } });
  }

  try {
    if (!await consumeRateLimit(request, 'admin-auth', 5, 900)) {
      return sendJson(response, 429, { ok: false, error: { code: 'rate_limited', message: 'Troppi tentativi. Riprova tra qualche minuto.' } }, { 'Retry-After': '900' });
    }
  } catch {
    return sendJson(response, 503, { ok: false, error: { code: 'admin_not_configured', message: 'Gestionale non ancora collegato.' } });
  }

  let body;
  try { body = await readJsonBody(request); }
  catch { return sendJson(response, 400, { ok: false, error: { code: 'invalid_json', message: 'Richiesta non valida.' } }); }

  const username = String(body?.username || '').trim().toLowerCase();
  const password = String(body?.password || '');
  if (username !== ADMIN_USERNAME || password.length < 8 || password.length > 200) {
    return sendJson(response, 401, { ok: false, error: { code: 'invalid_credentials', message: 'Utente o password non validi.' } });
  }

  let authResponse;
  try {
    authResponse = await fetch(`${config.url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        apikey: config.anonKey,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({ email: allowedEmails[0], password })
    });
  } catch {
    return sendJson(response, 502, { ok: false, error: { code: 'auth_failed', message: 'Accesso temporaneamente non disponibile.' } });
  }

  const payload = await authResponse.json().catch(() => ({}));
  if (!authResponse.ok || !payload?.access_token) {
    return sendJson(response, 401, { ok: false, error: { code: 'invalid_credentials', message: 'Utente o password non validi.' } });
  }

  const expiresIn = Math.max(60, Number(payload.expires_in || 3600));
  return sendJson(response, 200, {
    ok: true,
    user: { username: ADMIN_USERNAME },
    session: {
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token || '',
      expiresAt: Date.now() + expiresIn * 1000
    }
  });
}
