import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getSupabaseConfig,
  supabaseRequest,
  verifySupabaseUser
} from '../api/_lib/supabase.js';

const variableNames = [
  'SUPABASE_URL',
  'SUPABASE_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SECRET_KEY',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY'
];

async function withEnvironment(values, run) {
  const previous = Object.fromEntries(variableNames.map((name) => [name, process.env[name]]));
  const previousFetch = global.fetch;
  for (const name of variableNames) delete process.env[name];
  Object.assign(process.env, values);
  try {
    await run();
  } finally {
    for (const name of variableNames) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
    global.fetch = previousFetch;
  }
}

test('accetta le chiavi correnti sincronizzate da Vercel e Supabase', async () => {
  await withEnvironment({
    SUPABASE_URL: 'https://project.supabase.co/',
    SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
    SUPABASE_SECRET_KEY: 'sb_secret_test'
  }, async () => {
    assert.deepEqual(getSupabaseConfig(), {
      url: 'https://project.supabase.co',
      anonKey: 'sb_publishable_test',
      serviceRoleKey: 'sb_secret_test',
      serviceKeyUsesBearer: false,
      ready: true
    });
  });
});

test('la chiave secret autentica PostgREST solo tramite apikey', async () => {
  await withEnvironment({
    SUPABASE_URL: 'https://project.supabase.co',
    SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
    SUPABASE_SECRET_KEY: 'sb_secret_test'
  }, async () => {
    let requestHeaders;
    global.fetch = async (_url, options) => {
      requestHeaders = options.headers;
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    };
    await supabaseRequest('/rest/v1/rpc/test', { method: 'POST', body: {} });
    assert.equal(requestHeaders.apikey, 'sb_secret_test');
    assert.equal(requestHeaders.Authorization, undefined);
  });
});

test('la verifica utente usa il token utente e la chiave publishable', async () => {
  await withEnvironment({
    SUPABASE_URL: 'https://project.supabase.co',
    SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
    SUPABASE_SECRET_KEY: 'sb_secret_test'
  }, async () => {
    let requestHeaders;
    global.fetch = async (_url, options) => {
      requestHeaders = options.headers;
      return new Response(JSON.stringify({ id: 'paolo' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    };
    const user = await verifySupabaseUser('user-access-token');
    assert.equal(user.id, 'paolo');
    assert.equal(requestHeaders.apikey, 'sb_publishable_test');
    assert.equal(requestHeaders.Authorization, 'Bearer user-access-token');
  });
});

test('mantiene compatibilità con le chiavi JWT legacy', async () => {
  await withEnvironment({
    SUPABASE_URL: 'https://project.supabase.co',
    SUPABASE_ANON_KEY: 'legacy-anon',
    SUPABASE_SERVICE_ROLE_KEY: 'legacy-service-role'
  }, async () => {
    let requestHeaders;
    global.fetch = async (_url, options) => {
      requestHeaders = options.headers;
      return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } });
    };
    await supabaseRequest('/rest/v1/services');
    assert.equal(requestHeaders.apikey, 'legacy-service-role');
    assert.equal(requestHeaders.Authorization, 'Bearer legacy-service-role');
  });
});
