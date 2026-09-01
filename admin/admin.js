const TOKEN_KEY = 'sgarra_admin_access_token';
const loginPanel = document.getElementById('login-panel');
const agendaPanel = document.getElementById('agenda-panel');
const loginStatus = document.getElementById('login-status');
const agendaStatus = document.getElementById('agenda-status');
const logoutButton = document.getElementById('logout');
const agendaDate = document.getElementById('agenda-date');

function todayISO() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function accessTokenFromHash() {
  const params = new URLSearchParams(location.hash.replace(/^#/, ''));
  return params.get('access_token') || '';
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
  pending: [['confirmed', 'Conferma', 'primary'], ['cancelled_by_shop', 'Annulla', '']],
  confirmed: [['completed', 'Completa', 'primary'], ['no_show', 'Non presentato', ''], ['cancelled_by_shop', 'Annulla', '']]
};

function appointmentCard(item) {
  const article = document.createElement('article');
  article.className = 'appointment-card';
  const customer = item.customers || {};
  const services = (item.appointment_items || []).map((entry) => entry.service_name_snapshot).filter(Boolean).join(' · ');

  const top = document.createElement('div');
  top.className = 'appointment-top';
  const heading = document.createElement('div');
  heading.innerHTML = `<span class="appointment-time"></span><h2></h2><span class="appointment-ref"></span>`;
  heading.querySelector('.appointment-time').textContent = formatDateTime(item.starts_at);
  heading.querySelector('h2').textContent = customer.name || 'Cliente';
  heading.querySelector('.appointment-ref').textContent = item.reference || '';
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
    const phone = document.createElement('a');
    phone.className = 'appointment-phone';
    phone.href = `tel:${customer.phone_normalized}`;
    phone.textContent = customer.phone_normalized;
    article.appendChild(phone);
  }
  if (item.notes) {
    const notes = document.createElement('p');
    notes.className = 'appointment-notes';
    notes.textContent = item.notes;
    article.appendChild(notes);
  }

  const allowedActions = actions[item.status] || [];
  if (allowedActions.length) {
    const controls = document.createElement('div');
    controls.className = 'appointment-actions';
    allowedActions.forEach(([status, label, className]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = className;
      button.textContent = label;
      button.addEventListener('click', () => transition(item.id, status, label));
      controls.appendChild(button);
    });
    article.appendChild(controls);
  }
  return article;
}

function renderAgenda(items) {
  const list = document.getElementById('agenda-list');
  list.textContent = '';
  document.getElementById('kpi-pending').textContent = String(items.filter((item) => item.status === 'pending').length);
  document.getElementById('kpi-confirmed').textContent = String(items.filter((item) => item.status === 'confirmed').length);
  document.getElementById('kpi-completed').textContent = String(items.filter((item) => item.status === 'completed').length);
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
  try {
    const data = await api(`/api/admin/appointments?from=${range.from}&to=${range.to}`);
    renderAgenda(data.appointments || []);
    agendaStatus.textContent = `${(data.appointments || []).length} appuntamenti caricati.`;
  } catch (error) {
    if (error.status === 401) {
      sessionStorage.removeItem(TOKEN_KEY);
      setAuthenticated(false);
    }
    agendaStatus.textContent = error.message;
  }
}

async function transition(appointmentId, status, label) {
  if (!confirm(`${label} questo appuntamento?`)) return;
  agendaStatus.textContent = 'Aggiornamento…';
  try {
    await api('/api/admin/appointments', {
      method: 'PATCH', body: JSON.stringify({ appointmentId, status })
    });
    await loadAgenda();
  } catch (error) {
    agendaStatus.textContent = error.message;
  }
}

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

document.getElementById('refresh-agenda').addEventListener('click', loadAgenda);
agendaDate.addEventListener('change', loadAgenda);
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
if (getToken()) loadAgenda();
