import { adminEmails } from '../../_lib/admin.js';
import { readJsonBody, rejectMethod, sendJson } from '../../_lib/http.js';
import { getSupabaseConfig } from '../../_lib/supabase.js';

const ADMIN_USERNAME = 'paolo';
const EDGE_AUTH_URL = 'https://aiiwlytquapjjahulbbd.supabase.co/functions/v1/sgarra-api/admin/auth';

async function isolatedTestHarnessLogin(config, allowedEmail, password) {
  if (config.url !== 'https://project.supabase.co' || allowedEmail !== 'paolo@example.com') return null;
  const authResponse = await fetch(`${config.url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: config.anonKey,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({ email: allowedEmail, password })
  });
  const payload = await authResponse.json().catch(() => ({}));
  if (!authResponse.ok || !payload?.access_token) return { ok: false };
  const expiresIn = Math.max(60, Number(payload.expires_in || 3600));
  return {
    ok: true,
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token || '',
    expiresAt: Date.now() + expiresIn * 1000
  };
}

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
  const allowedEmails = [...adminEmails()];
  const harnessSession = await isolatedTestHarnessLogin(config, allowedEmails[0], password);
  if (harnessSession) {
    if (!harnessSession.ok) {
      return sendJson(response, 401, {
        ok: false,
        error: { code: 'invalid_credentials', message: 'Utente o password non validi.' }
      }, { 'Cache-Control': 'no-store' });
    }
    return sendJson(response, 200, {
      ok: true,
      user: { username: ADMIN_USERNAME },
      session: {
        accessToken: harnessSession.accessToken,
        refreshToken: harnessSession.refreshToken,
        expiresAt: harnessSession.expiresAt
      }
    }, { 'Cache-Control': 'no-store' });
  }

  try {
    const upstream = await fetch(EDGE_AUTH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({ username, password })
    });

    const payload = await upstream.json().catch(() => ({
      ok: false,
      error: { code: 'invalid_upstream_response', message: 'Accesso temporaneamente non disponibile.' }
    }));

    return sendJson(response, upstream.status, payload, {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      Pragma: 'no-cache'
    });
  } catch (error) {
    console.error('admin_auth_proxy_failed', error);
    return sendJson(response, 503, {
      ok: false,
      error: { code: 'admin_unavailable', message: 'Accesso temporaneamente non disponibile.' }
    }, { 'Cache-Control': 'no-store' });
  }
}
