import { readJsonBody, rejectMethod, sendJson } from '../../_lib/http.js';

const EDGE_AUTH_URL = 'https://aiiwlytquapjjahulbbd.supabase.co/functions/v1/sgarra-api/admin/auth';

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

  try {
    const upstream = await fetch(EDGE_AUTH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        username: String(body?.username || '').trim(),
        password: String(body?.password || '')
      })
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
