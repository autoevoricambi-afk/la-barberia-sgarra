import { adminEmails, isAllowedAdminEmail } from '../../_lib/admin.js';
import { readJsonBody, rejectMethod, sendJson } from '../../_lib/http.js';
import { consumeRateLimit } from '../../_lib/rate-limit.js';
import { getSupabaseConfig } from '../../_lib/supabase.js';

export default async function handler(request, response) {
  if (request.method !== 'POST') return rejectMethod(response, ['POST']);
  const config = getSupabaseConfig();
  if (!config.url || !config.anonKey || adminEmails().size === 0) {
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

  const email = String(body?.email || '').trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email) || !isAllowedAdminEmail(email)) {
    return sendJson(response, 202, { ok: true, message: 'Se l’indirizzo è autorizzato riceverà il link di accesso.' });
  }

  const forwardedProto = String(request.headers?.['x-forwarded-proto'] || 'https').split(',')[0].trim().toLowerCase();
  const forwardedHost = String(request.headers?.['x-forwarded-host'] || request.headers?.host || '').split(',')[0].trim();
  const safeHost = /^[a-z0-9.-]+(?::\d+)?$/i.test(forwardedHost) ? forwardedHost : '';
  const requestRedirect = safeHost ? `${forwardedProto === 'http' ? 'http' : 'https'}://${safeHost}/admin/` : '';
  const configuredRedirect = String(process.env.ADMIN_REDIRECT_URL || '').trim();
  // Prefer the host actually used for the login request, so preview/custom-domain
  // magic links always return to the matching admin area. The configured value is
  // retained only as a fallback when the request host cannot be trusted.
  const redirectTo = requestRedirect || configuredRedirect;
  let authResponse;
  try {
    authResponse = await fetch(`${config.url}/auth/v1/otp`, {
      method: 'POST',
      headers: {
        apikey: config.anonKey,
        'Content-Type': 'application/json',
        ...(redirectTo ? { 'x-supabase-redirect-to': redirectTo } : {})
      },
      // L'allow-list viene verificata prima della chiamata: al primo accesso Paolo può
      // creare automaticamente il proprio utente senza interventi nel dashboard Supabase.
      body: JSON.stringify({ email, create_user: true })
    });
  } catch {
    return sendJson(response, 502, { ok: false, error: { code: 'auth_delivery_failed', message: 'Invio del link non riuscito.' } });
  }

  if (!authResponse.ok) {
    return sendJson(response, 502, { ok: false, error: { code: 'auth_delivery_failed', message: 'Invio del link non riuscito.' } });
  }
  return sendJson(response, 202, { ok: true, message: 'Controlla la posta: il link è valido per un solo accesso.' });
}
