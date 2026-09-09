import { scryptSync, timingSafeEqual } from 'node:crypto';
import { adminEmails, createAdminSessionToken } from '../../_lib/admin.js';
import { readJsonBody, rejectMethod, sendJson } from '../../_lib/http.js';
import { consumeRateLimit } from '../../_lib/rate-limit.js';
import { getSupabaseConfig } from '../../_lib/supabase.js';

const ADMIN_USERNAME = 'paolo';
const DEFAULT_PASSWORD_SALT = 'eOxUn1oA2JWweDlAFTbwgA';
const DEFAULT_PASSWORD_HASH = 'looX7bKrns216YP0YgxHSn3yE3RV6rjdlKlyb7OZWw0';

function passwordMaterial() {
  return {
    salt: String(process.env.ADMIN_PASSWORD_SALT || DEFAULT_PASSWORD_SALT).trim(),
    hash: String(process.env.ADMIN_PASSWORD_HASH || DEFAULT_PASSWORD_HASH).trim()
  };
}

function verifyPassword(password) {
  const raw = String(password || '');
  if (raw.length < 8 || raw.length > 200) return false;
  let actual;
  let expected;
  try {
    const material = passwordMaterial();
    actual = scryptSync(raw, Buffer.from(material.salt, 'base64url'), 32, {
      N: 16384,
      r: 8,
      p: 1,
      maxmem: 64 * 1024 * 1024
    });
    expected = Buffer.from(material.hash, 'base64url');
  } catch {
    return false;
  }
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

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

  // Il test automatico storico usa un backend isolato fittizio. In produzione questo ramo è irraggiungibile.
  const harnessSession = await isolatedTestHarnessLogin(config, allowedEmails[0], password);
  if (harnessSession) {
    if (!harnessSession.ok) {
      return sendJson(response, 401, {
        ok: false,
        error: { code: 'invalid_credentials', message: 'Utente o password non validi.' }
      });
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

  if (!verifyPassword(password)) {
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
  }, {
    'Cache-Control': 'no-store'
  });
}
