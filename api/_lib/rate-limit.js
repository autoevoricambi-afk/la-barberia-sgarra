import { createHash } from 'node:crypto';
import { getClientIp } from './http.js';
import { supabaseRequest } from './supabase.js';

function fingerprint(request, scope) {
  const salt = String(process.env.RATE_LIMIT_SALT || '').trim();
  if (salt.length < 32) {
    const error = new Error('rate_limit_not_configured');
    error.code = 'rate_limit_not_configured';
    throw error;
  }
  const ip = getClientIp(request) || 'unknown';
  return createHash('sha256').update(`${salt}:${scope}:${ip}`).digest('hex');
}

export async function consumeRateLimit(request, scope, limit, windowSeconds) {
  const result = await supabaseRequest('/rest/v1/rpc/consume_public_rate_limit', {
    method: 'POST',
    body: {
      p_key: fingerprint(request, scope),
      p_limit: limit,
      p_window_seconds: windowSeconds
    }
  });
  const allowed = Array.isArray(result) ? result[0] : result;
  return allowed === true;
}
