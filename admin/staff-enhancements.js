(function staffAwareAdmin() {
  'use strict';

  const SESSION_KEY = 'sgarra_admin_session_v1';
  const originalFetch = window.fetch.bind(window);
  const state = { staff: [], hours: [], assignments: [], blocks: [], filter: 'all', refreshing: false };

  function token() {
    try {
      const session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
      return session && session.accessToken ? session.accessToken : '';
    } catch { return ''; }
  }

  function dateRange(from) {
    const start = /^\d{4}-\d{2}-\d{2}$/.test(from || '') ? from : new Date().toISOString().slice(0, 10);
    const end = new Date(`${start}T12:00:00Z`);
    end.setUTCDate(end.getUTCDate() + 6);
    return { from: start, to: end.toISOString().slice(0, 10) };
  }

  function staffLabel(slug) {
    const match = state.staff.find((item) => item.slug === slug);
    return match ? match.display_name : (slug === 'paolo-sgarra' ? 'Paolo Sgarra' : slug === 'giuseppe' ? 'Giuseppe' : slug);
  }

  function safeJson(text) {
    try { return JSON.parse(text || '{}'); } catch { return {}; }
  }

  async function adminRequest(path, options = {}) {
    const response = await originalFetch(path, {
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        Accept: 'application/json',
        ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
        ...(options.headers || {})
      }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error?.message || 'Operazione non riuscita.');
    return data;
  }

  function installStyles() {
    if (document.getElementById('staff-enhancement-style')) return;
    const style = document.createElement('style');
    style.id = 'staff-enhancement-style';
    style.textContent = `
      .staff-pill{display:inline-flex;align-items:center;gap:.35rem;margin:.45rem .45rem 0 0;padding:.28rem .5rem;border:1px solid var(--line-strong);background:rgba(178,138,70,.08);color:var(--brass-soft);font-size:.72rem;font-weight:800;text-transform:uppercase;letter-spacing:.04em}
      .staff-pill::before{content:'';width:.45rem;height:.45rem;border-radius:50%;background:currentColor;box-shadow:0 0 0 3px rgba(178,138,70,.10)}
      .staff-capacity{display:flex;flex-wrap:wrap;align-items:center;gap:.55rem;margin:.55rem 0 1rem;padding:.7rem .8rem;border:1px solid var(--line);background:rgba(18,21,18,.65)}
      .staff-capacity strong{color:var(--cream)} .staff-capacity span{color:var(--muted);font-size:.8rem}
      .staff-filters{display:flex;flex-wrap:wrap;gap:.4rem;margin:.5rem 0 .8rem}
      .staff-filters button{min-height:38px;padding:.4rem .65rem;border:1px solid var(--line-strong);background:#0b0d0c;color:var(--muted)}
      .staff-filters button.is-active{color:var(--brass-soft);border-color:var(--brass);background:rgba(178,138,70,.10)}
      .staff-transfer{border-color:rgba(178,138,70,.6)!important;color:var(--brass-soft)!important}
      .staff-hours-section{margin:.75rem 0 1rem;padding:.9rem;border:1px solid var(--line);background:rgba(5,7,6,.45)}
      .staff-hours-head{display:flex;align-items:center;justify-content:space-between;gap:.8rem;margin-bottom:.65rem}
      .staff-hours-head h4{margin:0;font:400 1.45rem/1 var(--font-display);color:var(--cream)}
      .staff-hours-note{margin:.25rem 0 .75rem;color:var(--muted);font-size:.8rem}
      .staff-capacity-note{margin:.35rem 0 0;color:var(--brass-soft);font-size:.8rem}
      .staff-assignment-note{margin-top:.45rem;color:var(--muted);font-size:.78rem}
      @media(max-width:520px){.staff-hours-head{align-items:flex-start;flex-direction:column}.staff-capacity{align-items:flex-start;flex-direction:column}}
    `;
    document.head.appendChild(style);
  }

  function injectStaffSelectors() {
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
    const options = state.staff.length ? state.staff : [
      { slug: 'paolo-sgarra', display_name: 'Paolo Sgarra' },
      { slug: 'giuseppe', display_name: 'Giuseppe' }
    ];
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
      blockStaff.value = selected;
    }
  }

  function installAgendaControls() {
    const agendaList = document.getElementById('agenda-list');
    if (!agendaList || document.getElementById('staff-capacity-summary')) return;
    const title = agendaList.closest('div')?.querySelector('.admin-section-title');
    const summary = document.createElement('div');
    summary.id = 'staff-capacity-summary';
    summary.className = 'staff-capacity';
    summary.innerHTML = '<strong>2 postazioni attive</strong><span>Ogni orario da 30 minuti può ospitare 2 prenotazioni: 1 Paolo + 1 Giuseppe.</span>';
    if (title) title.insertAdjacentElement('afterend', summary);

    const filters = document.createElement('div');
    filters.id = 'staff-filters';
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

  function decorateAgenda() {
    const map = assignmentMap();
    document.querySelectorAll('#agenda-list .appointment-card').forEach((card) => {
      const refText = card.querySelector('.appointment-ref')?.textContent || '';
      const reference = refText.split(' · ')[0].trim();
      const assignment = map.get(reference);
      if (!assignment) return;
      const slug = assignment.staff?.slug || state.staff.find((item) => item.id === assignment.staff_id)?.slug || '';
      const name = assignment.staff?.display_name || staffLabel(slug);
      card.dataset.staffSlug = slug;
      let pill = card.querySelector('.staff-pill');
      if (!pill) {
        pill = document.createElement('span');
        pill.className = 'staff-pill';
        card.querySelector('.appointment-services')?.insertAdjacentElement('afterend', pill);
      }
      pill.textContent = name;

      card.querySelectorAll('.appointment-actions button').forEach((button) => {
        if (button.textContent.trim() === 'Annulla cliente') {
          button.textContent = 'Cliente annulla';
          button.title = 'Libera subito lo slot. Se la cancellazione è tardiva, il gestionale può registrare una segnalazione sul cliente.';
        }
        if (button.textContent.trim() === 'Annulla barberia') {
          button.textContent = 'Barberia annulla';
          button.title = 'Libera subito lo slot senza penalizzare il cliente.';
        }
      });

      if (['pending', 'confirmed'].includes(assignment.status) && !card.querySelector('.staff-transfer')) {
        const target = slug === 'giuseppe' ? 'paolo-sgarra' : 'giuseppe';
        const targetName = staffLabel(target);
        const controls = card.querySelector('.appointment-actions');
        if (controls) {
          const transfer = document.createElement('button');
          transfer.type = 'button';
          transfer.className = 'staff-transfer';
          transfer.textContent = `Passa a ${targetName.replace(' Sgarra', '')}`;
          transfer.title = `Mantiene giorno e orario e assegna il cliente a ${targetName}, solo se quella postazione è libera.`;
          transfer.addEventListener('click', () => reassign(assignment, target));
          controls.insertBefore(transfer, controls.querySelector('button:last-child'));
        }
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
    state.assignments.filter((item) => ['pending', 'confirmed'].includes(item.status)).forEach((item) => {
      const slug = item.staff?.slug || state.staff.find((staff) => staff.id === item.staff_id)?.slug;
      if (slug in counts) counts[slug] += 1;
    });
    summary.innerHTML = `<strong>2 postazioni · slot ogni 30 min</strong><span>Settimana: Paolo ${counts['paolo-sgarra']} attivi · Giuseppe ${counts.giuseppe} attivi. Una prenotazione occupa solo il barbiere scelto, non l’altro.</span>`;
  }

  async function reassign(assignment, targetSlug) {
    const agendaStatus = document.getElementById('agenda-status');
    const targetName = staffLabel(targetSlug);
    if (!confirm(`Passare ${assignment.reference} a ${targetName} mantenendo esattamente lo stesso orario?`)) return;
    if (agendaStatus) agendaStatus.textContent = `Verifico la disponibilità di ${targetName}…`;
    try {
      await adminRequest('/api/admin/staff', {
        method: 'PATCH',
        body: JSON.stringify({ appointmentId: assignment.id, staffSlug: targetSlug, reason: `Riassegnazione rapida dal gestionale a ${targetName}` })
      });
      if (agendaStatus) agendaStatus.textContent = `Appuntamento passato a ${targetName}. L’altro slot è stato liberato.`;
      document.getElementById('refresh-all')?.click();
      setTimeout(refreshStaffState, 500);
    } catch (error) {
      if (agendaStatus) agendaStatus.textContent = `${targetName}: ${error.message} L’appuntamento è rimasto invariato.`;
    }
  }

  function decorateBlocks() {
    const byId = new Map(state.blocks.map((item) => [item.id, item]));
    const cards = [...document.querySelectorAll('#block-list .block-card')];
    cards.forEach((card, index) => {
      const block = state.blocks[index] || byId.get(card.dataset.blockId);
      if (!block || card.querySelector('.staff-pill')) return;
      const slug = block.staff?.slug || state.staff.find((item) => item.id === block.staff_id)?.slug || '';
      const pill = document.createElement('span');
      pill.className = 'staff-pill';
      pill.textContent = staffLabel(slug);
      card.appendChild(pill);
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
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'mini-button danger';
    remove.textContent = 'Rimuovi';
    remove.addEventListener('click', () => row.remove());
    row.appendChild(remove);
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
      const add = document.createElement('button');
      add.type = 'button';
      add.className = 'mini-button';
      add.textContent = 'Aggiungi fascia';
      const rows = document.createElement('div');
      rows.className = 'settings-list staff-hours-rows';
      add.addEventListener('click', () => rows.appendChild(hourRow({ weekday: 2, opens_at: '08:30', closes_at: '13:00' }, staff.slug)));
      head.append(title, add);
      const note = document.createElement('p');
      note.className = 'staff-hours-note';
      note.textContent = 'Questa agenda è indipendente: un cliente qui non chiude lo stesso orario dell’altro barbiere.';
      state.hours.filter((item) => item.staff_id === staff.id).forEach((item) => rows.appendChild(hourRow(item, staff.slug)));
      section.append(head, note, rows);
      root.appendChild(section);
    });
    const addHour = document.getElementById('add-hour');
    if (addHour) addHour.hidden = true;
    const heading = root.previousElementSibling;
    if (heading && !heading.querySelector('.staff-capacity-note')) {
      const note = document.createElement('p');
      note.className = 'staff-capacity-note';
      note.textContent = 'Intervallo consigliato e attuale: 30 minuti. Con Paolo + Giuseppe la capacità è 2 clienti nello stesso orario, uno per postazione.';
      heading.appendChild(note);
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
      slotIntervalMinutes: Number(document.getElementById('setting-interval')?.value || 30),
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
    if (status) status.textContent = 'Salvataggio orari di Paolo e Giuseppe…';
    try {
      const location = locationSettings();
      if (location.slotIntervalMinutes !== 30) {
        const proceed = confirm(`L’intervallo è impostato a ${location.slotIntervalMinutes} minuti. Per il flusso concordato consigliamo 30 minuti. Vuoi salvare comunque?`);
        if (!proceed) return;
      }
      await adminRequest('/api/admin/staff', {
        method: 'PUT',
        body: JSON.stringify({ services: collectServices(), location, staffHours: collectStaffHours() })
      });
      if (status) status.textContent = 'Configurazione salvata per entrambi i barbieri.';
      await refreshStaffState();
    } catch (error) {
      if (status) status.textContent = error.message;
    }
  }

  async function refreshStaffState() {
    if (!token() || state.refreshing) return;
    state.refreshing = true;
    try {
      const range = dateRange(document.getElementById('agenda-date')?.value);
      const data = await adminRequest(`/api/admin/staff?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`);
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
      const url = typeof input === 'string' ? input : (input && input.url) || '';
      const method = String(init.method || (input && input.method) || 'GET').toUpperCase();

      if (url.includes('/api/admin/appointments') && method === 'POST' && init.body) {
        const body = safeJson(init.body);
        const select = document.getElementById('new-staff');
        if (select && !body.staffSlug) body.staffSlug = select.value;
        init = { ...init, body: JSON.stringify(body) };
      }

      if (url.includes('/api/admin/blocks') && method === 'POST' && init.body) {
        const body = safeJson(init.body);
        const select = document.getElementById('block-staff');
        const chosen = select?.value || 'paolo-sgarra';
        if (chosen === 'both') {
          const requests = ['paolo-sgarra', 'giuseppe'].map((staffSlug) => originalFetch(input, { ...init, body: JSON.stringify({ ...body, staffSlug }) }));
          const responses = await Promise.all(requests);
          const payloads = await Promise.all(responses.map((response) => response.clone().json().catch(() => ({}))));
          const failedIndex = responses.findIndex((response) => !response.ok);
          if (failedIndex >= 0) {
            return new Response(JSON.stringify(payloads[failedIndex]), { status: responses[failedIndex].status, headers: { 'Content-Type': 'application/json' } });
          }
          return new Response(JSON.stringify({ ok: true, blocks: payloads.map((item) => item.block) }), { status: 201, headers: { 'Content-Type': 'application/json' } });
        }
        body.staffSlug = chosen;
        init = { ...init, body: JSON.stringify(body) };
      }

      const response = await originalFetch(input, init);
      if ((url.includes('/api/admin/appointments') || url.includes('/api/admin/blocks')) && method === 'GET') {
        setTimeout(refreshStaffState, 60);
      }
      return response;
    };
  }

  function observeAgenda() {
    const agenda = document.getElementById('agenda-list');
    const blocks = document.getElementById('block-list');
    if (agenda) new MutationObserver(() => setTimeout(decorateAgenda, 0)).observe(agenda, { childList: true });
    if (blocks) new MutationObserver(() => setTimeout(decorateBlocks, 0)).observe(blocks, { childList: true });
  }

  installStyles();
  injectStaffSelectors();
  installAgendaControls();
  interceptFetch();
  observeAgenda();

  const settingsForm = document.getElementById('settings-form');
  if (settingsForm) settingsForm.addEventListener('submit', saveEnhancedSettings, true);
  document.getElementById('agenda-date')?.addEventListener('change', () => setTimeout(refreshStaffState, 120));
  document.getElementById('refresh-all')?.addEventListener('click', () => setTimeout(refreshStaffState, 350));

  setTimeout(refreshStaffState, 250);
})();
