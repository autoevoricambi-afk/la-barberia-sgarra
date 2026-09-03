const MAX_BODY_BYTES = 64 * 1024;

export function sendJson(response, status, payload, extraHeaders = {}) {
  Object.entries({
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    ...extraHeaders
  }).forEach(([key, value]) => response.setHeader(key, value));
  return response.status(status).json(payload);
}

export function rejectMethod(response, allowed) {
  response.setHeader('Allow', allowed.join(', '));
  return sendJson(response, 405, { ok: false, error: { code: 'method_not_allowed', message: 'Metodo non consentito.' } });
}

export async function readJsonBody(request) {
  if (request.body && typeof request.body === 'object') return request.body;
  if (typeof request.body === 'string') {
    if (Buffer.byteLength(request.body, 'utf8') > MAX_BODY_BYTES) throw new Error('body_too_large');
    return JSON.parse(request.body || '{}');
  }

  let total = 0;
  const chunks = [];
  for await (const chunk of request) {
    total += chunk.length;
    if (total > MAX_BODY_BYTES) throw new Error('body_too_large');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

export function getClientIp(request) {
  const forwarded = String(request.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || request.socket?.remoteAddress || '';
}

export function publicError(error) {
  if (error?.code === 'booking_not_configured') {
    return { status: 503, code: error.code, message: 'Prenotazione online non ancora attiva.' };
  }
  if (error?.code === 'rate_limit_not_configured') {
    return { status: 503, code: 'booking_not_configured', message: 'Prenotazione online non ancora attiva.' };
  }
  if (error?.code === 'slot_unavailable' || error?.details?.includes?.('slot_unavailable')) {
    return { status: 409, code: 'slot_unavailable', message: 'Questo orario non è più disponibile.' };
  }
  return { status: 502, code: 'booking_service_error', message: 'Servizio temporaneamente non disponibile.' };
}
