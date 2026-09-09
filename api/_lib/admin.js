import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { getSupabaseConfig, verifySupabaseUser } from './supabase.js';

const LOCAL_ADMIN_USERNAME = 'paolo';
const LOCAL_ADMIN_ACTOR_ID = '2c8b7822-278f-4bfe-afca-460c02e02d26';
const LOCAL_SESSION_VERSION = 'sgarra-admin-v1';

export function adminEmails() {
  return new Set(
    String(process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function isAllowedAdminEmail(email) {
  const allowed = adminEmails();
  return allowed.size > 0 && allowed.has(String(email || '').trim().toLowerCase());
}

function localSessionKey() {
  const config = getSupabaseConfig();
  const serviceRoleKey = String(config.serviceRoleKey || '').trim();
  const rateLimitSalt = String(process.env.RATE_LIMIT_SALT || '').trim();
  const source = serviceRoleKey.length >= 32 ? serviceRoleKey : rateLimitSalt;
  if (source.length < 32) return null;
  return createHash('sha256')
    .update(`${LOCAL_SESSION_VERSION}:${source}`)
    .digest();
}

function encodePayload(payload) {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function signPayload(encodedPayload) {
  const key = localSessionKey();
  if (!key) return '';
  return createHmac('sha256', key).update(encodedPayload).digest('base64url');
}

export function createAdminSessionToken(username = LOCAL_ADMIN_USERNAME, ttlSeconds = 12 * 60 * 60) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const expiresAtSeconds = nowSeconds + Math.max(300, Math.min(Number(ttlSeconds) || 0, 24 * 60 * 60));
  const encodedPayload = encodePayload({
    v: 1,
    u: String(username || '').trim().toLowerCase(),
    iat: nowSeconds,
    exp: expiresAtSeconds
  });
  const signature = signPayload(encodedPayload);
  if (!signature) return null;
  return {
    token: `${encodedPayload}.${signature}`,
    expiresAt: expiresAtSeconds * 1000
  };
}

export function verifyAdminSessionToken(token) {
  const raw = String(token || '').trim();
  const parts = raw.split('.');
  if (parts.length !== 2) return null;
  const [encodedPayload, suppliedSignature] = parts;
  const expectedSignature = signPayload(encodedPayload);
  if (!expectedSignature) return null;

  let supplied;
  let expected;
  try {
    supplied = Buffer.from(suppliedSignature, 'base64url');
    expected = Buffer.from(expectedSignature, 'base64url');
  } catch {
    return null;
  }
  if (!supplied.length || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;

  let payload;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (payload?.v !== 1 || String(payload?.u || '').toLowerCase() !== LOCAL_ADMIN_USERNAME) return null;
  if (!Number.isFinite(Number(payload?.exp)) || Number(payload.exp) <= Math.floor(Date.now() / 1000)) return null;
  return payload;
}

export async function authenticateAdmin(request) {
  const authorization = String(request.headers?.authorization || '');
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  const localSession = verifyAdminSessionToken(match[1]);
  if (localSession) {
    const allowed = [...adminEmails()];
    return {
      id: LOCAL_ADMIN_ACTOR_ID,
      username: LOCAL_ADMIN_USERNAME,
      email: allowed.length === 1 ? allowed[0] : ''
    };
  }

  const user = await verifySupabaseUser(match[1]);
  if (!user || !isAllowedAdminEmail(user.email)) return null;
  return { id: user.id, email: user.email };
}
