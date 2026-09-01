import { adminEmails, isAllowedAdminEmail } from '../_lib/admin.js';
import { readJsonBody, rejectMethod, sendJson } from '../_lib/http.js';
import { getSupabaseConfig } from '../_lib/supabase.js';

export default async function handler(request, response) {
  if (request.method !== 'POST') return rejectMethod(response, ['POST']);
  const config = getSupabaseConfig();
  if (!config.url || !config.anonKey || adminEmails().size === 0) {
    return sendJson(response, 503, { ok: false, error: { code: 'admin_not_configured', message: 'Gestionale non ancora collegato.' } });
  }

  let body;
  try { body = await readJsonBody(request); }
  catch { return sendJson(response, 400, { ok: false, error: { code: 'invalid_json', message: 'Richiesta non valida.' } }); }

  const email = String(body?.email || '').trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email) || !isAllowedAdminEmail(email)) {
    return sendJson(response, 202, { ok: true, message: 'Se l’indirizzo è autorizzato riceverà il link di accesso.' });
  }

  const redirectTo = String(process.env.ADMIN_REDIRECT_URL || '').trim();
  let authResponse;
  try {
    authResponse = await fetch(`${config.url}/auth/v1/otp`, {
      method: 'POST',
      headers: {
        apikey: config.anonKey,
        'Content-Type': 'application/json',
        ...(redirectTo ? { 'x-supabase-redirect-to': redirectTo } : {})
      },
      body: JSON.stringify({ email, create_user: false })
    });
  } catch {
    return sendJson(response, 502, { ok: false, error: { code: 'auth_delivery_failed', message: 'Invio del link non riuscito.' } });
  }

  if (!authResponse.ok) {
    return sendJson(response, 502, { ok: false, error: { code: 'auth_delivery_failed', message: 'Invio del link non riuscito.' } });
  }
  return sendJson(response, 202, { ok: true, message: 'Controlla la posta: il link è valido per un solo accesso.' });
}
