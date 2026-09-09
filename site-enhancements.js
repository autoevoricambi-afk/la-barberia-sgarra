(function enhanceSgarraSite() {
  'use strict';

  const nativeFetch = window.fetch.bind(window);
  const STAFF = [
    { slug: 'paolo-sgarra', label: 'Paolo Sgarra' },
    { slug: 'giuseppe', label: 'Giuseppe' }
  ];
  const availabilityByStart = new Map();

  function selectedStaff() {
    return document.getElementById('booking-staff')?.value || 'any';
  }

  function staffName(slug) {
    return STAFF.find((item) => item.slug === slug)?.label || slug;
  }

  function safeJson(value) {
    try { return JSON.parse(value || '{}'); } catch { return {}; }
  }

  function jsonResponse(payload, status = 200) {
    return new Response(JSON.stringify(payload), {
      status,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }

  function installVisualRestyle() {
    const picture = document.getElementById('hero-picture');
    const source = picture?.querySelector('source');
    const image = picture?.querySelector('img');
    if (source) {
      source.srcset = 'assets/images/studio/interno-02.webp';
      source.removeAttribute('sizes');
    }
    if (image) {
      image.src = 'assets/images/studio/interno-02.jpg';
      image.removeAttribute('srcset');
      image.alt = '';
    }

    const heroLead = document.querySelector('.hero-lead');
    if (heroLead) heroLead.textContent = 'Taglio, barba e cura dei dettagli con Paolo e Giuseppe, in Via Corato ad Andria.';

    if (document.getElementById('sgarra-2026-restyle')) return;
    const style = document.createElement('style');
    style.id = 'sgarra-2026-restyle';
    style.textContent = `
      .hero{isolation:isolate;background:#080a09}
      .hero-media{overflow:hidden;background:#080a09}
      .hero-media picture,.hero-media picture img{width:100%;height:100%}
      .hero-media picture img{object-fit:cover;object-position:center 48%;filter:blur(1.8px) brightness(.78) saturate(.92) contrast(1.08);transform:scale(1.025)}
      .hero-veil{background:linear-gradient(90deg,rgba(4,7,5,.82) 0%,rgba(4,7,5,.54) 42%,rgba(4,7,5,.25) 72%,rgba(4,7,5,.36) 100%),linear-gradient(0deg,rgba(4,7,5,.62) 0%,rgba(4,7,5,.05) 54%,rgba(4,7,5,.30) 100%)}
      .hero-content{max-width:760px;text-shadow:0 2px 18px rgba(0,0,0,.32)}
      .booking-staff-box{margin:0 0 1rem;padding:1rem;border:1px solid var(--line-strong);background:rgba(178,138,70,.055)}
      .booking-staff-box label{display:grid;gap:.45rem;font-weight:800;color:var(--cream)}
      .booking-staff-box select{min-height:52px;padding:.7rem .8rem;border:1px solid var(--line-strong);background:#0b0d0c;color:var(--cream);font:inherit}
      .booking-staff-help{margin:.55rem 0 0;color:var(--muted);font-size:.84rem;line-height:1.45}
      .booking-capacity-note{display:flex;align-items:flex-start;gap:.55rem;margin:.7rem 0 0;color:var(--brass-soft);font-size:.82rem;line-height:1.45}
      .booking-capacity-dot{flex:0 0 auto;width:.5rem;height:.5rem;border-radius:50%;margin-top:.32rem;background:currentColor;box-shadow:0 0 0 4px rgba(178,138,70,.10)}
      .booking-staff-summary{margin:.45rem 0 0;color:var(--brass-soft);font-weight:700}
      #booking-time option{background:#0b0d0c;color:#f3ede2}
      #other-services[hidden]{display:none!important}
      @media(max-width:720px){.hero-media picture img{object-position:center center;filter:blur(1.25px) brightness(.74) saturate(.92)}.hero-veil{background:linear-gradient(0deg,rgba(4,7,5,.76),rgba(4,7,5,.34) 70%,rgba(4,7,5,.40))}}
    `;
    document.head.appendChild(style);
  }

  function installStaffPicker() {
    const step = document.querySelector('.wizard-step[data-step="2"]');
    const grid = step?.querySelector('.form-grid');
    if (!step || !grid || document.getElementById('booking-staff')) return;

    const box = document.createElement('div');
    box.className = 'booking-staff-box';
    box.innerHTML = `
      <label for="booking-staff">Scegli il barbiere
        <select id="booking-staff" name="bookingStaff">
          <option value="any">Primo disponibile</option>
          <option value="paolo-sgarra">Paolo Sgarra</option>
          <option value="giuseppe">Giuseppe</option>
        </select>
      </label>
      <p class="booking-staff-help">Paolo e Giuseppe hanno due agende indipendenti. Con “Primo disponibile” lo stesso orario resta prenotabile finché almeno uno dei due è libero.</p>
      <p class="booking-capacity-note"><span class="booking-capacity-dot" aria-hidden="true"></span><span>Slot ogni 30 minuti · massimo 2 clienti nello stesso orario, uno per barbiere. “1 posto” significa che l’altra postazione è già occupata.</span></p>
    `;
    grid.insertAdjacentElement('beforebegin', box);

    box.querySelector('select').addEventListener('change', () => {
      availabilityByStart.clear();
      const date = document.getElementById('booking-date');
      if (date?.value) date.dispatchEvent(new Event('change', { bubbles: true }));
      updateBookingLead();
    });
    updateBookingLead();
  }

  function updateBookingLead() {
    const lead = document.getElementById('booking-lead');
    if (!lead) return;
    const slug = selectedStaff();
    lead.textContent = slug === 'any'
      ? 'Scegli il primo posto libero tra Paolo e Giuseppe. Ogni mezz’ora può avere 2 posti, uno per ciascun barbiere.'
      : `Stai verificando la disponibilità reale di ${staffName(slug)}.`;
  }

  function decorateBookingSummary() {
    const summary = document.getElementById('booking-summary');
    if (!summary) return;
    let item = summary.querySelector('.booking-staff-summary');
    if (!item) {
      item = document.createElement('p');
      item.className = 'booking-staff-summary';
      summary.appendChild(item);
    }
    const slug = selectedStaff();
    const startsAt = document.getElementById('booking-time')?.value || '';
    const candidates = availabilityByStart.get(startsAt) || [];
    const chosen = slug === 'any' ? candidates[0] : slug;
    item.textContent = slug === 'any'
      ? `Barbiere assegnato: ${chosen ? staffName(chosen) : 'primo disponibile al salvataggio'}`
      : `Barbiere: ${staffName(slug)}`;
  }

  function observeSummary() {
    const summary = document.getElementById('booking-summary');
    if (!summary || summary.dataset.staffObserver === '1') return;
    summary.dataset.staffObserver = '1';
    new MutationObserver(() => setTimeout(decorateBookingSummary, 0)).observe(summary, { childList: true, subtree: false });
  }

  function showAllServices() {
    const primary = document.getElementById('service-grid');
    const secondary = document.getElementById('service-grid-secondary');
    const details = document.getElementById('other-services');
    if (!primary) return;
    if (secondary) {
      [...secondary.children].forEach((card) => primary.appendChild(card));
    }
    if (details) details.hidden = true;
  }

  function observeServices() {
    const primary = document.getElementById('service-grid');
    const secondary = document.getElementById('service-grid-secondary');
    const observer = new MutationObserver(() => setTimeout(showAllServices, 0));
    if (primary) observer.observe(primary, { childList: true });
    if (secondary) observer.observe(secondary, { childList: true });
    showAllServices();
  }

  function purgeLegacyTimeOptions() {
    const select = document.getElementById('booking-time');
    if (!select) return;
    [...select.options].forEach((option) => {
      const value = String(option.value || '').trim();
      if (/^\d{2}:\d{2}$/.test(value)) option.remove();
    });
    if (!select.options.length) select.appendChild(new Option('Seleziona', ''));
  }

  async function fetchAvailabilityFor(url, init, staffSlug) {
    const next = new URL(url, location.href);
    next.searchParams.set('staffSlug', staffSlug);
    const response = await nativeFetch(next.toString(), init);
    const data = await response.clone().json().catch(() => ({}));
    return { response, data, staffSlug };
  }

  async function mergedAvailability(url, init) {
    availabilityByStart.clear();
    const results = await Promise.all(STAFF.map((staff) => fetchAvailabilityFor(url, init, staff.slug)));
    const successful = results.filter((item) => item.response.ok && Array.isArray(item.data?.slots));
    if (!successful.length) return results[0].response;

    const merged = new Map();
    successful.forEach(({ data, staffSlug }) => {
      data.slots.forEach((slot) => {
        const startsAt = slot.starts_at || slot.startsAt || '';
        if (!startsAt) return;
        const entry = merged.get(startsAt) || { slot, staff: [] };
        if (!entry.staff.includes(staffSlug)) entry.staff.push(staffSlug);
        merged.set(startsAt, entry);
      });
    });

    const slots = [...merged.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([startsAt, entry]) => {
        const preferredOrder = STAFF.map((staff) => staff.slug).filter((slug) => entry.staff.includes(slug));
        availabilityByStart.set(startsAt, preferredOrder);
        const baseLabel = entry.slot.label || new Date(startsAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
        return {
          ...entry.slot,
          starts_at: startsAt,
          label: `${baseLabel} · ${entry.staff.length} ${entry.staff.length === 1 ? 'posto' : 'posti'}`
        };
      });

    const requested = new URL(url, location.href);
    return jsonResponse({ ok: true, date: requested.searchParams.get('date'), slots });
  }

  function candidateStaffForStart(startsAt) {
    const choice = selectedStaff();
    if (choice !== 'any') return [choice];
    const mapped = availabilityByStart.get(startsAt) || [];
    const all = STAFF.map((item) => item.slug);
    return [...mapped, ...all.filter((slug) => !mapped.includes(slug))];
  }

  async function createWithFallback(input, init) {
    const originalBody = safeJson(init.body);
    const candidates = candidateStaffForStart(originalBody.startsAt);
    let lastResponse = null;

    for (const staffSlug of candidates) {
      const body = { ...originalBody, staffSlug };
      const response = await nativeFetch(input, { ...init, body: JSON.stringify(body) });
      lastResponse = response;
      if (response.ok) {
        const summary = document.querySelector('.booking-staff-summary');
        if (summary) summary.textContent = `Barbiere assegnato: ${staffName(staffSlug)}`;
        return response;
      }
      if (response.status !== 409 || selectedStaff() !== 'any') return response;
    }
    return lastResponse || jsonResponse({ ok: false, error: { message: 'Nessun barbiere disponibile in questo orario.' } }, 409);
  }

  function interceptBookingFetches() {
    window.fetch = async function(input, init = {}) {
      const rawUrl = typeof input === 'string' ? input : (input?.url || '');
      const url = new URL(rawUrl, location.href);
      const method = String(init.method || input?.method || 'GET').toUpperCase();

      if (url.pathname.endsWith('/availability') && method === 'GET') {
        const choice = selectedStaff();
        if (choice === 'any') return mergedAvailability(url.toString(), init);
        availabilityByStart.clear();
        return (await fetchAvailabilityFor(url.toString(), init, choice)).response;
      }

      if (url.pathname.endsWith('/appointments') && method === 'POST' && init.body) {
        return createWithFallback(input, init);
      }

      if (url.pathname.endsWith('/waitlist') && method === 'POST' && init.body) {
        const body = safeJson(init.body);
        const choice = selectedStaff();
        if (choice === 'any') {
          return jsonResponse({ ok: false, error: { code: 'choose_staff_for_waitlist', message: 'Per entrare in lista d’attesa scegli Paolo oppure Giuseppe.' } }, 400);
        }
        body.staffSlug = choice;
        return nativeFetch(input, { ...init, body: JSON.stringify(body) });
      }

      return nativeFetch(input, init);
    };
  }

  function updateStaticCopy() {
    const faq = document.getElementById('faq-confirmation-answer');
    if (faq) faq.textContent = 'La richiesta occupa subito la postazione assegnata. Dal gestionale la barberia può confermarla, spostarla, annullarla o passarla all’altro barbiere se libero.';
    const change = document.getElementById('faq-change-answer');
    if (change) change.textContent = 'Sì. Contatta la barberia: dal gestionale l’appuntamento può essere spostato senza creare doppioni.';

    const consent = document.querySelector('#booking-consent + span');
    if (consent) consent.innerHTML = 'Ho letto l’<a href="privacy.html" target="_blank" rel="noopener noreferrer">informativa privacy</a> e chiedo la registrazione dell’appuntamento.';

    const submit = document.getElementById('booking-submit');
    if (submit) submit.innerHTML = 'Prenota <span class="btn-arrow" aria-hidden="true">→</span>';

    const paoloSection = document.querySelector('#paolo .paolo-copy');
    if (paoloSection && !document.getElementById('team-operational-note')) {
      const note = document.createElement('p');
      note.id = 'team-operational-note';
      note.className = 'booking-capacity-note';
      note.innerHTML = '<span class="booking-capacity-dot" aria-hidden="true"></span><span>In barberia lavora anche Giuseppe: in prenotazione puoi scegliere lui, Paolo oppure il primo disponibile.</span>';
      paoloSection.appendChild(note);
    }
  }

  installVisualRestyle();
  installStaffPicker();
  observeSummary();
  observeServices();
  purgeLegacyTimeOptions();
  updateStaticCopy();
  interceptBookingFetches();

  setTimeout(() => {
    installStaffPicker();
    observeSummary();
    showAllServices();
    purgeLegacyTimeOptions();
    updateStaticCopy();
  }, 300);
})();
