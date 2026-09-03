function normalizeBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

export function getSupabaseConfig() {
  const url = normalizeBaseUrl(process.env.SUPABASE_URL);
  const anonKey = String(process.env.SUPABASE_ANON_KEY || '').trim();
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  return {
    url,
    anonKey,
    serviceRoleKey,
    ready: Boolean(url && serviceRoleKey)
  };
}

export async function supabaseRequest(path, options = {}) {
  const config = getSupabaseConfig();
  if (!config.ready) {
    const error = new Error('booking_not_configured');
    error.code = 'booking_not_configured';
    throw error;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 8000);
  const token = options.token || config.serviceRoleKey;

  try {
    const response = await fetch(`${config.url}${path}`, {
      method: options.method || 'GET',
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${token}`,
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
      const error = new Error(data?.message || `Supabase HTTP ${response.status}`);
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
