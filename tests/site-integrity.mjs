import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const passes = [];

const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const exists = (relativePath) => fs.existsSync(path.join(root, relativePath));
const check = (condition, message) => (condition ? passes : failures).push(message);

function idsIn(html) {
  return [...html.matchAll(/\sid=["']([^"']+)["']/g)].map((match) => match[1]);
}

function checkDuplicateIds(relativePath, html) {
  const ids = idsIn(html);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  check(duplicates.length === 0, `${relativePath}: ID HTML univoci`);
}

function normalizeLocalRef(raw) {
  const value = String(raw || '').trim();
  if (!value || /^(?:https?:|tel:|mailto:|data:|javascript:|#)/i.test(value)) return null;
  const clean = value.split('#')[0].split('?')[0];
  if (!clean) return null;
  if (clean === '/' || clean === 'index.html') return 'index.html';
  return clean.replace(/^\//, '');
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
    pointsToIndex: Boolean(match[1]), hash: match[2]
  }));
  const missing = refs.filter((ref) => !(ref.pointsToIndex ? indexIds : localIds).has(ref.hash)).map((ref) => ref.hash);
  check(missing.length === 0, `${relativePath}: destinazioni hash valide${missing.length ? ` (${missing.join(', ')})` : ''}`);
}

const requiredFiles = [
  'index.html', 'privacy.html', 'styles.css', 'app.js', 'robots.txt', 'sitemap.xml',
  'site.webmanifest', 'vercel.json', '.env.example', 'sw.js',
  'admin/index.html', 'admin/admin.css', 'admin/admin.js', 'admin/staff-enhancements.js', 'admin/manifest.webmanifest',
  'api/[...route].js', 'api/_routes/health.js', 'api/_routes/public-config.js', 'api/_routes/availability.js',
  'api/_routes/appointments.js', 'api/_routes/waitlist.js', 'api/_routes/events.js',
  'api/_routes/admin/auth.js', 'api/_routes/admin/refresh.js', 'api/_routes/admin/appointments.js',
  'api/_routes/admin/blocks.js', 'api/_routes/admin/catalog.js', 'api/_routes/admin/inventory.js',
  'api/_routes/admin/waitlist.js', 'api/_routes/admin/metrics.js', 'api/_routes/admin/notifications.js',
  'api/_routes/admin/staff.js', 'api/_routes/cron/process-outbox.js',
  'api/_lib/supabase.js', 'api/_lib/logging.js', 'api/_lib/rate-limit.js', 'api/_lib/notifications.js',
  'platform/booking-domain.mjs', 'tools/build-static.mjs', 'tools/dev-server.mjs', 'tools/backup-supabase.mjs',
  'supabase/migrations/202609010001_core_booking.sql',
  'supabase/migrations/202609020003_operational_pilot.sql',
  'supabase/migrations/202609030004_complete_operations.sql',
  'supabase/migrations/202609040005_verified_pilot_configuration.sql'
];
requiredFiles.forEach((file) => check(exists(file), `File richiesto: ${file}`));

/* Il vecchio frontend a patch non deve più esistere nel ramo operativo. */
['config.js', 'script.js', 'site-enhancements.js'].forEach((file) => {
  check(!exists(file), `Frontend legacy eliminato: ${file}`);
});

const indexHtml = read('index.html');
const privacyHtml = read('privacy.html');
const adminHtml = read('admin/index.html');
const appJs = read('app.js');
const buildStatic = read('tools/build-static.mjs');
const robotsTxt = read('robots.txt');
const sitemapXml = read('sitemap.xml');
const vercel = JSON.parse(read('vercel.json'));

checkDuplicateIds('index.html', indexHtml);
checkDuplicateIds('privacy.html', privacyHtml);
checkDuplicateIds('admin/index.html', adminHtml);
checkLocalFiles('index.html', indexHtml);
checkLocalFiles('privacy.html', privacyHtml);
checkLocalFiles('admin/index.html', adminHtml);
checkHashLinks('index.html', indexHtml);
checkHashLinks('privacy.html', privacyHtml, indexHtml);

/* Un solo controller pubblico, nessuna correzione post-render. */
const publicScripts = [...indexHtml.matchAll(/<script[^>]+src=["']([^"']+)["']/g)].map((m) => m[1].split('?')[0]);
check(publicScripts.length === 1 && publicScripts[0] === 'app.js', 'Homepage carica un solo controller pubblico: app.js');
check(!/config\.js|script\.js|site-enhancements\.js/.test(indexHtml), 'Homepage non referenzia frontend legacy');
check(!appJs.includes('MutationObserver'), 'Controller pubblico non usa MutationObserver per correggere la UI');
check(!/window\.fetch\s*=/.test(appJs), 'Controller pubblico non intercetta globalmente fetch');
check(appJs.includes("const API_BASE = '/api'"), 'Frontend usa una sola API same-origin');
check(appJs.includes("slug: 'paolo-sgarra'") && appJs.includes("slug: 'giuseppe'"), 'Controller gestisce Paolo e Giuseppe');
check(appJs.includes('/public-config') && appJs.includes('/availability') && appJs.includes('/appointments'), 'Controller usa il contratto API pubblico completo');

