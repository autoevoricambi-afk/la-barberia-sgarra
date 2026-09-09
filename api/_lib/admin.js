import { getSupabaseConfig, setSupabaseAdminSession } from './supabase.js';

const LOCAL_ADMIN_USERNAME = 'paolo';
const LOCAL_ADMIN_ACTOR_ID = '2c8b7822-278f-4bfe-afca-460c02e02d26';
const DEFAULT_ADMIN_EMAIL = 'sgarra.paolo@libero.it';

export function adminEmails() {
  const configured = String(process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  return new Set(configured.length ? configured : [DEFAULT_ADMIN_EMAIL]);
}

export function isAllowedAdminEmail(email) {
  const allowed = adminEmails();
  return allowed.has(String(email || '').trim().toLowerCase());
}

async function verifyOpaqueSession(token) {
  const config = getSupabaseConfig();
  if (!config.url || !config.anonKey || !token) return null;
  const bearer = String(config.anonKey).startsWith('eyJ') ? config.anonKey : '';
  let response;
  try {
    response = await fetch(`${config.url}/rest/v1/rpc/admin_verify_session`, {
      method: 'POST',
      headers: {
        apikey: config.anonKey,
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({ p_token: token })
    });
  } catch {
    return null;
  }
  if (!response.ok) return null;
  const payload = await response.json().catch(() => null);
  return payload?.ok === true ? payload : null;
}

// Kept for backward imports. New production sessions are opaque DB-backed tokens.
export function createAdminSessionToken() {
  return null;
}

export function verifyAdminSessionToken() {
  return null;
}

export async function authenticateAdmin(request) {
  const authorization = String(request.headers?.authorization || '');
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  const token = String(match[1] || '').trim();
  const session = await verifyOpaqueSession(token);
  if (!session || String(session.username || '').toLowerCase() !== LOCAL_ADMIN_USERNAME) return null;

  setSupabaseAdminSession(token);
  return {
    id: String(session.actorId || LOCAL_ADMIN_ACTOR_ID),
    username: LOCAL_ADMIN_USERNAME,
    email: [...adminEmails()][0] || DEFAULT_ADMIN_EMAIL
  };
}
