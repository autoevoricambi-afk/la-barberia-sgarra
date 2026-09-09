(function masterBarberAdmin() {
  'use strict';

  const SESSION_KEY = 'sgarra_admin_session_v1';
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
    filter: 'all',
    refreshing: false,
    notificationsRefreshing: false
  };

  function readSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); }
    catch { return null; }
  }

  function saveSession(session) {
    if (session?.accessToken) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  async function getToken(forceRefresh = false) {
    const current = readSession();
    if (!current?.accessToken) return '';
    if (!forceRefresh && Number(current.expiresAt || 0) > Date.now() + 60_000) return current.accessToken;
    const refreshToken = current.refreshToken || current.accessToken;
    if (!refreshToken) return '';
    const response = await fetch('/api/admin/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ refreshToken })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.session?.accessToken) {
      clearSession();
      return '';
    }
    saveSession(data.session);
    return data.session.accessToken;
  }

  async function adminRequest(path, options = {}) {
    let token = await getToken();
    const send = () => fetch(`/api${path}`, {
      ...options,
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {})
      }
    });
    let response = await send();
    if (response.status === 401 && readSession()) {
      token = await getToken(true);
      if (token) response = await send();
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401) clearSession();
      throw new Error(data?.error?.message || 'Operazione non riuscita.');
    }
    return data;
  }

  function localToday() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  function dateRange(from) {
    const start = /^\d{4}-\d{2}-\d{2}$/.test(from || '') ? from : localToday();
    const end = new Date(`${start}T12:00:00Z`);
    end.setUTCDate(end.getUTCDate() + 6);
    return { from: start, to: end.toISOString().slice(0, 10) };
  }

  function toIso(value) {
    return value ? new Date(value).toISOString() : '';
  }

  function requestKey(prefix) {
    if (window.crypto?.randomUUID) return `${prefix}_${window.crypto.randomUUID()}`;
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 14)}`;
  }

  function staffSource() {
    return state.staff.length ? state.staff : STAFF_FALLBACK;
  }

  function staffLabel(slug) {
    return staffSource().find((item) => item.slug === slug)?.display_name || slug || 'Barbiere';
  }

  function formatDateTime(value) {
    if (!value) return '—';
    return new Intl.DateTimeFormat('it-IT', {
      timeZone: 'Europe/Rome', weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
    }).format(new Date(value));
  }

  function makeButton(label, className, handler) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className || '';
    button.textContent = label;
    button.addEventListener('click', handler);
    return button;
  }

  function installStyles() {
    if (document.getElementById('master-admin-style')) return;
    const style = document.createElement('style');
    style.id = 'master-admin-style';
    style.textContent = `
      .staff-pill{display:inline-flex;align-items:center;gap:.35rem;margin:.45rem .45rem .35rem 0;padding:.28rem .52rem;border:1px solid var(--line-strong);background:rgba(178,138,70,.08);color:var(--brass-soft);font-size:.72rem;font-weight:800;text-transform:uppercase;letter-spacing:.04em}
      .staff-capacity{display:flex;flex-wrap:wrap;align-items:center;gap:.6rem;margin:.55rem 0 .8rem;padding:.75rem .85rem;border:1px solid var(--line);background:rgba(18,21,18,.65)}
      .staff-capacity strong{color:var(--cream)}.staff-capacity span{color:var(--muted);font-size:.8rem;line-height:1.45}
      .staff-filters{display:flex;flex-wrap:wrap;gap:.4rem;margin:.45rem 0 .9rem}
      .staff-filters button{min-height:38px;padding:.4rem .68rem;border:1px solid var(--line-strong);background:#0b0d0c;color:var(--muted)}
      .staff-filters button.is-active{color:var(--brass-soft);border-color:var(--brass);background:rgba(178,138,70,.10)}
      .staff-transfer,.master-action{border-color:rgba(178,138,70,.65)!important;color:var(--brass-soft)!important}
      .master-action.primary{background:var(--brass)!important;color:#0a0a09!important}
      .staff-hours-section{margin:.75rem 0 1rem;padding:.9rem;border:1px solid var(--line);background:rgba(5,7,6,.45)}
      .staff-hours-head{display:flex;align-items:center;justify-content:space-between;gap:.8rem;margin-bottom:.65rem}
      .staff-hours-head h4{margin:0;font:400 1.45rem/1 var(--font-display);color:var(--cream)}
      .staff-hours-note{margin:.3rem 0 .75rem;color:var(--muted);font-size:.8rem;line-height:1.45}
      .notification-head{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;margin-bottom:1rem}
      .channel-state{display:inline-flex;align-items:center;gap:.45rem;padding:.45rem .65rem;border:1px solid var(--line-strong);font-size:.78rem;font-weight:800}
      .notification-summary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.65rem;margin:1rem 0}
      .notification-summary article,.notification-card{padding:.85rem;border:1px solid var(--line);background:rgba(18,21,18,.55)}
      .notification-summary span{display:block;color:var(--muted);font-size:.75rem}.notification-summary strong{display:block;margin-top:.25rem;font-size:1.35rem;color:var(--cream)}
      .notification-list{display:grid;gap:.55rem}.notification-card-top{display:flex;justify-content:space-between;gap:.8rem;align-items:flex-start}.notification-card strong{color:var(--cream)}.notification-card p{margin:.3rem 0 0;color:var(--muted);font-size:.8rem;line-height:1.45}.notification-status{white-space:nowrap;font-size:.7rem;text-transform:uppercase;letter-spacing:.05em;color:var(--brass-soft)}
      @media(max-width:720px){.notification-summary{grid-template-columns:1fr}.notification-head,.staff-hours-head{flex-direction:column}.staff-capacity{align-items:flex-start;flex-direction:column}}
    `;
    document.head.appendChild(style);
  }

  function installTodayButton() {
    if (document.getElementById('agenda-today')) return;
    const row = document.querySelector('.admin-date-row');
    const input = document.getElementById('agenda-date');
    if (!row || !input) return;
    const button = makeButton('Oggi', 'mini-button', () => {
      input.value = localToday();
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    button.id = 'agenda-today';
    row.appendChild(button);
  }

  function installStaffSelectors() {
    const newGrid = document.querySelector('#new-appointment-form .form-grid');
    if (newGrid && !document.getElementById('new-staff')) {
      const label = document.createElement('label');
      label.innerHTML = 'Barbiere<select id="new-staff" required></select>';
      newGrid.appendChild(label);
    }
    const blockGrid = document.querySelector('#block-form .form-grid');
    if (blockGrid && !document.getElementById('block-staff')) {
      const label = document.createElement('label');
      label.innerHTML = 'Agenda da bloccare<select id="block-staff" required></select>';
      blockGrid.insertBefore(label, blockGrid.firstElementChild);
    }
    populateSelectors();
  }

  function populateSelectors() {
    const staff = staffSource();
    const newStaff = document.getElementById('new-staff');
    if (newStaff) {
      const selected = newStaff.value || 'paolo-sgarra';
      newStaff.innerHTML = staff.map((item) => `<option value="${item.slug}">${item.display_name}</option>`).join('');
      if (staff.some((item) => item.slug === selected)) newStaff.value = selected;
    }
    const blockStaff = document.getElementById('block-staff');
    if (blockStaff) {
      const selected = blockStaff.value || 'both';
      blockStaff.innerHTML = '<option value="both">Entrambi</option>' + staff.map((item) => `<option value="${item.slug}">${item.display_name}</option>`).join('');
      blockStaff.value = selected === 'both' || staff.some((item) => item.slug === selected) ? selected : 'both';
    }
  }

  function installAgendaControls() {
    const list = document.getElementById('agenda-list');
    if (!list || document.getElementById('staff-capacity-summary')) return;
    const title = list.closest('div')?.querySelector('.admin-section-title');
    const summary = document.createElement('div');
    summary.id = 'staff-capacity-summary';
    summary.className = 'staff-capacity';
    summary.innerHTML = '<strong>2 postazioni indipendenti</strong><span>Paolo e Giuseppe possono occupare lo stesso orario senza sovrapporsi sulla stessa postazione.</span>';
    if (title) title.insertAdjacentElement('afterend', summary);

    const filters = document.createElement('div');
    filters.className = 'staff-filters';
    filters.innerHTML = '<button type="button" data-staff-filter="all" class="is-active">Tutti</button><button type="button" data-staff-filter="paolo-sgarra">Paolo</button><button type="button" data-staff-filter="giuseppe">Giuseppe</button>';
    summary.insertAdjacentElement('afterend', filters);
    filters.addEventListener('click', (event) => {
      const button = event.target.closest('[data-staff-filter]');
      if (!button) return;
      state.filter = button.dataset.staffFilter;
      filters.querySelectorAll('button').forEach((item) => item.classList.toggle('is-active', item === button));
      applyAgendaFilter();
    });
  }

  function assignmentMap() {
    return new Map(state.assignments.map((item) => [item.reference, item]));
  }

  async function transition(assignment, status, label) {
    if (!assignment?.id || !window.confirm(`${label} questo appuntamento?`)) return;
    const output = document.getElementById('agenda-status');
    if (output) output.textContent = 'Aggiornamento appuntamento…';
    try {
      await adminRequest('/admin/appointments', {
        method: 'PATCH',
        body: JSON.stringify({ appointmentId: assignment.id, status, reason: label })
      });
      if (output) output.textContent = `${label}: operazione completata.`;
      document.getElementById('refresh-all')?.click();
    } catch (error) {
      if (output) output.textContent = error.message;
    }
  }

  async function reassign(assignment, targetSlug) {
    if (!assignment?.id) return;
    const target = staffLabel(targetSlug);
    if (!window.confirm(`Passare ${assignment.reference} a ${target} mantenendo giorno e ora?`)) return;
    const output = document.getElementById('agenda-status');
    try {
      await adminRequest('/admin/staff', {
        method: 'PATCH',
        body: JSON.stringify({ appointmentId: assignment.id, staffSlug: targetSlug, reason: `Riassegnazione a ${target}` })
      });
      if (output) output.textContent = `Appuntamento assegnato a ${target}.`;
      document.getElementById('refresh-all')?.click();
    } catch (error) {
      if (output) output.textContent = error.message;
    }
  }

  function decorateAgenda() {
    const map = assignmentMap();
    const labels = {
      pending: 'Da confermare', confirmed: 'Confermato', arrived: 'Arrivato', in_progress: 'In lavorazione',
      completed: 'Completato', cancelled_by_customer: 'Annullato cliente', cancelled_by_shop: 'Annullato barberia', no_show: 'Non presentato'
    };
    document.querySelectorAll('#agenda-list .appointment-card').forEach((card) => {
      const reference = (card.querySelector('.appointment-ref')?.textContent || '').split(' · ')[0].trim();
      const assignment = map.get(reference);
      if (!assignment) return;
      const slug = assignment.staff?.slug || state.staff.find((item) => item.id === assignment.staff_id)?.slug || '';
      card.dataset.staffSlug = slug;

      let pill = card.querySelector('.staff-pill');
      if (!pill) {
        pill = document.createElement('span');
        pill.className = 'staff-pill';
        card.querySelector('.appointment-services')?.insertAdjacentElement('afterend', pill);
      }
      pill.textContent = staffLabel(slug);
      const badge = card.querySelector('.status-badge');
      if (badge) badge.textContent = labels[assignment.status] || assignment.status;

      let controls = card.querySelector('.appointment-actions');
      if (!controls && ['arrived', 'in_progress', 'completed'].includes(assignment.status)) {
        controls = document.createElement('div');
        controls.className = 'appointment-actions';
        card.appendChild(controls);
      }
      if (!controls) return;
      controls.querySelectorAll('.master-stage-action,.staff-transfer').forEach((item) => item.remove());
      [...controls.querySelectorAll('button')].forEach((button) => {
        if (assignment.status === 'confirmed' && button.textContent.trim() === 'Completa') button.remove();
      });

      if (assignment.status === 'confirmed') {
        controls.insertBefore(makeButton('Arrivato', 'master-action primary master-stage-action', () => transition(assignment, 'arrived', 'Cliente arrivato')), controls.firstChild);
      } else if (assignment.status === 'arrived') {
        controls.textContent = '';
        controls.appendChild(makeButton('Inizia servizio', 'master-action primary master-stage-action', () => transition(assignment, 'in_progress', 'Inizia servizio')));
        controls.appendChild(makeButton('Barberia annulla', 'master-stage-action', () => transition(assignment, 'cancelled_by_shop', 'Barberia annulla')));
      } else if (assignment.status === 'in_progress') {
        controls.textContent = '';
        controls.appendChild(makeButton('Completa', 'master-action primary master-stage-action', () => transition(assignment, 'completed', 'Completa')));
        controls.appendChild(makeButton('Barberia annulla', 'master-stage-action', () => transition(assignment, 'cancelled_by_shop', 'Barberia annulla')));
      } else if (assignment.status === 'completed') {
        controls.textContent = '';
        controls.appendChild(makeButton('Riprendi', 'master-action master-stage-action', () => transition(assignment, 'reopen', 'Riprendi')));
      }

      if (['pending', 'confirmed'].includes(assignment.status) && slug) {
        const target = slug === 'giuseppe' ? 'paolo-sgarra' : 'giuseppe';
        const transfer = makeButton(`Passa a ${staffLabel(target).replace(' Sgarra', '')}`, 'staff-transfer', () => reassign(assignment, target));
        controls.appendChild(transfer);
      }
    });
    applyAgendaFilter();
    updateCapacity();
  }

  function applyAgendaFilter() {
    document.querySelectorAll('#agenda-list .appointment-card').forEach((card) => {
      card.hidden = state.filter !== 'all' && card.dataset.staffSlug !== state.filter;
    });
  }

  function updateCapacity() {
    const summary = document.getElementById('staff-capacity-summary');
    if (!summary) return;
    const counts = { 'paolo-sgarra': 0, giuseppe: 0 };
    state.assignments.filter((item) => ACTIVE_STATUSES.has(item.status)).forEach((item) => {
      const slug = item.staff?.slug || state.staff.find((staff) => staff.id === item.staff_id)?.slug;
      if (slug in counts) counts[slug] += 1;
    });
    summary.innerHTML = `<strong>2 postazioni indipendenti</strong><span>Settimana: Paolo ${counts['paolo-sgarra']} appuntamenti attivi · Giuseppe ${counts.giuseppe}. Ogni prenotazione blocca soltanto il barbiere scelto.</span>`;
  }

  function hourRow(item, staffSlug) {
    const weekdays = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
    const row = document.createElement('div');
    row.className = 'settings-row hour-row staff-hour-row';
    row.dataset.staffSlug = staffSlug;
    row.innerHTML = `
      <label>Giorno<select data-field="weekday">${weekdays.map((name, index) => `<option value="${index}" ${Number(item.weekday) === index ? 'selected' : ''}>${name}</option>`).join('')}</select></label>
      <label>Apre<input data-field="opens" type="time" value="${String(item.opens_at || '08:30').slice(0, 5)}" required /></label>
      <label>Chiude<input data-field="closes" type="time" value="${String(item.closes_at || '13:00').slice(0, 5)}" required /></label>`;
    row.appendChild(makeButton('Rimuovi', 'mini-button danger', () => row.remove()));
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
      const rows = document.createElement('div');
      rows.className = 'settings-list';
      const add = makeButton('Aggiungi fascia', 'mini-button', () => rows.appendChild(hourRow({ weekday: 2, opens_at: '08:30', closes_at: '13:00' }, staff.slug)));
      head.append(title, add);
      const note = document.createElement('p');
      note.className = 'staff-hours-note';
      note.textContent = 'Agenda indipendente: gli orari di questo barbiere non modificano automaticamente quelli dell’altro.';
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

  function bindOwnedForms() {
    const newForm = document.getElementById('new-appointment-form');
    if (newForm && !newForm.dataset.masterBound) {
      newForm.dataset.masterBound = '1';
      newForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        const output = document.getElementById('new-status');
        const serviceIds = [...document.querySelectorAll('input[name="new-service"]:checked')].map((item) => item.value);
        if (!serviceIds.length) { if (output) output.textContent = 'Seleziona almeno un servizio.'; return; }
        if (output) output.textContent = 'Salvataggio…';
        try {
          await adminRequest('/admin/appointments', {
            method: 'POST',
            body: JSON.stringify({
              name: document.getElementById('new-name')?.value || '',
              phone: document.getElementById('new-phone')?.value || '',
              startsAt: toIso(document.getElementById('new-start')?.value || ''),
              source: document.getElementById('new-source')?.value || 'admin',
              notes: document.getElementById('new-notes')?.value || '',
              staffSlug: document.getElementById('new-staff')?.value || 'paolo-sgarra',
              serviceIds,
              idempotencyKey: requestKey('admin')
            })
          });
          newForm.reset();
          populateSelectors();
          if (output) output.textContent = 'Appuntamento salvato e confermato.';
          document.getElementById('refresh-all')?.click();
        } catch (error) { if (output) output.textContent = error.message; }
      }, true);
    }

    const blockForm = document.getElementById('block-form');
    if (blockForm && !blockForm.dataset.masterBound) {
      blockForm.dataset.masterBound = '1';
      blockForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        const output = document.getElementById('block-status');
        const staffChoice = document.getElementById('block-staff')?.value || 'paolo-sgarra';
        const staffSlugs = staffChoice === 'both' ? staffSource().map((item) => item.slug) : [staffChoice];
        if (output) output.textContent = 'Creazione blocco…';
        try {
          const base = {
            startsAt: toIso(document.getElementById('block-start')?.value || ''),
            endsAt: toIso(document.getElementById('block-end')?.value || ''),
            kind: document.getElementById('block-kind')?.value || 'manual',
            reason: document.getElementById('block-reason')?.value || ''
          };
          for (const staffSlug of staffSlugs) {
            await adminRequest('/admin/blocks', { method: 'POST', body: JSON.stringify({ ...base, staffSlug }) });
          }
          blockForm.reset();
          populateSelectors();
          if (output) output.textContent = staffSlugs.length > 1 ? 'Blocco creato su entrambe le agende.' : 'Blocco creato.';
          document.getElementById('refresh-all')?.click();
        } catch (error) { if (output) output.textContent = error.message; }
      }, true);
    }

    const settingsForm = document.getElementById('settings-form');
    if (settingsForm && !settingsForm.dataset.masterBound) {
      settingsForm.dataset.masterBound = '1';
      settingsForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        const output = document.getElementById('settings-status');
        if (!state.staff.length) { if (output) output.textContent = 'Operatori non caricati. Premi Aggiorna e riprova.'; return; }
        if (output) output.textContent = 'Salvataggio configurazione…';
        try {
          await adminRequest('/admin/staff', {
            method: 'PUT',
            body: JSON.stringify({ services: collectServices(), location: locationSettings(), staffHours: collectStaffHours() })
          });
          if (output) output.textContent = 'Configurazione salvata per Paolo e Giuseppe.';
          await refreshStaffState();
        } catch (error) { if (output) output.textContent = error.message; }
      }, true);
    }
  }

  function installNotificationsView() {
    if (document.querySelector('[data-admin-tab="notifications"]')) return;
    const tabs = document.querySelector('.admin-tabs');
    const panel = document.getElementById('agenda-panel');
    if (!tabs || !panel) return;
    const tab = makeButton('Notifiche', '', () => setTimeout(refreshNotifications, 30));
    tab.dataset.adminTab = 'notifications';
    tabs.appendChild(tab);
    const section = document.createElement('section');
    section.className = 'admin-view';
    section.dataset.adminView = 'notifications';
    section.hidden = true;
    section.innerHTML = `
      <div class="admin-card">
        <div class="notification-head"><div><p class="eyebrow">Automazioni</p><h2>Centro notifiche</h2></div><span class="channel-state" id="notification-channel-state">Canale non collegato</span></div>
        <p class="admin-help">Qui vedi gli eventi registrati dal sistema. Finché non viene configurato un canale di invio, restano in coda e non vengono dichiarati come consegnati.</p>
        <div class="notification-summary"><article><span>In coda</span><strong id="notification-pending">0</strong></article><article><span>Canale</span><strong id="notification-channel">OFF</strong></article></div>
        <p class="admin-status" id="notification-status" role="status" aria-live="polite"></p>
        <div class="notification-list" id="notification-list"></div>
      </div>`;
    panel.appendChild(section);

    tab.addEventListener('click', () => {
      document.querySelectorAll('[data-admin-tab]').forEach((item) => item.classList.toggle('is-active', item === tab));
      document.querySelectorAll('[data-admin-view]').forEach((view) => {
        const active = view.dataset.adminView === 'notifications';
        view.hidden = !active;
        view.classList.toggle('is-active', active);
      });
    });
  }

  async function refreshNotifications() {
    if (!readSession()?.accessToken || state.notificationsRefreshing) return;
    state.notificationsRefreshing = true;
    const output = document.getElementById('notification-status');
    try {
      if (output) output.textContent = 'Aggiornamento notifiche…';
      const data = await adminRequest('/admin/notifications');
      document.getElementById('notification-pending').textContent = String(data.pending || 0);
      document.getElementById('notification-channel').textContent = data.connected ? 'ON' : 'OFF';
      document.getElementById('notification-channel-state').textContent = data.connected ? 'Canale collegato' : 'Canale non collegato';
      const list = document.getElementById('notification-list');
      list.textContent = '';
      const labels = {
        'booking.created': 'Nuova prenotazione', 'booking.status_changed': 'Cambio stato', 'booking.reassigned': 'Cambio barbiere',
        'booking.rescheduled': 'Appuntamento spostato', 'booking.reopened': 'Appuntamento ripreso',
        'booking.reminder_day_before': 'Promemoria giorno prima', 'booking.reminder_same_day': 'Promemoria del giorno',
        'waitlist.created': 'Nuova lista d’attesa', 'waitlist.slot_available': 'Posto liberato', 'review.request': 'Richiesta recensione',
        'deposit.status_changed': 'Aggiornamento caparra', 'inventory.low_stock': 'Scorta bassa'
      };
      (data.notifications || []).slice(0, 50).forEach((item) => {
        const card = document.createElement('article');
        card.className = 'notification-card';
        const status = item.processed_at ? (item.last_error ? 'gestita' : 'processata') : 'in coda';
        card.innerHTML = `<div class="notification-card-top"><strong>${labels[item.event_type] || item.event_type}</strong><span class="notification-status">${status}</span></div><p>${formatDateTime(item.available_at || item.created_at)}${item.attempts ? ` · tentativi ${item.attempts}` : ''}</p>`;
        list.appendChild(card);
      });
      if (!list.childElementCount) list.innerHTML = '<p class="agenda-empty">Nessun evento registrato.</p>';
      if (output) output.textContent = data.connected ? 'Canale operativo.' : 'Coda operativa; invio esterno non ancora collegato.';
    } catch (error) { if (output) output.textContent = error.message; }
    finally { state.notificationsRefreshing = false; }
  }

  async function refreshStaffState() {
    if (!readSession()?.accessToken || state.refreshing) return;
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
    } catch (error) {
      const output = document.getElementById('agenda-status');
      if (output && !output.textContent) output.textContent = error.message;
    } finally { state.refreshing = false; }
  }

  function observeUi() {
    const agenda = document.getElementById('agenda-list');
    if (agenda) new MutationObserver(() => setTimeout(decorateAgenda, 0)).observe(agenda, { childList: true });
    const hours = document.getElementById('settings-hours');
    if (hours) new MutationObserver(() => {
      if (state.staff.length && !hours.querySelector('[data-staff-hours]')) setTimeout(renderStaffHours, 0);
    }).observe(hours, { childList: true });
  }

  installStyles();
  installTodayButton();
  installStaffSelectors();
  installAgendaControls();
  installNotificationsView();
  bindOwnedForms();
  observeUi();

  document.getElementById('agenda-date')?.addEventListener('change', () => setTimeout(refreshStaffState, 120));
  document.getElementById('refresh-all')?.addEventListener('click', () => {
    setTimeout(refreshStaffState, 250);
    setTimeout(refreshNotifications, 350);
  });
  setTimeout(() => {
    installStaffSelectors();
    bindOwnedForms();
    refreshStaffState();
    refreshNotifications();
  }, 350);
})();
