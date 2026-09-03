const TOKEN_KEY = 'sgarra_admin_access_token';
const loginPanel = document.getElementById('login-panel');
const agendaPanel = document.getElementById('agenda-panel');
const loginStatus = document.getElementById('login-status');
const agendaStatus = document.getElementById('agenda-status');
const logoutButton = document.getElementById('logout');
const agendaDate = document.getElementById('agenda-date');
const editDialog = document.getElementById('edit-dialog');
let catalog = { services: [], hours: [], location: {} };
let appointments = [];
let waitlistEntries = [];
let inventoryProducts = [];

function todayISO() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function toLocalInput(value) {
  if (!value) return '';
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function toIso(value) {
  return value ? new Date(value).toISOString() : '';
}

function requestKey(prefix) {
  if (window.crypto?.randomUUID) return `${prefix}_${window.crypto.randomUUID()}`;
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

function accessTokenFromHash() {
  return new URLSearchParams(location.hash.replace(/^#/, '')).get('access_token') || '';
}

function getToken() {
  return sessionStorage.getItem(TOKEN_KEY) || '';
}

function setAuthenticated(authenticated) {
  loginPanel.hidden = authenticated;
  agendaPanel.hidden = !authenticated;
  logoutButton.hidden = !authenticated;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.error?.message || 'Operazione non riuscita.');
    error.status = response.status;
    error.fields = data?.error?.fields || {};
    if (response.status === 401) {
      sessionStorage.removeItem(TOKEN_KEY);
      setAuthenticated(false);
    }
    throw error;
  }
  return data;
}

function dateRange(from) {
  const end = new Date(`${from}T12:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 6);
  return { from, to: end.toISOString().slice(0, 10) };
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat('it-IT', {
    timeZone: 'Europe/Rome', weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
  }).format(new Date(value));
}

const statusLabels = {
  pending: 'Da confermare', confirmed: 'Confermato', completed: 'Completato',
  cancelled_by_customer: 'Annullato cliente', cancelled_by_shop: 'Annullato barberia', no_show: 'Non presentato'
};
const actions = {
  pending: [['confirmed', 'Conferma', 'primary'], ['cancelled_by_customer', 'Annulla cliente', ''], ['cancelled_by_shop', 'Annulla barberia', '']],
  confirmed: [['completed', 'Completa', 'primary'], ['cancelled_by_customer', 'Annulla cliente', ''], ['no_show', 'No-show', ''], ['cancelled_by_shop', 'Annulla barberia', '']]
};

function button(label, className, onClick) {
  const item = document.createElement('button');
  item.type = 'button';
  item.className = className || '';
  item.textContent = label;
  item.addEventListener('click', onClick);
  return item;
}

function appointmentCard(item) {
  const article = document.createElement('article');
  article.className = 'appointment-card';
  const customer = item.customers || {};
  const services = (item.appointment_items || []).map((entry) => entry.service_name_snapshot).filter(Boolean).join(' · ');
  const top = document.createElement('div');
  top.className = 'appointment-top';
  const heading = document.createElement('div');
  heading.innerHTML = '<span class="appointment-time"></span><h2></h2><span class="appointment-ref"></span>';
  heading.querySelector('.appointment-time').textContent = formatDateTime(item.starts_at);
  heading.querySelector('h2').textContent = customer.name || 'Cliente';
  heading.querySelector('.appointment-ref').textContent = `${item.reference || ''} · ${item.source || ''}`;
  const badge = document.createElement('span');
  badge.className = `status-badge status-${item.status}`;
  badge.textContent = statusLabels[item.status] || item.status;
  top.append(heading, badge);
  article.appendChild(top);

  const serviceLine = document.createElement('p');
  serviceLine.className = 'appointment-services';
  serviceLine.textContent = services || 'Servizio non disponibile';
  article.appendChild(serviceLine);

  if (customer.phone_normalized) {
    const contacts = document.createElement('div');
    contacts.className = 'appointment-contacts';
    const phone = document.createElement('a');
    phone.href = `tel:${customer.phone_normalized}`;
    phone.textContent = customer.phone_normalized;
    const whatsapp = document.createElement('a');
    whatsapp.target = '_blank';
    whatsapp.rel = 'noopener noreferrer';
    whatsapp.href = `https://wa.me/${customer.phone_normalized.replace(/\D/g, '')}?text=${encodeURIComponent(`Ciao ${customer.name || ''}, ti contatto dalla Barberia Sgarra per l’appuntamento ${item.reference || ''}.`)}`;
    whatsapp.textContent = 'WhatsApp';
    contacts.append(phone, whatsapp);
    article.appendChild(contacts);
  }
  if (item.notes) {
    const notes = document.createElement('p');
    notes.className = 'appointment-notes';
    notes.textContent = item.notes;
    article.appendChild(notes);
  }
  const strikes = Number(customer.late_cancellations || 0) + Number(customer.no_show_count || 0);
  if (strikes || customer.deposit_required || item.deposit_required) {
    const risk = document.createElement('p');
    risk.className = 'customer-risk';
    const depositLabels = { pending: 'da pagare', paid: 'pagata', waived: 'non richiesta', refunded: 'rimborsata', not_required: 'non prevista' };
    const deposit = customer.deposit_required || item.deposit_required
      ? ` · Caparra ${depositLabels[item.deposit_status] || 'richiesta'}${item.deposit_amount_cents ? ` €${(item.deposit_amount_cents / 100).toFixed(2).replace('.', ',')}` : ''}`
      : '';
    risk.textContent = `Affidabilità: ${strikes} segnalazion${strikes === 1 ? 'e' : 'i'}${deposit}`;
    article.appendChild(risk);
  }

  const controls = document.createElement('div');
  controls.className = 'appointment-actions';
  (actions[item.status] || []).forEach(([status, label, className]) => {
    controls.appendChild(button(label, className, () => transition(item.id, status, label)));
  });
  if (item.deposit_required && item.deposit_status === 'pending') {
    controls.appendChild(button('Caparra pagata', 'primary', () => updateDeposit(item.id, 'paid')));
    controls.appendChild(button('Esenta caparra', '', () => updateDeposit(item.id, 'waived')));
  }
  if (['pending', 'confirmed'].includes(item.status)) {
    controls.appendChild(button('Sposta / note', '', () => openEdit(item)));
  }
  if (controls.childElementCount) article.appendChild(controls);
  return article;
}

function renderAgenda(items) {
  const list = document.getElementById('agenda-list');
  list.textContent = '';
  if (!items.length) {
    const empty = document.createElement('p');
    empty.className = 'agenda-empty';
    empty.textContent = 'Nessun appuntamento nel periodo selezionato.';
    list.appendChild(empty);
    return;
  }
  items.forEach((item) => list.appendChild(appointmentCard(item)));
}

async function loadAgenda() {
  const range = dateRange(agendaDate.value || todayISO());
  agendaStatus.textContent = 'Caricamento agenda…';
  const data = await api(`/api/admin/appointments?from=${range.from}&to=${range.to}`);
  appointments = data.appointments || [];
  renderAgenda(appointments);
  agendaStatus.textContent = `${appointments.length} appuntamenti caricati.`;
}

async function loadMetrics() {
  const range = dateRange(agendaDate.value || todayISO());
  const data = await api(`/api/admin/metrics?from=${range.from}&to=${range.to}`);
  const metrics = data.metrics || {};
  document.getElementById('kpi-pending').textContent = String(metrics.pending || 0);
  document.getElementById('kpi-confirmed').textContent = String(metrics.confirmed || 0);
  document.getElementById('kpi-completed').textContent = String(metrics.completed || 0);
  document.getElementById('kpi-cancelled').textContent = String(metrics.cancelled || 0);
  document.getElementById('kpi-no-show').textContent = String(metrics.noShow || 0);
  document.getElementById('kpi-website').textContent = String(metrics.website || 0);
  document.getElementById('kpi-revenue').textContent = `€${(Number(metrics.estimatedRevenueCents || 0) / 100).toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  document.getElementById('kpi-waitlist').textContent = String(metrics.waitlist || 0);
  document.getElementById('kpi-low-stock').textContent = String(metrics.lowStock || 0);
  document.getElementById('kpi-risk').textContent = String(metrics.atRiskCustomers || 0);
}

function renderBlocks(items) {
  const list = document.getElementById('block-list');
  list.textContent = '';
  if (!items.length) {
    list.innerHTML = '<p class="agenda-empty">Nessun blocco.</p>';
    return;
  }
  items.forEach((item) => {
    const card = document.createElement('article');
    card.className = 'block-card';
    const title = document.createElement('strong');
    title.textContent = item.reason || ({ break: 'Pausa', closure: 'Chiusura', manual: 'Blocco' }[item.kind] || 'Blocco');
    const copy = document.createElement('span');
    copy.textContent = `${formatDateTime(item.starts_at)} → ${formatDateTime(item.ends_at)}`;
    card.append(title, copy);
    if (!item.external_id) card.appendChild(button('Rimuovi', 'mini-button', () => deleteBlock(item.id)));
    list.appendChild(card);
  });
}

async function loadBlocks() {
  const range = dateRange(agendaDate.value || todayISO());
  const data = await api(`/api/admin/blocks?from=${range.from}&to=${range.to}`);
  renderBlocks(data.blocks || []);
}

function serviceEditor(item = {}) {
  const row = document.createElement('div');
  row.className = 'settings-row service-row';
  row.innerHTML = `
    <label>Codice<input data-field="slug" value="${item.slug || ''}" placeholder="taglio-uomo" required /></label>
    <label>Nome<input data-field="name" value="${item.name || ''}" required /></label>
    <label>Durata<input data-field="duration" type="number" min="5" max="480" value="${item.duration_minutes || 30}" required /></label>
    <label>Prezzo €<input data-field="price" type="number" min="0" max="1000" step="0.01" value="${item.price_cents == null ? '' : (item.price_cents / 100).toFixed(2)}" /></label>
    <label>Buffer prima<input data-field="before" type="number" min="0" max="120" value="${item.buffer_before_minutes || 0}" /></label>
    <label>Buffer dopo<input data-field="after" type="number" min="0" max="120" value="${item.buffer_after_minutes || 0}" /></label>
    <label class="check-label"><input data-field="active" type="checkbox" ${item.active ? 'checked' : ''} /> Prenotabile</label>
  `;
  row.appendChild(button('Rimuovi', 'mini-button danger', () => row.remove()));
  return row;
}

const weekdays = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
function hourEditor(item = {}) {
  const row = document.createElement('div');
  row.className = 'settings-row hour-row';
  const options = weekdays.map((name, index) => `<option value="${index}" ${Number(item.weekday) === index ? 'selected' : ''}>${name}</option>`).join('');
  row.innerHTML = `
    <label>Giorno<select data-field="weekday">${options}</select></label>
    <label>Apre<input data-field="opens" type="time" value="${String(item.opens_at || '09:00').slice(0, 5)}" required /></label>
    <label>Chiude<input data-field="closes" type="time" value="${String(item.closes_at || '13:00').slice(0, 5)}" required /></label>
  `;
  row.appendChild(button('Rimuovi', 'mini-button danger', () => row.remove()));
  return row;
}

function renderCatalog() {
  const servicesBox = document.getElementById('settings-services');
  const hoursBox = document.getElementById('settings-hours');
  servicesBox.textContent = '';
  hoursBox.textContent = '';
  catalog.services.forEach((item) => servicesBox.appendChild(serviceEditor(item)));
  catalog.hours.forEach((item) => hoursBox.appendChild(hourEditor(item)));
  document.getElementById('setting-notice').value = catalog.location?.min_notice_minutes ?? 120;
  document.getElementById('setting-horizon').value = catalog.location?.booking_horizon_days ?? 45;
  document.getElementById('setting-interval').value = catalog.location?.slot_interval_minutes ?? 15;
  document.getElementById('setting-review-url').value = catalog.location?.review_url || '';
  document.getElementById('setting-strike-limit').value = catalog.location?.cancellation_strike_limit ?? 3;
  document.getElementById('setting-deposit').value = ((catalog.location?.deposit_amount_cents || 0) / 100).toFixed(2);
  document.getElementById('setting-deposit-url').value = catalog.location?.deposit_payment_url || '';
  document.getElementById('setting-booking-enabled').checked = catalog.location?.public_booking_enabled === true;
  const picker = document.getElementById('new-services');
  picker.textContent = '';
  catalog.services.filter((item) => item.active).forEach((item) => {
    const label = document.createElement('label');
    label.className = 'service-choice';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.name = 'new-service';
    input.value = item.slug;
    const price = item.price_cents == null ? '' : ` · €${(item.price_cents / 100).toFixed(2).replace('.', ',')}`;
    label.append(input, document.createTextNode(`${item.name} · ${item.duration_minutes} min${price}`));
    picker.appendChild(label);
  });
  if (!picker.childElementCount) picker.innerHTML = '<p class="admin-help">Attiva almeno un servizio in Configura.</p>';
}

async function loadCatalog() {
  const data = await api('/api/admin/catalog');
  catalog = { services: data.services || [], hours: data.hours || [], location: data.location || {} };
  renderCatalog();
}

async function loadAll() {
  agendaStatus.textContent = 'Sincronizzazione…';
  try {
    await Promise.all([loadAgenda(), loadBlocks(), loadMetrics(), loadCatalog(), loadWaitlist(), loadInventory()]);
  } catch (error) {
    agendaStatus.textContent = error.message;
  }
}

async function transition(appointmentId, status, label) {
  if (!confirm(`${label} questo appuntamento?`)) return;
  let reason = '';
  if (status === 'cancelled_by_customer') {
    reason = confirm('La cancellazione è arrivata all’ultimo momento?\n\nOK = tardiva, Annulla = normale')
      ? 'late_cancellation'
      : 'customer_cancellation';
  }
  agendaStatus.textContent = 'Aggiornamento…';
  try {
    await api('/api/admin/appointments', { method: 'PATCH', body: JSON.stringify({ appointmentId, status, reason }) });
    await Promise.all([loadAgenda(), loadMetrics(), loadWaitlist()]);
  } catch (error) {
    agendaStatus.textContent = error.message;
  }
}

async function updateDeposit(appointmentId, depositStatus) {
  if (!confirm(depositStatus === 'paid' ? 'Confermare che la caparra è stata pagata?' : 'Confermare che la caparra non è richiesta?')) return;
  try {
    await api('/api/admin/appointments', {
      method: 'PATCH', body: JSON.stringify({ action: 'deposit', appointmentId, depositStatus })
    });
    await loadAgenda();
  } catch (error) {
    agendaStatus.textContent = error.message;
  }
}

function waitlistCard(item) {
  const article = document.createElement('article');
  article.className = 'operation-card';
  const customer = item.customers || {};
  const preference = { morning: 'Mattina', afternoon: 'Pomeriggio', any: 'Qualsiasi orario' }[item.time_preference] || 'Qualsiasi orario';
  const title = document.createElement('div');
  title.innerHTML = '<strong></strong><span></span>';
  title.querySelector('strong').textContent = customer.name || 'Cliente';
  title.querySelector('span').textContent = `${item.reference || ''} · ${item.desired_date || ''} · ${preference}`;
  const details = document.createElement('p');
  details.textContent = (item.service_slugs || []).join(' · ');
  const contacts = document.createElement('div');
  contacts.className = 'appointment-contacts';
  if (customer.phone_normalized) {
    const phone = document.createElement('a');
    phone.href = `tel:${customer.phone_normalized}`;
    phone.textContent = customer.phone_normalized;
    contacts.appendChild(phone);
  }
  const controls = document.createElement('div');
  controls.className = 'appointment-actions';
  if (item.status === 'waiting') controls.appendChild(button('Avvisa posto libero', 'primary', () => updateWaitlist(item.id, 'notified')));
  if (['waiting', 'notified'].includes(item.status)) controls.appendChild(button('Segna prenotato', '', () => updateWaitlist(item.id, 'booked')));
  if (['waiting', 'notified'].includes(item.status)) controls.appendChild(button('Rimuovi', '', () => updateWaitlist(item.id, 'cancelled')));
  article.append(title, details, contacts, controls);
  return article;
}

function renderWaitlist(items) {
  const root = document.getElementById('waitlist-list');
  root.textContent = '';
  if (!items.length) {
    root.innerHTML = '<p class="agenda-empty">Nessun cliente in attesa.</p>';
    return;
  }
  items.forEach((item) => root.appendChild(waitlistCard(item)));
}

async function loadWaitlist() {
  const data = await api('/api/admin/waitlist');
  waitlistEntries = data.entries || [];
  renderWaitlist(waitlistEntries);
  document.getElementById('waitlist-status').textContent = `${waitlistEntries.length} richieste attive.`;
}

async function updateWaitlist(waitlistId, status) {
  const copy = status === 'notified' ? 'Invio dell’avviso…' : 'Aggiornamento…';
  document.getElementById('waitlist-status').textContent = copy;
  try {
    await api('/api/admin/waitlist', { method: 'PATCH', body: JSON.stringify({ waitlistId, status }) });
    document.getElementById('waitlist-status').textContent = status === 'notified' ? 'Avviso messo in coda.' : 'Lista aggiornata.';
    await loadWaitlist();
  } catch (error) {
    document.getElementById('waitlist-status').textContent = error.message;
  }
}

function inventoryCard(item) {
  const article = document.createElement('article');
  const low = Number(item.stock_quantity) <= Number(item.low_stock_threshold);
  article.className = `operation-card inventory-card${low ? ' is-low' : ''}`;
  const top = document.createElement('div');
  top.className = 'inventory-top';
  const title = document.createElement('div');
  title.innerHTML = '<strong></strong><span></span>';
  title.querySelector('strong').textContent = item.name;
  title.querySelector('span').textContent = item.sku || 'Nessun codice';
  const quantity = document.createElement('div');
  quantity.className = 'inventory-quantity';
  quantity.innerHTML = `<strong>${Number(item.stock_quantity).toLocaleString('it-IT')}</strong><span>${item.unit || 'pz'}</span>`;
  top.append(title, quantity);
  const alert = document.createElement('p');
  alert.className = low ? 'stock-alert' : 'stock-ok';
  alert.textContent = low ? `Paolo, sta finendo: soglia ${Number(item.low_stock_threshold).toLocaleString('it-IT')} ${item.unit || 'pz'}.` : `Disponibilità sopra la soglia di ${Number(item.low_stock_threshold).toLocaleString('it-IT')} ${item.unit || 'pz'}.`;
  const controls = document.createElement('div');
  controls.className = 'appointment-actions';
  controls.append(
    button('Venduto', '', () => inventoryMovement(item, 'sale', -1)),
    button('Utilizzato', '', () => inventoryMovement(item, 'use', -1)),
    button('Carico', 'primary', () => inventoryMovement(item, 'restock', 1)),
    button('Correggi', '', () => inventoryMovement(item, 'correction', 0))
  );
  article.append(top, alert, controls);
  return article;
}

function renderInventory(items) {
  const root = document.getElementById('inventory-list');
  root.textContent = '';
  if (!items.length) {
    root.innerHTML = '<p class="agenda-empty">Aggiungi il primo prodotto da controllare.</p>';
    return;
  }
  items.forEach((item) => root.appendChild(inventoryCard(item)));
}

async function loadInventory() {
  const data = await api('/api/admin/inventory');
  inventoryProducts = data.products || [];
  renderInventory(inventoryProducts);
  const low = inventoryProducts.filter((item) => Number(item.stock_quantity) <= Number(item.low_stock_threshold)).length;
  document.getElementById('inventory-status').textContent = low ? `${low} prodott${low === 1 ? 'o' : 'i'} da riordinare.` : `${inventoryProducts.length} prodotti sotto controllo.`;
}

async function inventoryMovement(item, reason, suggested) {
  const label = reason === 'restock' ? 'Quantità ricevuta' : reason === 'correction' ? 'Correzione (+ o -)' : 'Quantità';
  const raw = prompt(`${label} per ${item.name}:`, String(Math.abs(suggested || 1)));
  if (raw === null) return;
  const amount = Number(String(raw).replace(',', '.'));
  if (!Number.isFinite(amount) || amount === 0) {
    document.getElementById('inventory-status').textContent = 'Inserisci una quantità valida.';
    return;
  }
  const quantityDelta = reason === 'correction' ? amount : Math.abs(amount) * (suggested < 0 ? -1 : 1);
  try {
    await api('/api/admin/inventory', { method: 'POST', body: JSON.stringify({ action: 'movement', productId: item.id, quantityDelta, reason }) });
    await loadInventory();
  } catch (error) {
    document.getElementById('inventory-status').textContent = error.message;
  }
}

function openEdit(item) {
  document.getElementById('edit-id').value = item.id;
  document.getElementById('edit-title').textContent = `${item.reference || 'Appuntamento'} · ${item.customers?.name || ''}`;
  document.getElementById('edit-start').value = toLocalInput(item.starts_at);
  document.getElementById('edit-notes').value = item.notes || '';
  document.getElementById('edit-status').textContent = '';
  editDialog.showModal();
}

async function deleteBlock(blockId) {
  if (!confirm('Rimuovere questo blocco agenda?')) return;
  try {
    await api('/api/admin/blocks', { method: 'DELETE', body: JSON.stringify({ blockId }) });
    await loadBlocks();
  } catch (error) {
    agendaStatus.textContent = error.message;
  }
}

document.querySelectorAll('[data-admin-tab]').forEach((tab) => {
  tab.addEventListener('click', () => {
    const name = tab.dataset.adminTab;
    document.querySelectorAll('[data-admin-tab]').forEach((item) => item.classList.toggle('is-active', item === tab));
    document.querySelectorAll('[data-admin-view]').forEach((view) => {
      const active = view.dataset.adminView === name;
      view.hidden = !active;
      view.classList.toggle('is-active', active);
    });
  });
});

document.getElementById('login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  loginStatus.textContent = 'Invio del link…';
  try {
    const data = await api('/api/admin/auth', {
      method: 'POST', body: JSON.stringify({ email: document.getElementById('admin-email').value })
    });
    loginStatus.textContent = data.message;
  } catch (error) {
    loginStatus.textContent = error.message;
  }
});

document.getElementById('new-appointment-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const status = document.getElementById('new-status');
  const serviceIds = [...document.querySelectorAll('input[name="new-service"]:checked')].map((item) => item.value);
  if (!serviceIds.length) { status.textContent = 'Seleziona almeno un servizio.'; return; }
  status.textContent = 'Salvataggio…';
  try {
    await api('/api/admin/appointments', {
      method: 'POST',
      body: JSON.stringify({
        name: document.getElementById('new-name').value,
        phone: document.getElementById('new-phone').value,
        startsAt: toIso(document.getElementById('new-start').value),
        source: document.getElementById('new-source').value,
        notes: document.getElementById('new-notes').value,
        serviceIds,
        idempotencyKey: requestKey('admin')
      })
    });
    event.currentTarget.reset();
    status.textContent = 'Appuntamento salvato e confermato.';
    await Promise.all([loadAgenda(), loadMetrics()]);
  } catch (error) {
    status.textContent = error.message;
  }
});

document.getElementById('block-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const status = document.getElementById('block-status');
  status.textContent = 'Creazione blocco…';
  try {
    await api('/api/admin/blocks', {
      method: 'POST',
      body: JSON.stringify({
        startsAt: toIso(document.getElementById('block-start').value),
        endsAt: toIso(document.getElementById('block-end').value),
        kind: document.getElementById('block-kind').value,
        reason: document.getElementById('block-reason').value
      })
    });
    event.currentTarget.reset();
    status.textContent = 'Blocco creato.';
    await loadBlocks();
  } catch (error) {
    status.textContent = error.message;
  }
});

document.getElementById('product-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const status = document.getElementById('inventory-status');
  status.textContent = 'Aggiunta prodotto…';
  try {
    await api('/api/admin/inventory', {
      method: 'POST',
      body: JSON.stringify({
        name: document.getElementById('product-name').value,
        sku: document.getElementById('product-sku').value,
        unit: document.getElementById('product-unit').value,
        lowStockThreshold: Number(String(document.getElementById('product-threshold').value).replace(',', '.')),
        active: true
      })
    });
    event.currentTarget.reset();
    document.getElementById('product-unit').value = 'pz';
    document.getElementById('product-threshold').value = '2';
    status.textContent = 'Prodotto aggiunto. Ora registra il primo carico.';
    await loadInventory();
  } catch (error) {
    status.textContent = error.message;
  }
});

document.getElementById('save-notes').addEventListener('click', async () => {
  const status = document.getElementById('edit-status');
  status.textContent = 'Salvataggio note…';
  try {
    await api('/api/admin/appointments', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'notes', appointmentId: document.getElementById('edit-id').value, notes: document.getElementById('edit-notes').value })
    });
    status.textContent = 'Note salvate.';
    await loadAgenda();
  } catch (error) { status.textContent = error.message; }
});

document.getElementById('save-reschedule').addEventListener('click', async () => {
  const status = document.getElementById('edit-status');
  status.textContent = 'Spostamento…';
  try {
    await api('/api/admin/appointments', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'reschedule', appointmentId: document.getElementById('edit-id').value, startsAt: toIso(document.getElementById('edit-start').value) })
    });
    status.textContent = 'Appuntamento spostato.';
    await Promise.all([loadAgenda(), loadMetrics()]);
    setTimeout(() => editDialog.close(), 500);
  } catch (error) { status.textContent = error.message; }
});

document.getElementById('add-service').addEventListener('click', () => {
  document.getElementById('settings-services').appendChild(serviceEditor());
});
document.getElementById('add-hour').addEventListener('click', () => {
  document.getElementById('settings-hours').appendChild(hourEditor());
});

document.getElementById('settings-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const status = document.getElementById('settings-status');
  const services = [...document.querySelectorAll('.service-row')].map((row, index) => ({
    slug: row.querySelector('[data-field="slug"]').value,
    name: row.querySelector('[data-field="name"]').value,
    description: '',
    durationMinutes: Number(row.querySelector('[data-field="duration"]').value),
    priceCents: row.querySelector('[data-field="price"]').value === '' ? null : Math.round(Number(row.querySelector('[data-field="price"]').value) * 100),
    bufferBeforeMinutes: Number(row.querySelector('[data-field="before"]').value),
    bufferAfterMinutes: Number(row.querySelector('[data-field="after"]').value),
    active: row.querySelector('[data-field="active"]').checked,
    sortOrder: index
  }));
  const hours = [...document.querySelectorAll('.hour-row')].map((row) => ({
    weekday: Number(row.querySelector('[data-field="weekday"]').value),
    opensAt: row.querySelector('[data-field="opens"]').value,
    closesAt: row.querySelector('[data-field="closes"]').value,
    active: true
  }));
  status.textContent = 'Salvataggio configurazione…';
  try {
    await api('/api/admin/catalog', {
      method: 'PUT',
      body: JSON.stringify({
        services, hours,
        location: {
          minNoticeMinutes: Number(document.getElementById('setting-notice').value),
          bookingHorizonDays: Number(document.getElementById('setting-horizon').value),
          slotIntervalMinutes: Number(document.getElementById('setting-interval').value),
          publicBookingEnabled: document.getElementById('setting-booking-enabled').checked,
          reviewUrl: document.getElementById('setting-review-url').value,
          cancellationStrikeLimit: Number(document.getElementById('setting-strike-limit').value),
          depositAmountCents: Math.round(Number(document.getElementById('setting-deposit').value || 0) * 100),
          depositPaymentUrl: document.getElementById('setting-deposit-url').value
        }
      })
    });
    status.textContent = 'Configurazione salvata.';
    await loadCatalog();
  } catch (error) {
    status.textContent = error.message;
  }
});

document.getElementById('refresh-all').addEventListener('click', loadAll);
agendaDate.addEventListener('change', () => Promise.all([loadAgenda(), loadBlocks(), loadMetrics()]).catch((error) => { agendaStatus.textContent = error.message; }));
logoutButton.addEventListener('click', () => {
  sessionStorage.removeItem(TOKEN_KEY);
  setAuthenticated(false);
});

agendaDate.value = todayISO();
const hashToken = accessTokenFromHash();
if (hashToken) {
  sessionStorage.setItem(TOKEN_KEY, hashToken);
  history.replaceState(null, '', location.pathname);
}
setAuthenticated(Boolean(getToken()));
if (getToken()) loadAll();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
