(function finalOperationalFlow() {
  'use strict';

  const EDGE_BASE = 'https://aiiwlytquapjjahulbbd.supabase.co/functions/v1/sgarra-api';
  const SESSION_KEY = 'sgarra_admin_session_v1';
  let decorating = false;

  function token() {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null')?.accessToken || '';
    } catch {
      return '';
    }
  }

  function localToday() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  function rangeFrom(value) {
    const from = /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? value : localToday();
    const end = new Date(`${from}T12:00:00Z`);
    end.setUTCDate(end.getUTCDate() + 6);
    return { from, to: end.toISOString().slice(0, 10) };
  }

  async function request(path, options = {}) {
    const response = await fetch(`${EDGE_BASE}${path}`, {
      ...options,
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
        ...(options.headers || {})
      }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error?.message || 'Operazione non riuscita.');
    return data;
  }

  function installTodayButton() {
    if (document.getElementById('agenda-today')) return;
    const row = document.querySelector('.admin-date-row');
    const input = document.getElementById('agenda-date');
    if (!row || !input) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'agenda-today';
    button.className = 'mini-button';
    button.textContent = 'Oggi';
    button.title = 'Porta l’agenda alla settimana che parte da oggi';
    button.addEventListener('click', () => {
      input.value = localToday();
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    row.appendChild(button);
  }

  function referenceFromCard(card) {
    return (card.querySelector('.appointment-ref')?.textContent || '').split(' · ')[0].trim();
  }

  async function loadAssignments() {
    const input = document.getElementById('agenda-date');
    const range = rangeFrom(input?.value);
    const data = await request(`/admin/staff?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`);
    return new Map((data.assignments || []).map((item) => [item.reference, item]));
  }

  async function reopen(assignment, button) {
    if (!assignment?.id) return;
    const ok = window.confirm('Riprendere questo appuntamento? Tornerà CONFERMATO e rioccuperà lo stesso slot solo se è ancora libero.');
    if (!ok) return;
    const status = document.getElementById('agenda-status');
    button.disabled = true;
    if (status) status.textContent = 'Ripristino appuntamento in corso…';
    try {
      await request('/admin/appointments', {
        method: 'PATCH',
        body: JSON.stringify({
          appointmentId: assignment.id,
          status: 'reopen',
          reason: 'Completamento annullato dal gestionale'
        })
      });
      if (status) status.textContent = 'Appuntamento ripreso: è tornato confermato. Evento notifica registrato.';
      document.getElementById('refresh-all')?.click();
    } catch (error) {
      if (status) status.textContent = error.message;
      button.disabled = false;
    }
  }

  async function decorateCompleted() {
    if (decorating || !token()) return;
    const cards = [...document.querySelectorAll('#agenda-list .appointment-card')];
    if (!cards.length) return;
    const completed = cards.filter((card) => card.querySelector('.status-completed') || card.querySelector('.status-badge')?.textContent?.trim().toLowerCase() === 'completato');
    if (!completed.length) return;
    decorating = true;
    try {
      const assignments = await loadAssignments();
      completed.forEach((card) => {
        if (card.querySelector('[data-reopen-appointment]')) return;
        const assignment = assignments.get(referenceFromCard(card));
        if (!assignment || assignment.status !== 'completed') return;
        let controls = card.querySelector('.appointment-actions');
        if (!controls) {
          controls = document.createElement('div');
          controls.className = 'appointment-actions';
          card.appendChild(controls);
        }
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.reopenAppointment = 'true';
        button.className = 'master-action';
        button.textContent = 'Riprendi';
        button.title = 'Annulla un completamento premuto per errore e riporta l’appuntamento a Confermato.';
        button.addEventListener('click', () => reopen(assignment, button));
        controls.appendChild(button);
      });
    } catch (error) {
      const status = document.getElementById('agenda-status');
      if (status && !status.textContent) status.textContent = error.message;
    } finally {
      decorating = false;
    }
  }

  function installHelp() {
    if (document.getElementById('flow-help')) return;
    const summary = document.getElementById('staff-capacity-summary');
    if (!summary) return;
    const note = document.createElement('p');
    note.id = 'flow-help';
    note.className = 'staff-capacity-note';
    note.textContent = 'Flusso operativo: Da confermare → Confermato → Arrivato → In lavorazione → Completato. Se “Completato” viene premuto per errore, usa Riprendi.';
    summary.insertAdjacentElement('afterend', note);
  }

  const observer = new MutationObserver(() => {
    installTodayButton();
    installHelp();
    window.setTimeout(decorateCompleted, 60);
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
  document.getElementById('refresh-all')?.addEventListener('click', () => window.setTimeout(decorateCompleted, 500));
  document.getElementById('agenda-date')?.addEventListener('change', () => window.setTimeout(decorateCompleted, 500));
  window.setTimeout(() => {
    installTodayButton();
    installHelp();
    decorateCompleted();
  }, 700);
})();
