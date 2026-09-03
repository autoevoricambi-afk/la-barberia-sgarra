import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const baseUrl = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');
const encryptionKey = String(process.env.BACKUP_ENCRYPTION_KEY || '');
if (!baseUrl || !serviceKey) throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sono obbligatori.');
if (!/^[a-f0-9]{64}$/i.test(encryptionKey)) throw new Error('BACKUP_ENCRYPTION_KEY deve contenere 64 caratteri esadecimali.');

const tables = [
  'locations', 'staff', 'services', 'staff_services', 'business_hours', 'schedule_blocks',
  'customers', 'appointments', 'appointment_items', 'appointment_status_history',
  'integration_outbox', 'booking_events', 'booking_settings_audit'
];

async function exportTable(table) {
  const response = await fetch(`${baseUrl}/rest/v1/${table}?select=*`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, Accept: 'application/json' }
  });
  if (!response.ok) throw new Error(`Backup ${table} fallito: HTTP ${response.status}`);
  return response.json();
}

const payload = {
  format: 'sgarra-encrypted-backup-v1',
  createdAt: new Date().toISOString(),
  schemaMigrations: ['202609010001', '202609010002', '202609020003'],
  tables: Object.fromEntries(await Promise.all(tables.map(async (table) => [table, await exportTable(table)])))
};
const clear = Buffer.from(JSON.stringify(payload));
const iv = randomBytes(12);
const key = Buffer.from(encryptionKey, 'hex');
const cipher = createCipheriv('aes-256-gcm', key, iv);
const encrypted = Buffer.concat([cipher.update(clear), cipher.final()]);
const envelope = {
  format: payload.format,
  algorithm: 'aes-256-gcm',
  iv: iv.toString('base64'),
  authTag: cipher.getAuthTag().toString('base64'),
  checksum: createHash('sha256').update(clear).digest('hex'),
  data: encrypted.toString('base64')
};
const directory = path.resolve('backups');
fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
const filename = path.join(directory, `sgarra-${new Date().toISOString().replace(/[:.]/g, '-')}.json.enc`);
fs.writeFileSync(filename, JSON.stringify(envelope), { mode: 0o600 });
process.stdout.write(`Backup cifrato creato: ${filename}\n`);
