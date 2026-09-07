import { createHash } from 'node:crypto';
import { getClientIp } from './http.js';
import { getSupabaseConfig, supabaseRequest } from './supabase.js';

function rateLimitSalt() {
  const explicitSalt = String(process.env.RATE_LIMIT_SALT || '').trim();
  const secretSource = explicitSalt.length >= 32
    ? explicitSalt
    : String(getSupabaseConfig().serviceRoleKey || '').trim();

  if (secretSource.length < 32) {
    const error = new Error('rate_limit_not_configured');
    error.code = 'rate_limit_not_configured';
    throw error;
  }

  return createHash('sha256')
    .update(`sgarra-rate-limit:v1:${secretSource}`)
    .digest('hex');
}

export function rateLimitConfigured() {
  const explicitSalt = String(process.env.RATE_LIMIT_SALT || '').trim();
  if (explicitSalt.length >= 32) return true;
  return String(getSupabaseConfig().serviceRoleKey || '').trim().length >= 32;
}

function fingerprint(request, scope) {
  const salt = rateLimitSalt();
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
