import { AsyncLocalStorage } from 'node:async_hooks';

const FALLBACK_SUPABASE_URL = 'https://aiiwlytquapjjahulbbd.supabase.co';
// Legacy anon key is intentionally public and safe to ship client-side; RLS still protects data.
const FALLBACK_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpaXdseXRxdWFwamphaHVsYmJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0OTUzNTIsImV4cCI6MjEwNDA3MTM1Mn0.9u5rQT0zHdEzZaSETAJ3Ar1Tm9DGWspToOHKseEeT5w';
const requestAuth = new AsyncLocalStorage();

function normalizeBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

export function setSupabaseAdminSession(token) {
  requestAuth.enterWith({ adminSessionToken: String(token || '').trim() });
}

export function getSupabaseConfig() {
  const url = normalizeBaseUrl(process.env.SUPABASE_URL || FALLBACK_SUPABASE_URL);
  const publishableKey = String(
    process.env.SUPABASE_ANON_KEY
    || process.env.SUPABASE_PUBLISHABLE_KEY
    || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    || FALLBACK_ANON_KEY
  ).trim();
  const secretKey = String(process.env.SUPABASE_SECRET_KEY || '').trim();
  const legacyServiceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const serviceRoleKey = secretKey || legacyServiceRoleKey;
  return {
    url,
    anonKey: publishableKey,
    serviceRoleKey,
    serviceKeyUsesBearer: Boolean(!secretKey && legacyServiceRoleKey),
    ready: Boolean(url && (serviceRoleKey || publishableKey))
  };
}

function bearerForAnonymousKey(key) {
  return String(key || '').startsWith('eyJ') ? String(key).trim() : '';
}

export async function supabaseRequest(path, options = {}) {
  const config = getSupabaseConfig();
  const apiKey = config.serviceRoleKey || config.anonKey;
  if (!config.url || !apiKey) {
    const error = new Error('booking_not_configured');
    error.code = 'booking_not_configured';
    throw error;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 8000);
  const contextToken = String(requestAuth.getStore()?.adminSessionToken || '').trim();
  const adminSessionToken = String(options.adminSessionToken || contextToken || '').trim();
  const authorizationToken = options.token
    || (config.serviceRoleKey
      ? (config.serviceKeyUsesBearer ? config.serviceRoleKey : '')
      : bearerForAnonymousKey(config.anonKey));

  try {
    const response = await fetch(`${config.url}${path}`, {
      method: options.method || 'GET',
      headers: {
        apikey: apiKey,
        ...(authorizationToken ? { Authorization: `Bearer ${authorizationToken}` } : {}),
        ...(adminSessionToken ? { 'x-admin-session': adminSessionToken } : {}),
        Accept: 'application/json',
        ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(options.headers || {})
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal
    });

    const text = await response.text();
    let data = null;
    if (text) {
      try { data = JSON.parse(text); } catch { data = { message: text.slice(0, 300) }; }
    }

    if (!response.ok) {
      const error = new Error(data?.message || data?.error_description || `Supabase HTTP ${response.status}`);
      error.code = data?.code || 'supabase_error';
      error.details = data?.details || '';
      error.status = response.status;
      throw error;
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

export async function verifySupabaseUser(accessToken) {
  const config = getSupabaseConfig();
  if (!config.url || !config.anonKey || !accessToken) return null;
  const response = await fetch(`${config.url}/auth/v1/user`, {
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${accessToken}`
    }
  });
  if (!response.ok) return null;
  return response.json();
}

export async function getPublicBookingConfiguration() {
  return supabaseRequest('/rest/v1/rpc/public_booking_configuration', { method: 'POST', body: {} });
}

export async function ensurePublicBookingEnabled() {
  const configuration = await getPublicBookingConfiguration();
  if (!configuration?.configured || configuration?.bookingEnabled !== true) {
    const error = new Error('booking_not_enabled');
    error.code = 'booking_not_configured';
    throw error;
  }
  return configuration;
}
