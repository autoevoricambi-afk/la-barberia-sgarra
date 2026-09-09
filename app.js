'use strict';

(function () {
  const STAFF = [
    { slug: 'paolo-sgarra', label: 'Paolo Sgarra' },
    { slug: 'giuseppe', label: 'Giuseppe' }
  ];
  const API_BASE = '/api';
  const PRIVACY_VERSION = '2026-09-01';
  const availabilityByStart = new Map();
  let bookingEnabled = true;
  let bookingHorizonDays = 45;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  init();

  function init() {
    setYear();
    initNav();
    initAnchors();
    initLightbox();
    initServices();
    initBooking();
    syncBookingConfig();
  }

  function setYear() {
    const node = $('#year');
    if (node) node.textContent = String(new Date().getFullYear());
  }

  function initNav() {
    const toggle = $('#menu-toggle');
    const nav = $('#main-nav');
    if (!toggle || !nav) return;

    const close = () => {
      nav.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Apri il menu');
    };

    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Chiudi il menu' : 'Apri il menu');
    });
    nav.addEventListener('click', (event) => {
      if (event.target.closest('a')) close();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') close();
    });
  }

  function initAnchors() {
    document.addEventListener('click', (event) => {
      const link = event.target.closest('a[href^="#"]');
      if (!link) return;
      const target = document.querySelector(link.getAttribute('href'));
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function initLightbox() {
    const dialog = $('#lightbox');
    const image = $('#lightbox-image');
    const caption = $('#lightbox-caption');
    if (!dialog || !image) return;

    $$('.gallery-button').forEach((button) => {
      button.addEventListener('click', () => {
        image.src = button.dataset.full || button.querySelector('img')?.src || '';
        image.alt = button.querySelector('img')?.alt || '';
        if (caption) caption.textContent = button.dataset.caption || '';
        dialog.hidden = false;
        document.body.classList.add('lightbox-open');
      });
    });

    $$('[data-lightbox-close]', dialog).forEach((button) => {
      button.addEventListener('click', () => closeLightbox(dialog, image));
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !dialog.hidden) closeLightbox(dialog, image);
    });
  }

  function closeLightbox(dialog, image) {
    dialog.hidden = true;
    image.removeAttribute('src');
    document.body.classList.remove('lightbox-open');
  }

  function initServices() {
    $$('input[name="service"]').forEach((input) => {
      input.addEventListener('change', () => {
        updateSelectedServices();
        if ($('#booking-date')?.value) loadAvailability();
      });
    });
    updateSelectedServices();
  }

  function selectedServiceIds() {
    return $$('input[name="service"]:checked')
      .map((input) => input.dataset.serviceId || '')
      .filter(Boolean)
      .slice(0, 4);
  }

  function selectedServiceLabels() {
    return $$('input[name="service"]:checked')
      .map((input) => input.dataset.serviceLabel || input.value || '')
      .filter(Boolean)
      .slice(0, 4);
  }

  function updateSelectedServices() {
    const box = $('#selected-services');
    const labels = selectedServiceLabels();
    if (!box) return;
    if (!labels.length) {
      box.innerHTML = '<span class="empty-selection">Seleziona uno o più servizi qui sopra.</span>';
      return;
    }
    box.innerHTML = labels.map((label) => `<span class="chip">${escapeHtml(label)}</span>`).join('');
  }

  function initBooking() {
    const form = $('#booking-form');
    const date = $('#booking-date');
    const staff = $('#booking-staff');
    const time = $('#booking-time');
    if (!form || !date || !staff || !time) return;

    syncDateLimits();
    date.addEventListener('change', loadAvailability);
    staff.addEventListener('change', loadAvailability);
    form.addEventListener('submit', submitBooking);
  }

  function syncDateLimits() {
    const date = $('#booking-date');
    if (!date) return;
    const today = new Date();
    const max = new Date(today.getTime());
    max.setDate(max.getDate() + bookingHorizonDays);
    date.min = formatLocalDate(today);
    date.max = formatLocalDate(max);
  }

  function formatLocalDate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  async function syncBookingConfig() {
    const status = $('#booking-system-status');
    try {
      const response = await fetch(`${API_BASE}/public-config`, { headers: { Accept: 'application/json' } });
      const payload = await response.json().catch(() => ({}));
      bookingEnabled = response.ok && payload.configured === true && payload.bookingEnabled === true;
      bookingHorizonDays = Number(payload.bookingHorizonDays || 45);
      syncDateLimits();
      if (status) {
        status.textContent = bookingEnabled
          ? 'Prenotazione live attiva · 2 postazioni · slot ogni 30 minuti.'
          : 'Prenotazione temporaneamente non disponibile.';
        status.dataset.state = bookingEnabled ? 'ok' : 'error';
      }
    } catch {
      bookingEnabled = false;
      if (status) {
        status.textContent = 'Prenotazione temporaneamente non disponibile.';
        status.dataset.state = 'error';
      }
    }
  }

  async function loadAvailability() {
    const date = $('#booking-date');
    const staff = $('#booking-staff');
    const time = $('#booking-time');
    const hint = $('#time-hint');
    const waitlist = $('#waitlist-box');
    if (!date || !staff || !time) return;

    availabilityByStart.clear();
    time.innerHTML = '<option value="">Caricamento disponibilità…</option>';
    time.disabled = true;
    if (waitlist) waitlist.hidden = true;

    const serviceIds = selectedServiceIds();
    if (!serviceIds.length) {
      time.innerHTML = '<option value="">Seleziona prima almeno un servizio</option>';
      if (hint) hint.textContent = 'La disponibilità dipende dai servizi selezionati.';
      return;
    }
    if (!date.value) {
      time.innerHTML = '<option value="">Scegli prima il giorno</option>';
      return;
    }
    if (!bookingEnabled) {
      time.innerHTML = '<option value="">Booking non disponibile</option>';
      return;
    }

    try {
      const slots = staff.value === 'any'
        ? await loadMergedAvailability(date.value, serviceIds)
        : await loadSingleAvailability(date.value, serviceIds, staff.value);

      if (!slots.length) {
        time.innerHTML = '<option value="">Nessun posto disponibile</option>';
        if (hint) hint.textContent = 'Non risultano posti liberi per questa combinazione.';
        if (waitlist) waitlist.hidden = false;
        return;
      }

      time.innerHTML = '<option value="">Scegli un orario</option>' + slots.map((slot) =>
        `<option value="${escapeHtml(slot.startsAt)}">${escapeHtml(slot.label)}</option>`
      ).join('');
      time.disabled = false;
      if (hint) hint.textContent = 'Disponibilità reale aggiornata adesso.';
    } catch (error) {
      time.innerHTML = '<option value="">Disponibilità non raggiungibile</option>';
      if (hint) hint.textContent = error.message || 'Riprova tra poco.';
    }
  }

  async function loadSingleAvailability(date, serviceIds, staffSlug) {
    const data = await fetchAvailability(date, serviceIds, staffSlug);
    return data.slots.map((slot) => {
      const startsAt = slot.starts_at || slot.startsAt || '';
      if (startsAt) availabilityByStart.set(startsAt, [staffSlug]);
      return {
        startsAt,
        label: `${slotTime(slot, startsAt)} · 1 posto libero`
      };
    }).filter((slot) => slot.startsAt);
  }

  async function loadMergedAvailability(date, serviceIds) {
    const results = await Promise.all(STAFF.map(async (staff) => ({
      staffSlug: staff.slug,
      data: await fetchAvailability(date, serviceIds, staff.slug)
    })));

    const merged = new Map();
    results.forEach(({ staffSlug, data }) => {
      data.slots.forEach((slot) => {
        const startsAt = slot.starts_at || slot.startsAt || '';
        if (!startsAt) return;
        const entry = merged.get(startsAt) || { slot, staff: [] };
        if (!entry.staff.includes(staffSlug)) entry.staff.push(staffSlug);
        merged.set(startsAt, entry);
      });
    });

    return [...merged.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([startsAt, entry]) => {
        const orderedStaff = STAFF.map((item) => item.slug).filter((slug) => entry.staff.includes(slug));
        availabilityByStart.set(startsAt, orderedStaff);
        const count = orderedStaff.length;
        return {
          startsAt,
          label: `${slotTime(entry.slot, startsAt)} · ${count === 2 ? '2 posti liberi' : '1 posto libero'}`
        };
      });
  }

  async function fetchAvailability(date, serviceIds, staffSlug) {
    const params = new URLSearchParams({
      date,
      staffSlug,
      serviceIds: serviceIds.join(',')
    });
    const response = await fetch(`${API_BASE}/availability?${params.toString()}`, { headers: { Accept: 'application/json' } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok !== true || !Array.isArray(payload.slots)) {
      throw new Error(payload.error?.message || 'Disponibilità non raggiungibile.');
    }
    return payload;
  }

  function slotTime(slot, startsAt) {
    if (slot.label && /^\d{2}:\d{2}/.test(slot.label)) return slot.label.slice(0, 5);
    const date = new Date(startsAt);
    return Number.isFinite(date.getTime())
      ? date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
      : '';
  }

  async function submitBooking(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const submit = $('#booking-submit');
    const status = $('#booking-status');
    const success = $('#booking-success');
    const serviceIds = selectedServiceIds();
    const startsAt = $('#booking-time')?.value || '';
    const staffChoice = $('#booking-staff')?.value || 'any';

    if (!serviceIds.length) return showBookingError('Seleziona almeno un servizio.');
    if (!startsAt) return showBookingError('Scegli giorno e orario.');
    if (!form.reportValidity()) return;

    const basePayload = {
      serviceIds,
      startsAt,
      name: $('#customer-name')?.value || '',
      phone: $('#customer-phone')?.value || '',
      email: $('#customer-email')?.value || '',
      notes: $('#booking-notes')?.value || '',
      privacyVersion: PRIVACY_VERSION,
      idempotencyKey: createRequestKey(),
      website: $('#booking-website')?.value || ''
    };

    const candidates = staffChoice === 'any'
      ? (availabilityByStart.get(startsAt) || STAFF.map((item) => item.slug))
      : [staffChoice];

    if (submit) submit.disabled = true;
    if (status) status.textContent = 'Registrazione appuntamento…';

    let lastError = 'Prenotazione non riuscita.';
    for (const staffSlug of candidates) {
      try {
        const response = await fetch(`${API_BASE}/appointments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ ...basePayload, staffSlug })
        });
        const payload = await response.json().catch(() => ({}));
        if (response.ok && payload.ok === true) {
          const barber = staffLabel(staffSlug);
          const reference = payload.booking?.reference || '';
          if (status) status.textContent = '';
          if (success) {
            success.hidden = false;
            success.innerHTML = `<p class="eyebrow">Prenotazione ricevuta</p><h3>Appuntamento registrato.</h3><p><strong>${escapeHtml(barber)}</strong><br>${escapeHtml(formatDateTime(startsAt))}${reference ? `<br>Riferimento: ${escapeHtml(reference)}` : ''}</p><p>La prenotazione è già visibile nel gestionale della barberia.</p>`;
            success.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          await loadAvailability();
          if (submit) submit.disabled = false;
          return;
        }
        lastError = payload.error?.message || lastError;
        if (response.status !== 409 || staffChoice !== 'any') break;
      } catch (error) {
        lastError = error.message || lastError;
        break;
      }
    }

    if (submit) submit.disabled = false;
    showBookingError(lastError);
  }

  function showBookingError(message) {
    const status = $('#booking-status');
    if (status) {
      status.textContent = message;
      status.dataset.state = 'error';
      status.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function staffLabel(slug) {
    return STAFF.find((item) => item.slug === slug)?.label || slug;
  }

  function formatDateTime(value) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return value;
    return new Intl.DateTimeFormat('it-IT', {
      weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
    }).format(date);
  }

  function createRequestKey() {
    if (window.crypto?.randomUUID) return `booking_${window.crypto.randomUUID()}`;
    return `booking_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 14)}`;
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
})();
