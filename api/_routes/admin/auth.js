import { adminEmails, createAdminSessionToken } from '../../_lib/admin.js';
import { readJsonBody, rejectMethod, sendJson } from '../../_lib/http.js';
import { consumeRateLimit } from '../../_lib/rate-limit.js';
import { getSupabaseConfig, supabaseRequest } from '../../_lib/supabase.js';

const ADMIN_USERNAME = 'paolo';

export default async function handler(request, response) {
  if (request.method !== 'POST') return rejectMethod(response, ['POST']);

  const config = getSupabaseConfig();
  const allowedEmails = [...adminEmails()];
  if (!config.ready || allowedEmails.length !== 1) {
    return sendJson(response, 503, {
      ok: false,
      error: { code: 'admin_not_configured', message: 'Gestionale non ancora collegato.' }
    });
  }

  try {
    if (!await consumeRateLimit(request, 'admin-auth', 8, 900)) {
      return sendJson(response, 429, {
        ok: false,
        error: { code: 'rate_limited', message: 'Troppi tentativi. Riprova tra qualche minuto.' }
      }, { 'Retry-After': '900' });
    }
  } catch {
    return sendJson(response, 503, {
      ok: false,
      error: { code: 'admin_not_configured', message: 'Gestionale non ancora collegato.' }
    });
  }

  let body;
  try {
    body = await readJsonBody(request);
  } catch {
    return sendJson(response, 400, {
      ok: false,
      error: { code: 'invalid_json', message: 'Richiesta non valida.' }
    });
  }

  const username = String(body?.username || '').trim().toLowerCase();
  const password = String(body?.password || '');
  if (username !== ADMIN_USERNAME || password.length < 8 || password.length > 200) {
    return sendJson(response, 401, {
      ok: false,
      error: { code: 'invalid_credentials', message: 'Utente o password non validi.' }
    });
  }

  let valid = false;
  try {
    const result = await supabaseRequest('/rest/v1/rpc/verify_admin_credentials', {
      method: 'POST',
      body: { p_username: username, p_password: password }
    });
    valid = result === true || (Array.isArray(result) && result[0] === true);
  } catch {
    return sendJson(response, 502, {
      ok: false,
      error: { code: 'auth_failed', message: 'Accesso temporaneamente non disponibile.' }
    });
  }

  if (!valid) {
    return sendJson(response, 401, {
      ok: false,
      error: { code: 'invalid_credentials', message: 'Utente o password non validi.' }
    });
  }

  const session = createAdminSessionToken(ADMIN_USERNAME, 12 * 60 * 60);
  if (!session?.token) {
    return sendJson(response, 503, {
      ok: false,
      error: { code: 'admin_not_configured', message: 'Gestionale non ancora collegato.' }
    });
  }

  return sendJson(response, 200, {
    ok: true,
    user: { username: ADMIN_USERNAME },
    session: {
      accessToken: session.token,
      refreshToken: '',
      expiresAt: session.expiresAt
    }
  }, { 'Cache-Control': 'no-store' });
}
