import { readJsonBody, rejectMethod, sendJson } from '../../_lib/http.js';
import { getSupabaseConfig } from '../../_lib/supabase.js';

const ADMIN_USERNAME = 'paolo';

export default async function handler(request, response) {
  if (request.method !== 'POST') return rejectMethod(response, ['POST']);

  let body;
  try {
    body = await readJsonBody(request);
  } catch {
    return sendJson(response, 400, {
      ok: false,
      error: { code: 'invalid_json', message: 'Richiesta non valida.' }
    }, { 'Cache-Control': 'no-store' });
  }

  const username = String(body?.username || '').trim().toLowerCase();
  const password = String(body?.password || '');
  if (username !== ADMIN_USERNAME || password.length < 8 || password.length > 200) {
    return sendJson(response, 401, {
      ok: false,
      error: { code: 'invalid_credentials', message: 'Utente o password non validi.' }
    }, { 'Cache-Control': 'no-store' });
  }

  const config = getSupabaseConfig();
  if (!config.url || !config.anonKey) {
    return sendJson(response, 503, {
      ok: false,
      error: { code: 'admin_not_configured', message: 'Gestionale non ancora collegato.' }
    }, { 'Cache-Control': 'no-store' });
  }

  const bearer = String(config.anonKey).startsWith('eyJ') ? config.anonKey : '';
  let upstream;
  try {
    upstream = await fetch(`${config.url}/rest/v1/rpc/admin_login`, {
      method: 'POST',
      headers: {
        apikey: config.anonKey,
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({ p_username: username, p_password: password })
    });
  } catch {
    return sendJson(response, 502, {
      ok: false,
      error: { code: 'auth_unavailable', message: 'Accesso temporaneamente non disponibile.' }
    }, { 'Cache-Control': 'no-store' });
  }

  const payload = await upstream.json().catch(() => null);
  if (!upstream.ok || !payload) {
    return sendJson(response, 502, {
      ok: false,
      error: { code: 'auth_unavailable', message: 'Accesso temporaneamente non disponibile.' }
    }, { 'Cache-Control': 'no-store' });
  }

  if (payload.ok !== true) {
    if (payload.code === 'rate_limited') {
      return sendJson(response, 429, {
        ok: false,
        error: { code: 'rate_limited', message: 'Troppi tentativi. Riprova tra qualche minuto.' }
      }, { 'Retry-After': String(payload.retryAfter || 900), 'Cache-Control': 'no-store' });
    }
    return sendJson(response, 401, {
      ok: false,
      error: { code: 'invalid_credentials', message: 'Utente o password non validi.' }
    }, { 'Cache-Control': 'no-store' });
  }

  return sendJson(response, 200, {
    ok: true,
    user: { username: ADMIN_USERNAME },
    session: {
      accessToken: payload.accessToken,
      refreshToken: payload.refreshToken || payload.accessToken,
      expiresAt: Number(payload.expiresAt || Date.now() + 12 * 60 * 60 * 1000)
    }
  }, {
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    Pragma: 'no-cache'
  });
}
