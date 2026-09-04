import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const passes = [];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function check(condition, message) {
  if (condition) passes.push(message);
  else failures.push(message);
}

function idsIn(html) {
  return [...html.matchAll(/\sid=["']([^"']+)["']/g)].map((match) => match[1]);
}

function normalizeLocalRef(raw) {
  const value = String(raw || '').trim();
  if (!value || /^(?:https?:|tel:|mailto:|data:|javascript:|#)/i.test(value)) return null;
  const withoutHash = value.split('#')[0].split('?')[0];
  if (!withoutHash) return null;
  if (withoutHash === '/' || withoutHash === 'index.html') return 'index.html';
  if (withoutHash === '/privacy' || withoutHash === 'privacy') return 'privacy.html';
  return withoutHash.replace(/^\//, '');
}

function checkDuplicateIds(relativePath, html) {
  const ids = idsIn(html);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  check(duplicates.length === 0, `${relativePath}: ID HTML univoci`);
}

function checkLocalFiles(relativePath, html) {
  const refs = [
    ...[...html.matchAll(/\s(?:href|src|poster)=["']([^"']+)["']/g)].map((match) => match[1]),
    ...[...html.matchAll(/\ssrcset=["']([^"']+)["']/g)].flatMap((match) =>
      match[1].split(',').map((entry) => entry.trim().split(/\s+/)[0])
    )
  ];

  const missing = refs
    .map(normalizeLocalRef)
    .filter(Boolean)
    .filter((ref) => !fs.existsSync(path.resolve(root, path.dirname(relativePath), ref)));

  check(missing.length === 0, `${relativePath}: tutti i file locali esistono${missing.length ? ` (${missing.join(', ')})` : ''}`);
}

function checkHashLinks(relativePath, html, indexTargetHtml = html) {
  const localIds = new Set(idsIn(html));
  const indexIds = new Set(idsIn(indexTargetHtml));
  const refs = [...html.matchAll(/href=["'](index\.html)?#([^"']+)["']/g)].map((match) => ({
    pointsToIndex: Boolean(match[1]),
    hash: match[2]
  }));
  const missing = refs
    .filter((ref) => !(ref.pointsToIndex ? indexIds : localIds).has(ref.hash))
    .map((ref) => ref.hash);
  check(missing.length === 0, `${relativePath}: destinazioni hash valide${missing.length ? ` (${missing.join(', ')})` : ''}`);
}

const requiredFiles = [
  'index.html',
  'privacy.html',
  'styles.css',
  'script.js',
  'config.js',
  'robots.txt',
  'sitemap.xml',
  'site.webmanifest',
  'vercel.json',
  '.env.example',
  'sw.js',
  'admin/index.html',
  'admin/admin.css',
  'admin/admin.js',
  'admin/manifest.webmanifest',
  'api/[...route].js',
  'api/_routes/availability.js',
  'api/_routes/appointments.js',
  'api/_routes/public-config.js',
  'api/_routes/waitlist.js',
  'api/_routes/admin/auth.js',
  'api/_routes/admin/appointments.js',
  'api/_routes/admin/blocks.js',
  'api/_routes/admin/catalog.js',
  'api/_routes/admin/inventory.js',
  'api/_routes/admin/waitlist.js',
  'api/_routes/admin/metrics.js',
  'api/_routes/events.js',
  'api/_routes/cron/process-outbox.js',
  'api/_lib/logging.js',
  'api/_lib/notifications.js',
  'api/_lib/rate-limit.js',
  'platform/booking-domain.mjs',
  'tools/dev-server.mjs',
  'tools/build-static.mjs',
  'supabase/migrations/202609010001_core_booking.sql',
  'supabase/migrations/202609010002_admin_workflow.sql',
  'supabase/migrations/202609020003_operational_pilot.sql',
  'supabase/migrations/202609030004_complete_operations.sql',
  'docs/PAOLO_DISCOVERY.md',
  'docs/CONTROL_ROOM.md',
  'docs/BASELINE_2026-09-01.md',
  'docs/BOOKING_DOMAIN_CONTRACT.md',
  'docs/LAUNCH_GATE.md',
  'docs/DEPLOYMENT_MAP.md',
  'docs/PILOT_30_DAYS.md',
  'docs/OPERATIONS_RUNBOOK.md',
  'tools/backup-supabase.mjs'
];

requiredFiles.forEach((file) => check(fs.existsSync(path.join(root, file)), `File richiesto: ${file}`));
check(!fs.existsSync(path.join(root, 'la-barberia-sgarra-clean')), 'Nessuna cartella applicazione annidata');

const indexHtml = read('index.html');
const privacyHtml = read('privacy.html');
const adminHtml = read('admin/index.html');
const configJs = read('config.js');
const robotsTxt = read('robots.txt');
const sitemapXml = read('sitemap.xml');
const devServer = read('tools/dev-server.mjs');

checkDuplicateIds('index.html', indexHtml);
checkDuplicateIds('privacy.html', privacyHtml);
checkDuplicateIds('admin/index.html', adminHtml);
checkLocalFiles('index.html', indexHtml);
checkLocalFiles('privacy.html', privacyHtml);
checkLocalFiles('admin/index.html', adminHtml);
checkHashLinks('index.html', indexHtml);
checkHashLinks('privacy.html', privacyHtml, indexHtml);

const forbiddenPublicCopy = [
  'Documento incompleto',
  'da finalizzare',
  'Testo da approvare',
  'giorni da verificare'
];
forbiddenPublicCopy.forEach((text) => {
  check(!indexHtml.includes(text) && !privacyHtml.includes(text), `Copy editoriale assente: ${text}`);
});

check(!indexHtml.includes('fonts.googleapis.com') && !indexHtml.includes('fonts.gstatic.com'), 'Nessun font remoto nel percorso critico');
check(/launchReady:\s*false/.test(configJs), 'Staging protetto da launchReady=false');
check(/mode:\s*'request'/.test(configJs), 'Booking reale disattivato finché catalogo e orari non sono approvati');
check(/serviceCatalogReady:\s*false/.test(configJs), 'Catalogo booking protetto da feature gate');
check(/pwaEnabled:\s*true/.test(configJs), 'Web app installabile nel pilot');
check(/siteUrl:\s*'https:\/\/la-barberia-sgarra\.vercel\.app'/.test(configJs), 'URL tecnico centralizzato');
check(/Disallow:\s*\//.test(robotsTxt), 'robots.txt blocca lo staging');
check(/<meta name="robots" content="noindex, nofollow" id="robots-meta"/.test(indexHtml), 'Meta robots staging presente');

const sitemapUrls = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
check(sitemapUrls.length > 0 && sitemapUrls.every((url) => /^https:\/\//.test(url)), 'Sitemap contiene solo URL assoluti');

const manifest = JSON.parse(read('site.webmanifest'));
check(manifest.display === 'standalone', 'Manifest PWA standalone');
check(Array.isArray(manifest.icons) && manifest.icons.every((icon) => fs.existsSync(path.join(root, icon.src))), 'Icone manifest presenti');

const vercel = JSON.parse(read('vercel.json'));
const headerKeys = new Set((vercel.headers || []).flatMap((rule) => (rule.headers || []).map((header) => header.key)));
['X-Content-Type-Options', 'X-Frame-Options', 'Referrer-Policy', 'Permissions-Policy'].forEach((key) => {
  check(headerKeys.has(key), `Header Vercel: ${key}`);
});

check(/id="customer-phone"/.test(indexHtml), 'Wizard raccoglie il recapito necessario alla conferma');
check(/nome, telefono, email facoltativa, servizio/i.test(privacyHtml), 'Privacy coerente con i campi effettivi del wizard');
check(privacyHtml.includes('Partita IVA 08703770720'), 'Titolare e Partita IVA presenti nella privacy');
check(privacyHtml.includes('index.html#dove-siamo'), 'Link contatti privacy valido');
check(/<meta name="robots" content="noindex, nofollow"/.test(adminHtml), 'Gestionale escluso dai motori di ricerca');
check(adminHtml.includes('id="new-appointment-form"'), 'Gestionale crea appuntamenti manuali');
check(adminHtml.includes('id="block-form"'), 'Gestionale crea pause e chiusure');
check(adminHtml.includes('id="settings-form"'), 'Gestionale configura servizi e orari');
check(adminHtml.includes('id="product-form"'), 'Gestionale controlla le giacenze');
check(adminHtml.includes('id="waitlist-list"'), 'Gestionale controlla la lista d’attesa');
check(indexHtml.includes('id="waitlist-box"'), 'Sito offre la lista d’attesa quando gli slot sono esauriti');
check(devServer.includes("'/api/public-config'") && devServer.includes("'/api/waitlist'") && devServer.includes("'/api/admin/inventory'") && devServer.includes("'/api/admin/waitlist'"), 'Server locale espone tutte le nuove API');
check(indexHtml.includes('id="customer-email"'), 'Booking raccoglie email facoltativa per le notifiche');

const coreMigration = read('supabase/migrations/202609010001_core_booking.sql');
check(coreMigration.includes('appointments_no_active_overlap'), 'Database impedisce sovrapposizioni attive');
check(coreMigration.includes("timezone text not null default 'Europe/Rome'"), 'Timezone booking fissata a Europe/Rome');
check(coreMigration.includes('idempotency_key text not null unique'), 'Creazione appuntamento idempotente');
check(!/insert into public\.services\s*\(/i.test(coreMigration), 'Nessun prezzo o durata di servizio inventati nella migrazione');
check(!/insert into public\.business_hours\s*\(/i.test(coreMigration), 'Nessun orario di apertura inventato nella migrazione');

const operationalMigration = read('supabase/migrations/202609020003_operational_pilot.sql');
check(operationalMigration.includes('reserved_starts_at'), 'Buffer prenotazioni modellati separatamente');
check(operationalMigration.includes('consume_public_rate_limit'), 'Rate limit persistente nel database');
check(operationalMigration.includes('admin_reschedule_appointment'), 'Spostamento appuntamento atomico');
check(operationalMigration.includes('admin_create_schedule_block'), 'Blocchi agenda atomici');
check(operationalMigration.includes('admin_replace_booking_settings'), 'Configurazione operativa versionata');
check(operationalMigration.includes('service_conflicts'), 'Combinazioni servizio incompatibili protette');
check(Array.isArray(vercel.crons) && vercel.crons.some((item) => item.path === '/api/cron/process-outbox'), 'Cron recupero notifiche configurato');

const completeMigration = read('supabase/migrations/202609030004_complete_operations.sql');
check(completeMigration.includes('create table if not exists public.products'), 'Magazzino persistente nel database');
check(completeMigration.includes('admin_record_inventory_movement'), 'Movimenti giacenza atomici');
check(completeMigration.includes('inventory.low_stock'), 'Allerta automatica sotto soglia');
check(completeMigration.includes('create table if not exists public.waitlist_entries'), 'Lista d’attesa persistente');
check(completeMigration.includes('waitlist.slot_available'), 'Posto liberato collega la lista d’attesa');
check(completeMigration.includes('late_cancellations'), 'Cancellazioni tardive tracciate');
check(completeMigration.includes('deposit_required'), 'Caparra collegata al profilo di rischio');
check(completeMigration.includes('admin_set_deposit_status'), 'Stato caparra gestibile dal gestionale');
check(completeMigration.includes('booking.reminder_day_before'), 'Promemoria del giorno prima pianificato');
check(completeMigration.includes('booking.reminder_same_day'), 'Promemoria del giorno stesso pianificato');
check(completeMigration.includes('review.request'), 'Richiesta recensione automatica pianificata');
check(completeMigration.includes('estimatedRevenueCents'), 'Valore economico agenda disponibile nei KPI');
check(completeMigration.includes('public_booking_enabled'), 'Attivazione booking protetta nel database');

const envTemplate = read('.env.example');
[
  'SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SECRET_KEY',
  'RATE_LIMIT_SALT', 'CRON_SECRET', 'BACKUP_ENCRYPTION_KEY',
  'BOOKING_NOTIFICATION_WEBHOOK_SECRET'
].forEach((key) => {
  check(envTemplate.includes(`${key}=`), `Variabile operativa documentata: ${key}`);
});

check(vercel.outputDirectory === 'dist', 'Output Vercel isolato dalla root del repository');
check(vercel.buildCommand === 'npm run build', 'Build Vercel esegue QA e pubblicazione whitelist');

passes.forEach((message) => console.log(`PASS  ${message}`));

if (failures.length) {
  failures.forEach((message) => console.error(`FAIL  ${message}`));
  console.error(`\n${failures.length} controllo/i non superato/i.`);
  process.exit(1);
}

console.log(`\n${passes.length} controlli superati.`);