/* Primo frame completo: hero, galleria e listino sono già nell’HTML. */
check(indexHtml.includes('class="hero-image"') && indexHtml.includes('assets/images/studio/interno-02.webp'), 'Hero definitiva presente direttamente nell’HTML');
check((indexHtml.match(/class="gallery-button"/g) || []).length >= 6, 'Galleria visibile senza rendering JavaScript');
const serviceIds = [...indexHtml.matchAll(/data-service-id="([^"]+)"/g)].map((m) => m[1]);
check(serviceIds.length === 10 && new Set(serviceIds).size === 10, 'Tutti i 10 servizi reali sono visibili e univoci');
['taglio','taglio-shampoo','taglio-barba','taglio-baby','completo','barba','barba-old-school','sopracciglia','shampoo','pettinata'].forEach((id) =>
  check(serviceIds.includes(id), `Servizio pubblico presente: ${id}`)
);
check(indexHtml.includes('value="any">Primo disponibile') && indexHtml.includes('value="paolo-sgarra"') && indexHtml.includes('value="giuseppe"'), 'Scelta Primo disponibile / Paolo / Giuseppe presente nativamente');
check(!/<option[^>]*>\s*(?:08|09|10|11|12|15|16|17|18|19|20):\d{2}\s*<\/option>/i.test(indexHtml), 'Nessun orario finto/statico nell’HTML');
check(!/Altri servizi|Apri WhatsApp|Paolo confermerà|posto è in verifica/i.test(indexHtml), 'Copy legacy WhatsApp e servizi nascosti eliminata');
check(!/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(indexHtml), 'Nessun font remoto nel percorso critico');

/* Pre-lancio protetto finché il dominio non è collegato. */
check(/<meta name="robots" content="noindex, nofollow"/.test(indexHtml), 'Homepage noindex durante collaudo');
check(/Disallow:\s*\//.test(robotsTxt), 'robots.txt blocca il pre-lancio');
check(indexHtml.includes('https://labarberiasgarra.it/'), 'Dominio definitivo dichiarato nel metadata');

/* Build: il dist contiene solo il nuovo frontend. */
check(buildStatic.includes("'app.js'"), 'Build pubblica app.js');
check(!/['"](?:config\.js|script\.js|site-enhancements\.js)['"]/.test(buildStatic), 'Build non pubblica frontend legacy');
check(vercel.outputDirectory === 'dist', 'Output Vercel isolato in dist');
check(vercel.buildCommand === 'npm run build', 'Vercel esegue il build controllato');
check(Array.isArray(vercel.rewrites) && vercel.rewrites.some((r) => r.source === '/api/:path*'), 'Una sola famiglia API same-origin instradata dal router Vercel');
const headerKeys = new Set((vercel.headers || []).flatMap((rule) => (rule.headers || []).map((header) => header.key)));
['X-Content-Type-Options','X-Frame-Options','Referrer-Policy','Permissions-Policy'].forEach((key) => check(headerKeys.has(key), `Header sicurezza Vercel: ${key}`));

/* Booking e privacy. */
check(indexHtml.includes('id="booking-form"') && indexHtml.includes('id="customer-phone"') && indexHtml.includes('id="customer-email"'), 'Modulo booking completo presente');
check(indexHtml.includes('id="booking-consent"') && indexHtml.includes('privacy.html'), 'Consenso privacy collegato al booking');
check(/nome, telefono, email facoltativa, servizio/i.test(privacyHtml), 'Privacy coerente con i dati raccolti');
check(privacyHtml.includes('Partita IVA 08703770720'), 'Titolare e Partita IVA presenti nella privacy');

/* Il gestionale resta separato e protetto durante questo step. */
check(/<meta name="robots" content="noindex, nofollow"/.test(adminHtml), 'Gestionale escluso dai motori di ricerca');
check(adminHtml.includes('id="login-form"') && adminHtml.includes('id="agenda-panel"'), 'Login e agenda gestionale presenti');
check(adminHtml.includes('id="new-appointment-form"') && adminHtml.includes('id="block-form"'), 'Funzioni operative principali del gestionale presenti');

/* Protezioni di dominio e database già esistenti. */
const coreMigration = read('supabase/migrations/202609010001_core_booking.sql');
const operationalMigration = read('supabase/migrations/202609020003_operational_pilot.sql');
const completeMigration = read('supabase/migrations/202609030004_complete_operations.sql');
const verifiedMigration = read('supabase/migrations/202609040005_verified_pilot_configuration.sql');
check(coreMigration.includes('appointments_no_active_overlap'), 'Database impedisce sovrapposizioni attive per operatore');
check(coreMigration.includes("timezone text not null default 'Europe/Rome'"), 'Timezone booking fissata a Europe/Rome');
check(coreMigration.includes('idempotency_key text not null unique'), 'Creazione appuntamento idempotente');
check(operationalMigration.includes('consume_public_rate_limit'), 'Rate limit persistente presente');
check(operationalMigration.includes('admin_reschedule_appointment'), 'Spostamento appuntamento atomico presente');
check(completeMigration.includes('waitlist.slot_available'), 'Lista d’attesa collegata ai posti liberati');
check(/slot_interval_minutes\s*=\s*30/.test(verifiedMigration), 'Intervallo operativo verificato a 30 minuti');

const manifest = JSON.parse(read('site.webmanifest'));
check(manifest.display === 'standalone', 'Manifest PWA valido');
check(Array.isArray(manifest.icons) && manifest.icons.every((icon) => exists(icon.src)), 'Icone manifest presenti');
const sitemapUrls = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
check(sitemapUrls.length > 0 && sitemapUrls.every((url) => /^https:\/\//.test(url)), 'Sitemap contiene URL assoluti');

const envTemplate = read('.env.example');
['SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','SUPABASE_SECRET_KEY','RATE_LIMIT_SALT','CRON_SECRET'].forEach((key) =>
  check(envTemplate.includes(`${key}=`), `Variabile operativa documentata: ${key}`)
);

passes.forEach((message) => console.log(`PASS  ${message}`));
if (failures.length) {
  failures.forEach((message) => console.error(`FAIL  ${message}`));
  console.error(`\n${failures.length} controllo/i non superato/i.`);
  process.exit(1);
}
console.log(`\n${passes.length} controlli superati.`);
