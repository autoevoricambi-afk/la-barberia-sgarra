(function masterBarberAdmin() {
  'use strict';

  const EDGE_BASE = 'https://aiiwlytquapjjahulbbd.supabase.co/functions/v1/sgarra-api';
  const SESSION_KEY = 'sgarra_admin_session_v1';
  const nativeFetch = window.fetch.bind(window);
  const ACTIVE_STATUSES = new Set(['pending', 'confirmed', 'arrived', 'in_progress']);
  const STAFF_FALLBACK = [
    { slug: 'paolo-sgarra', display_name: 'Paolo Sgarra' },
    { slug: 'giuseppe', display_name: 'Giuseppe' }
  ];
  const state = {
    staff: [],
    hours: [],
    assignments: [],
    blocks: [],
    notifications: [],
    filter: 'all',
    refreshing: false,
    notificationsRefreshing: false
  };

  function token() {
    try {
      const session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
      return session?.accessToken || '';
    } catch { return ''; }
  }

  function rewriteApiUrl(input) {
    if (typeof input !== 'string') return input;
    if (input.startsWith(EDGE_BASE)) return input;
    if (input.startsWith('/api/')) return EDGE_BASE + input.slice(4);
    try {
      const url = new URL(input, location.href);
      if (url.origin === location.origin && url.pathname.startsWith('/api/')) {
        return EDGE_BASE + url.pathname.slice(4) + url.search;
      }
    } catch {}
    return input;
  }

  function safeJson(text) {
    try { return JSON.parse(text || '{}'); } catch { return {}; }
  }

  function dateRange(from) {
    const start = /^\d{4}-\d{2}-\d{2}$/.test(from || '') ? from : new Date().toISOString().slice(0, 10);
    const end = new Date(`${start}T12:00:00Z`);
    end.setUTCDate(end.getUTCDate() + 6);
    return { from: start, to: end.toISOString().slice(0, 10) };
  }

  function formatDateTime(value) {
    if (!value) return '—';
    try {
      return new Intl.DateTimeFormat('it-IT', {
        timeZone: 'Europe/Rome',
        weekday: 'short', day: '2-digit', month: 'short',
        hour: '2-digit', minute: '2-digit'
      }).format(new Date(value));
    } catch { return String(value); }
  }

  function staffLabel(slug) {
    const source = state.staff.length ? state.staff : STAFF_FALLBACK;
    return source.find((item) => item.slug === slug)?.display_name || slug || 'Barbiere';
  }

  function assignmentMap() {
    return new Map(state.assignments.map((item) => [item.reference, item]));
  }

  async function adminRequest(path, options = {}) {
    const response = await nativeFetch(EDGE_BASE + path, {
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        Accept: 'application/json',
        ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
        ...(options.headers || {})
      }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401) localStorage.removeItem(SESSION_KEY);
      throw new Error(data?.error?.message || 'Operazione non riuscita.');
    }
    return data;
  }

  function installStyles() {
    if (document.getElementById('master-admin-style')) return;
    const style = document.createElement('style');
    style.id = 'master-admin-style';
    style.textContent = `
      .staff-pill{display:inline-flex;align-items:center;gap:.35rem;margin:.45rem .45rem .35rem 0;padding:.28rem .52rem;border:1px solid var(--line-strong);background:rgba(178,138,70,.08);color:var(--brass-soft);font-size:.72rem;font-weight:800;text-transform:uppercase;letter-spacing:.04em}
      .staff-pill::before{content:'';width:.45rem;height:.45rem;border-radius:50%;background:currentColor;box-shadow:0 0 0 3px rgba(178,138,70,.10)}
      .staff-capacity{display:flex;flex-wrap:wrap;align-items:center;gap:.6rem;margin:.55rem 0 .8rem;padding:.75rem .85rem;border:1px solid var(--line);background:rgba(18,21,18,.65)}
      .staff-capacity strong{color:var(--cream)}.staff-capacity span{color:var(--muted);font-size:.8rem;line-height:1.45}
      .staff-filters{display:flex;flex-wrap:wrap;gap:.4rem;margin:.45rem 0 .9rem}
      .staff-filters button{min-height:38px;padding:.4rem .68rem;border:1px solid var(--line-strong);background:#0b0d0c;color:var(--muted)}
      .staff-filters button.is-active{color:var(--brass-soft);border-color:var(--brass);background:rgba(178,138,70,.10)}
      .staff-transfer{border-color:rgba(178,138,70,.6)!important;color:var(--brass-soft)!important}
      .master-action{border-color:rgba(178,138,70,.72)!important;color:var(--brass-soft)!important}
      .master-action.primary{background:var(--brass)!important;color:#0a0a09!important}
      .staff-hours-section{margin:.75rem 0 1rem;padding:.9rem;border:1px solid var(--line);background:rgba(5,7,6,.45)}
      .staff-hours-head{display:flex;align-items:center;justify-content:space-between;gap:.8rem;margin-bottom:.65rem}
      .staff-hours-head h4{margin:0;font:400 1.45rem/1 var(--font-display);color:var(--cream)}
      .staff-hours-note,.staff-capacity-note{margin:.3rem 0 .75rem;color:var(--muted);font-size:.8rem;line-height:1.45}
      .notification-head{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;margin-bottom:1rem}
      .channel-state{display:inline-flex;align-items:center;gap:.45rem;padding:.45rem .65rem;border:1px solid var(--line-strong);font-size:.78rem;font-weight:800}
      .channel-state::before{content:'';width:.55rem;height:.55rem;border-radius:50%;background:#c88b42}
      .notification-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.65rem;margin:1rem 0}
      .notification-summary article{padding:.85rem;border:1px solid var(--line);background:rgba(18,21,18,.55)}
      .notification-summary span{display:block;color:var(--muted);font-size:.75rem}.notification-summary strong{display:block;margin-top:.25rem;font-size:1.35rem;color:var(--cream)}
      .notification-list{display:grid;gap:.55rem}.notification-card{padding:.8rem;border:1px solid var(--line);background:rgba(18,21,18,.48)}
      .notification-card-top{display:flex;justify-content:space-between;gap:.8rem;align-items:flex-start}.notification-card strong{color:var(--cream)}.notification-card p{margin:.3rem 0 0;color:var(--muted);font-size:.8rem;line-height:1.45}
      .notification-status{white-space:nowrap;font-size:.7rem;text-transform:uppercase;letter-spacing:.05em;color:var(--brass-soft)}
      .notification-help{padding:.85rem;border-left:3px solid var(--brass);background:rgba(178,138,70,.07);color:var(--muted);line-height:1.5}
      @media(max-width:720px){.notification-summary{grid-template-columns:1fr}.notification-head,.staff-hours-head{flex-direction:column}.staff-capacity{align-items:flex-start;flex-direction:column}}
    `;
    document.head.appendChild(style);
  }

  function installNotificationsView() {
    if (document.querySelector('[data-admin-tab="notifications"]')) return;
    const tabs = document.querySelector('.admin-tabs');
    const agendaPanel = document.getElementById('agenda-panel');
    if (!tabs || !agendaPanel) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.adminTab = 'notifications';
    button.textContent = 'Notifiche';
    tabs.appendChild(button);

    const section = document.createElement('section');
    section.className = 'admin-view';
    section.dataset.adminView = 'notifications';
    section.hidden = true;
    section.innerHTML = `
      <div class="admin-card">
        <div class="notification-head">
          <div>
            <p class="eyebrow">Automazioni</p>
            <h2>Centro notifiche</h2>
          </div>
          <span class="channel-state" id="notification-channel-state">WhatsApp da collegare</span>
        </div>
        <p class="notification-help">Il gestionale prepara già prenotazioni, conferme, spostamenti, annullamenti e promemoria 30 minuti prima. Finché il numero WhatsApp Business di Paolo non viene collegato, gli eventi restano in coda e nessun messaggio viene dichiarato come inviato.</p>
        <div class="notification-summary">
          <article><span>In coda</span><strong id="notification-pending">0</strong></article>
          <article><span>Reminder preparati</span><strong id="notification-reminders">0</strong></article>
          <article><span>Canale</span><strong id="notification-channel">OFF</strong></article>
        </div>
        <p class="admin-status" id="notification-status" role="status" aria-live="polite"></p>
        <div class="notification-list" id="notification-list"></div>
      </div>
    `;
    agendaPanel.appendChild(section);
  }

  function installStaffSelectors() {
    const newGrid = document.querySelector('#new-appointment-form .form-grid');
    if (newGrid && !document.getElementById('new-staff')) {
      const label = document.createElement('label');
      label.innerHTML = 'Barbiere<select id="new-staff" required><option value="paolo-sgarra">Paolo Sgarra</option><option value="giuseppe">Giuseppe</option></select>';
      newGrid.appendChild(label);
    }

    const blockGrid = document.querySelector('#block-form .form-grid');
    if (blockGrid && !document.getElementById('block-staff')) {
      const label = document.createElement('label');
      label.innerHTML = 'Agenda da bloccare<select id="block-staff" required><option value="both">Entrambi</option><option value="paolo-sgarra">Paolo Sgarra</option><option value="giuseppe">Giuseppe</option></select>';
      blockGrid.insertBefore(label, blockGrid.firstElementChild);
    }
  }

  function populateSelectors() {
    const options = state.staff.length ? state.staff : STAFF_FALLBACK;
    const newStaff = document.getElementById('new-staff');
    if (newStaff) {
      const selected = newStaff.value || 'paolo-sgarra';
      newStaff.innerHTML = options.map((item) => `<option value="${item.slug}">${item.display_name}</option>`).join('');
      if (options.some((item) => item.slug === selected)) newStaff.value = selected;
    }
    const blockStaff = document.getElementById('block-staff');
    if (blockStaff) {
      const selected = blockStaff.value || 'both';
      blockStaff.innerHTML = '<option value="both">Entrambi</option>' + options.map((item) => `<option value="${item.slug}">${item.display_name}</option>`).join('');
      blockStaff.value = options.some((item) => item.slug === selected) || selected === 'both' ? selected : 'both';
    }
  }

  function installAgendaControls() {
    const agendaList = document.getElementById('agenda-list');
    if (!agendaList || document.getElementById('staff-capacity-summary')) return;
    const title = agendaList.closest('div')?.querySelector('.admin-section-title');
    const summary = document.createElement('div');
    summary.id = 'staff-capacity-summary';
    summary.className = 'staff-capacity';
    summary.innerHTML = '<strong>2 postazioni · slot ogni 30 min</strong><span>Ogni orario può contenere 2 prenotazioni: 1 Paolo + 1 Giuseppe.</span>';
    if (title) title.insertAdjacentElement('afterend', summary);

    const filters = document.createElement('div');
    filters.id = 'staff-filters';
    filters.className = 'staff-filters';
    filters.innerHTML = '<button type="button" data-staff-filter="all" class="is-active">Tutti</button><button type="button" data-staff-filter="paolo-sgarra">Paolo</button><button type="button" data-staff-filter="giuseppe">Giuseppe</button>';
    summary.insertAdjacentElement('afterend', filters);
    filters.addEventListener('click', (event) => {
      const item = event.target.closest('[data-staff-filter]');
      if (!item) return;
      state.filter = item.dataset.staffFilter;
      filters.querySelectorAll('button').forEach((button) => button.classList.toggle('is-active', button === item));
      applyAgendaFilter();
    });
  }

  function makeAction(label, className, handler) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className || '';
    button.textContent = label;
    button.addEventListener('click', handler);
    return button;
  }

  async function transitionAppointment(assignment, status, label) {
    if (!confirm(`${label} questo appuntamento?`)) return;
    const agendaStatus = document.getElementById('agenda-status');
    if (agendaStatus) agendaStatus.textContent = 'Aggiornamento appuntamento…';
    try {
      await adminRequest('/admin/appointments', {
        method: 'PATCH',
        body: JSON.stringify({ appointmentId: assignment.id, status })
      });
      if (agendaStatus) agendaStatus.textContent = `${label}: aggiornamento completato.`;
      document.getElementById('refresh-all')?.click();
      setTimeout(() => Promise.all([refreshStaffState(), refreshNotifications()]), 300);
    } catch (error) {
      if (agendaStatus) agendaStatus.textContent = error.message;
    }
  }

  async function reassign(assignment, targetSlug) {
    const agendaStatus = document.getElementById('agenda-status');
    const targetName = staffLabel(targetSlug);
    if (!confirm(`Passare ${assignment.reference} a ${targetName} mantenendo esattamente giorno e ora?`)) return;
    if (agendaStatus) agendaStatus.textContent = `Verifico ${targetName}…`;
    try {
      await adminRequest('/admin/staff', {
        method: 'PATCH',
        body: JSON.stringify({
          appointmentId: assignment.id,
          staffSlug: targetSlug,
          reason: `Riassegnazione dal gestionale a ${targetName}`
        })
      });
      if (agendaStatus) agendaStatus.textContent = `Passato a ${targetName}. Lo slot precedente è stato liberato.`;
      document.getElementById('refresh-all')?.click();
      setTimeout(() => Promise.all([refreshStaffState(), refreshNotifications()]), 300);
    } catch (error) {
      if (agendaStatus) agendaStatus.textContent = `${targetName}: ${error.message} L’appuntamento non è stato modificato.`;
    }
  }

  function decorateAgenda() {
    const map = assignmentMap();
    document.querySelectorAll('#agenda-list .appointment-card').forEach((card) => {
      const reference = (card.querySelector('.appointment-ref')?.textContent || '').split(' · ')[0].trim();
      const assignment = map.get(reference);
      if (!assignment) return;
      const slug = assignment.staff?.slug || state.staff.find((item) => item.id === assignment.staff_id)?.slug || '';
      const status = assignment.status;
      card.dataset.staffSlug = slug;
      card.dataset.masterStatus = status;

      let pill = card.querySelector('.staff-pill');
      if (!pill) {
        pill = document.createElement('span');
        pill.className = 'staff-pill';
        card.querySelector('.appointment-services')?.insertAdjacentElement('afterend', pill);
      }
      pill.textContent = staffLabel(slug);

      const badge = card.querySelector('.status-badge');
      const labels = { pending: 'Da confermare', confirmed: 'Confermato', arrived: 'Arrivato', in_progress: 'In lavorazione', completed: 'Completato', cancelled_by_customer: 'Annullato cliente', cancelled_by_shop: 'Annullato barberia', no_show: 'Non presentato' };
      if (badge) badge.textContent = labels[status] || status;

      let controls = card.querySelector('.appointment-actions');
      if (!controls && ['arrived', 'in_progress'].includes(status)) {
        controls = document.createElement('div');
        controls.className = 'appointment-actions';
        card.appendChild(controls);
      }
      if (!controls) return;

      controls.querySelectorAll('button').forEach((button) => {
        const text = button.textContent.trim();
        if (text === 'Annulla cliente') button.textContent = 'Cliente annulla';
        if (text === 'Annulla barberia') button.textContent = 'Barberia annulla';
        if (status === 'confirmed' && text === 'Completa') button.remove();
      });

      controls.querySelectorAll('.master-stage-action,.staff-transfer').forEach((item) => item.remove());

      if (status === 'confirmed') {
        const arrived = makeAction('Arrivato', 'master-action primary master-stage-action', () => transitionAppointment(assignment, 'arrived', 'Cliente arrivato'));
        controls.insertBefore(arrived, controls.firstChild);
      } else if (status === 'arrived') {
        controls.textContent = '';
        controls.appendChild(makeAction('Inizia servizio', 'master-action primary master-stage-action', () => transitionAppointment(assignment, 'in_progress', 'Inizia servizio')));
        controls.appendChild(makeAction('Barberia annulla', 'master-stage-action', () => transitionAppointment(assignment, 'cancelled_by_shop', 'Barberia annulla')));
      } else if (status === 'in_progress') {
        controls.textContent = '';
        controls.appendChild(makeAction('Completa', 'master-action primary master-stage-action', () => transitionAppointment(assignment, 'completed', 'Completa')));
        controls.appendChild(makeAction('Barberia annulla', 'master-stage-action', () => transitionAppointment(assignment, 'cancelled_by_shop', 'Barberia annulla')));
      }

      if (['pending', 'confirmed'].includes(status)) {
        const target = slug === 'giuseppe' ? 'paolo-sgarra' : 'giuseppe';
        const transfer = makeAction(`Passa a ${staffLabel(target).replace(' Sgarra', '')}`, 'staff-transfer', () => reassign(assignment, target));
        transfer.title = `Mantiene esattamente giorno e ora. L’operazione riesce solo se ${staffLabel(target)} è libero.`;
        const editButton = [...controls.querySelectorAll('button')].find((button) => /Sposta \/ note/i.test(button.textContent));
        controls.insertBefore(transfer, editButton || null);
      }
    });
    applyAgendaFilter();
    updateCapacitySummary();
  }

  function applyAgendaFilter() {
    document.querySelectorAll('#agenda-list .appointment-card').forEach((card) => {
      card.hidden = state.filter !== 'all' && card.dataset.staffSlug !== state.filter;
    });
  }

  function updateCapacitySummary() {
    const summary = document.getElementById('staff-capacity-summary');
    if (!summary) return;
    const counts = { 'paolo-sgarra': 0, giuseppe: 0 };
    state.assignments.filter((item) => ACTIVE_STATUSES.has(item.status)).forEach((item) => {
      const slug = item.staff?.slug || state.staff.find((staff) => staff.id === item.staff_id)?.slug;
      if (slug in counts) counts[slug] += 1;
    });
    summary.innerHTML = `<strong>2 postazioni · slot ogni 30 min</strong><span>Settimana: Paolo ${counts['paolo-sgarra']} occupati · Giuseppe ${counts.giuseppe} occupati. Ogni prenotazione blocca solo la sua postazione.</span>`;
  }

  function decorateBlocks() {
    const cards = [...document.querySelectorAll('#block-list .block-card')];
    cards.forEach((card, index) => {
      const block = state.blocks[index];
      if (!block) return;
      let pill = card.querySelector('.staff-pill');
      if (!pill) {
        pill = document.createElement('span');
        pill.className = 'staff-pill';
        card.appendChild(pill);
      }
      const slug = block.staff?.slug || state.staff.find((item) => item.id === block.staff_id)?.slug || '';
      pill.textContent = staffLabel(slug);
    });
  }

  const weekdays = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];

  function hourRow(item, staffSlug) {
    const row = document.createElement('div');
    row.className = 'settings-row hour-row staff-hour-row';
    row.dataset.staffSlug = staffSlug;
    row.innerHTML = `
      <label>Giorno<select data-field="weekday">${weekdays.map((name, index) => `<option value="${index}" ${Number(item.weekday) === index ? 'selected' : ''}>${name}</option>`).join('')}</select></label>
      <label>Apre<input data-field="opens" type="time" value="${String(item.opens_at || '08:30').slice(0, 5)}" required /></label>
      <label>Chiude<input data-field="closes" type="time" value="${String(item.closes_at || '13:00').slice(0, 5)}" required /></label>
    `;
    row.appendChild(makeAction('Rimuovi', 'mini-button danger', () => row.remove()));
    return row;
  }

  function renderStaffHours() {
    if (!state.staff.length) return;
    const root = document.getElementById('settings-hours');
    if (!root) return;
    root.textContent = '';
    state.staff.forEach((staff) => {
      const section = document.createElement('section');
      section.className = 'staff-hours-section';
      section.dataset.staffHours = staff.slug;
      const head = document.createElement('div');
      head.className = 'staff-hours-head';
      const title = document.createElement('h4');
      title.textContent = `Orari ${staff.display_name}`;
      const add = makeAction('Aggiungi fascia', 'mini-button', () => rows.appendChild(hourRow({ weekday: 2, opens_at: '08:30', closes_at: '13:00' }, staff.slug)));
      const rows = document.createElement('div');
      rows.className = 'settings-list staff-hours-rows';
      head.append(title, add);
      const note = document.createElement('p');
      note.className = 'staff-hours-note';
      note.textContent = 'Agenda indipendente. Una prenotazione di questo barbiere non chiude la postazione dell’altro.';
      state.hours.filter((item) => item.staff_id === staff.id).forEach((item) => rows.appendChild(hourRow(item, staff.slug)));
      section.append(head, note, rows);
      root.appendChild(section);
    });
    const addHour = document.getElementById('add-hour');
    if (addHour) addHour.hidden = true;
    const interval = document.getElementById('setting-interval');
    if (interval) {
      interval.value = '30';
      interval.disabled = true;
      interval.title = 'Il progetto è configurato con slot fissi da 30 minuti.';
    }
  }

  function collectServices() {
    return [...document.querySelectorAll('.service-row')].map((row, index) => ({
      slug: row.querySelector('[data-field="slug"]')?.value || '',
      name: row.querySelector('[data-field="name"]')?.value || '',
      description: '',
      durationMinutes: Number(row.querySelector('[data-field="duration"]')?.value || 30),
      priceCents: row.querySelector('[data-field="price"]')?.value === '' ? null : Math.round(Number(row.querySelector('[data-field="price"]')?.value || 0) * 100),
      bufferBeforeMinutes: Number(row.querySelector('[data-field="before"]')?.value || 0),
      bufferAfterMinutes: Number(row.querySelector('[data-field="after"]')?.value || 0),
      active: !!row.querySelector('[data-field="active"]')?.checked,
      sortOrder: index
    }));
  }

  function collectStaffHours() {
    return state.staff.map((staff) => ({
      staffSlug: staff.slug,
      hours: [...document.querySelectorAll(`.staff-hour-row[data-staff-slug="${staff.slug}"]`)].map((row) => ({
        weekday: Number(row.querySelector('[data-field="weekday"]')?.value),
        opensAt: row.querySelector('[data-field="opens"]')?.value || '',
        closesAt: row.querySelector('[data-field="closes"]')?.value || '',
        active: true
      }))
    }));
  }

  function locationSettings() {
    return {
      minNoticeMinutes: Number(document.getElementById('setting-notice')?.value || 120),
      bookingHorizonDays: Number(document.getElementById('setting-horizon')?.value || 45),
      slotIntervalMinutes: 30,
      publicBookingEnabled: !!document.getElementById('setting-booking-enabled')?.checked,
      reviewUrl: document.getElementById('setting-review-url')?.value || '',
      cancellationStrikeLimit: Number(document.getElementById('setting-strike-limit')?.value || 3),
      depositAmountCents: Math.round(Number(document.getElementById('setting-deposit')?.value || 0) * 100),
      depositPaymentUrl: document.getElementById('setting-deposit-url')?.value || ''
    };
  }

  async function saveEnhancedSettings(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const status = document.getElementById('settings-status');
    if (!state.staff.length) {
      if (status) status.textContent = 'Operatori non caricati. Premi Aggiorna e riprova.';
      return;
    }
    if (status) status.textContent = 'Salvataggio Paolo + Giuseppe…';
    try {
      await adminRequest('/admin/staff', {
        method: 'PUT',
        body: JSON.stringify({ services: collectServices(), location: locationSettings(), staffHours: collectStaffHours() })
      });
      if (status) status.textContent = 'Configurazione salvata per entrambi i barbieri. Slot fissati a 30 minuti.';
      await refreshStaffState();
    } catch (error) {
      if (status) status.textContent = error.message;
    }
  }

  const notificationLabels = {
    'booking.created': 'Nuova prenotazione',
    'booking.status_changed': 'Cambio stato',
    'booking.reassigned': 'Cambio barbiere',
    'booking.rescheduled': 'Appuntamento spostato',
    'booking.reminder': 'Promemoria 30 min',
    'waitlist.created': 'Nuova lista d’attesa',
    'waitlist.slot_available': 'Posto liberato',
    'review.request': 'Richiesta recensione'
  };

  function renderNotifications(data) {
    const list = document.getElementById('notification-list');
    if (!list) return;
    const items = data.notifications || [];
    state.notifications = items;
    const pending = Number(data.pending || items.filter((item) => !item.processed_at).length);
    const reminders = items.filter((item) => item.event_type === 'booking.reminder' && !item.processed_at).length;
    document.getElementById('notification-pending').textContent = String(pending);
    document.getElementById('notification-reminders').textContent = String(reminders);
    document.getElementById('notification-channel').textContent = data.connected ? 'ON' : 'OFF';
    document.getElementById('notification-channel-state').textContent = data.connected ? 'Canale collegato' : 'WhatsApp da collegare';
    list.textContent = '';
    if (!items.length) {
      list.innerHTML = '<p class="agenda-empty">Nessun evento di notifica ancora registrato.</p>';
      return;
    }
    items.slice(0, 40).forEach((item) => {
      const card = document.createElement('article');
      card.className = 'notification-card';
      const payload = item.payload || {};
      const reference = payload.reference || (item.appointment_id ? 'Appuntamento' : 'Sistema');
      const due = item.available_at || item.created_at;
      const status = item.processed_at ? (item.last_error === 'superseded' ? 'superata' : 'processata') : 'in coda';
      card.innerHTML = `
        <div class="notification-card-top">
          <strong>${notificationLabels[item.event_type] || item.event_type}</strong>
          <span class="notification-status">${status}</span>
        </div>
        <p>${reference} · ${formatDateTime(due)}${item.attempts ? ` · tentativi ${item.attempts}` : ''}</p>
      `;
      list.appendChild(card);
    });
  }

  async function refreshNotifications() {
    if (!token() || state.notificationsRefreshing) return;
    state.notificationsRefreshing = true;
    const status = document.getElementById('notification-status');
    try {
      if (status) status.textContent = 'Aggiornamento notifiche…';
      const data = await adminRequest('/admin/notifications');
      renderNotifications(data);
      if (status) status.textContent = data.connected ? 'Canale operativo.' : 'Coda pronta. WhatsApp verrà collegato in seguito.';
    } catch (error) {
      if (status) status.textContent = error.message;
    } finally {
      state.notificationsRefreshing = false;
    }
  }

  async function refreshStaffState() {
    if (!token() || state.refreshing) return;
    state.refreshing = true;
    try {
      const range = dateRange(document.getElementById('agenda-date')?.value);
      const data = await adminRequest(`/admin/staff?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`);
      state.staff = data.staff || [];
      state.hours = data.hours || [];
      state.assignments = data.assignments || [];
      state.blocks = data.blocks || [];
      populateSelectors();
      renderStaffHours();
      decorateAgenda();
      decorateBlocks();
    } catch (error) {
      const agendaStatus = document.getElementById('agenda-status');
      if (agendaStatus && !agendaStatus.textContent) agendaStatus.textContent = error.message;
    } finally {
      state.refreshing = false;
    }
  }

  function interceptFetch() {
    window.fetch = async function(input, init = {}) {
      const rawUrl = typeof input === 'string' ? input : (input?.url || '');
      const method = String(init.method || input?.method || 'GET').toUpperCase();
      const rewritten = rewriteApiUrl(input);

      if (rawUrl.includes('/api/admin/appointments') && method === 'POST' && init.body) {
        const body = safeJson(init.body);
        const select = document.getElementById('new-staff');
        if (select && !body.staffSlug) body.staffSlug = select.value;
        init = { ...init, body: JSON.stringify(body) };
      }

      if (rawUrl.includes('/api/admin/blocks') && method === 'POST' && init.body) {
        const body = safeJson(init.body);
        const chosen = document.getElementById('block-staff')?.value || 'paolo-sgarra';
        if (chosen === 'both') {
          const urls = ['paolo-sgarra', 'giuseppe'].map((staffSlug) => nativeFetch(rewritten, { ...init, body: JSON.stringify({ ...body, staffSlug }) }));
          const responses = await Promise.all(urls);
          const payloads = await Promise.all(responses.map((response) => response.clone().json().catch(() => ({}))));
          const failed = responses.findIndex((response) => !response.ok);
          if (failed >= 0) return new Response(JSON.stringify(payloads[failed]), { status: responses[failed].status, headers: { 'Content-Type': 'application/json' } });
          return new Response(JSON.stringify({ ok: true, blocks: payloads.map((payload) => payload.block) }), { status: 201, headers: { 'Content-Type': 'application/json' } });
        }
        body.staffSlug = chosen;
        init = { ...init, body: JSON.stringify(body) };
      }

      const response = await nativeFetch(rewritten, init);
      if ((rawUrl.includes('/api/admin/appointments') || rawUrl.includes('/api/admin/blocks')) && ['GET', 'POST', 'PATCH', 'DELETE'].includes(method)) {
        setTimeout(refreshStaffState, 120);
        setTimeout(refreshNotifications, 180);
      }
      return response;
    };
  }

  function observeDynamicUi() {
    const agenda = document.getElementById('agenda-list');
    const blocks = document.getElementById('block-list');
    const hours = document.getElementById('settings-hours');
    if (agenda) new MutationObserver(() => setTimeout(decorateAgenda, 0)).observe(agenda, { childList: true });
    if (blocks) new MutationObserver(() => setTimeout(decorateBlocks, 0)).observe(blocks, { childList: true });
    if (hours) new MutationObserver(() => {
      if (state.staff.length && !hours.querySelector('[data-staff-hours]')) setTimeout(renderStaffHours, 0);
    }).observe(hours, { childList: true });
  }

  installStyles();
  installNotificationsView();
  installStaffSelectors();
  installAgendaControls();
  interceptFetch();
  observeDynamicUi();

  const settingsForm = document.getElementById('settings-form');
  if (settingsForm) settingsForm.addEventListener('submit', saveEnhancedSettings, true);
  document.getElementById('agenda-date')?.addEventListener('change', () => setTimeout(refreshStaffState, 120));
  document.getElementById('refresh-all')?.addEventListener('click', () => {
    setTimeout(refreshStaffState, 350);
    setTimeout(refreshNotifications, 450);
  });
  document.querySelector('[data-admin-tab="notifications"]')?.addEventListener('click', () => setTimeout(refreshNotifications, 50));

  setTimeout(() => {
    refreshStaffState();
    refreshNotifications();
  }, 300);
})();
