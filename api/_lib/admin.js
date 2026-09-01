import { verifySupabaseUser } from './supabase.js';

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

export async function authenticateAdmin(request) {
  const authorization = String(request.headers?.authorization || '');
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const user = await verifySupabaseUser(match[1]);
  if (!user || !isAllowedAdminEmail(user.email)) return null;
  return { id: user.id, email: user.email };
}
