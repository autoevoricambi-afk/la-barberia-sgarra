(function enhanceSgarraSite() {
  'use strict';

  const nativeFetch = window.fetch.bind(window);
  const STAFF = [
    { slug: 'paolo-sgarra', label: 'Paolo Sgarra' },
    { slug: 'giuseppe', label: 'Giuseppe' }
  ];
  const availabilityByStart = new Map();
  let flatteningServices = false;

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
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
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
      image.alt = 'Interno rinnovato della Barberia Sgarra ad Andria';
    }

    const heroLead = document.querySelector('.hero-lead');
    if (heroLead) heroLead.textContent = 'Taglio, barba e cura dei dettagli con Paolo e Giuseppe, in Via Corato ad Andria.';

    if (document.getElementById('sgarra-final-restyle')) return;
    const style = document.createElement('style');
    style.id = 'sgarra-final-restyle';
    style.textContent = `
      .hero{isolation:isolate;background:#080a09}
      .hero-media{overflow:hidden;background:#080a09}
      .hero-media picture,.hero-media picture img{width:100%;height:100%}
      .hero-media picture img{object-fit:cover;object-position:center 52%;filter:blur(1.15px) brightness(.76) saturate(.96) contrast(1.08);transform:scale(1.018)}
      .hero-veil{background:linear-gradient(90deg,rgba(4,7,5,.84) 0%,rgba(4,7,5,.55) 43%,rgba(4,7,5,.18) 76%,rgba(4,7,5,.34) 100%),linear-gradient(0deg,rgba(4,7,5,.66),rgba(4,7,5,.02) 58%,rgba(4,7,5,.28))}
      .hero-content{max-width:760px;text-shadow:0 2px 18px rgba(0,0,0,.38)}
      .booking-staff-box{margin:0 0 1rem;padding:1rem;border:1px solid var(--line-strong);background:rgba(178,138,70,.055)}
      .booking-staff-box label{display:grid;gap:.45rem;font-weight:800;color:var(--cream)}
      .booking-staff-box select{min-height:52px;padding:.7rem .8rem;border:1px solid var(--line-strong);background:#0b0d0c;color:var(--cream);font:inherit}
      .booking-staff-help{margin:.55rem 0 0;color:var(--muted);font-size:.84rem;line-height:1.45}
      .booking-live-note{margin:.55rem 0 0;color:var(--brass-soft);font-size:.8rem}
      .booking-staff-summary{margin:.45rem 0 0;color:var(--brass-soft);font-weight:700}
      #booking-time option{background:#0b0d0c;color:#f3ede2}
      #other-services{display:none!important}
      @media(max-width:720px){.hero-media picture img{object-position:center center;filter:blur(.8px) brightness(.70) saturate(.94)}.hero-veil{background:linear-gradient(0deg,rgba(4,7,5,.78),rgba(4,7,5,.30) 72%,rgba(4,7,5,.42))}}
    `;
    document.head.appendChild(style);
  }

  function flattenServices() {
    if (flatteningServices) return;
    const primary = document.getElementById('service-grid');
    const secondary = document.getElementById('service-grid-secondary');
    if (!primary || !secondary || !secondary.children.length) return;
    flatteningServices = true;
    try {
      [...secondary.children].forEach((node) => primary.appendChild(node));
      const details = document.getElementById('other-services');
      if (details) details.hidden = true;
    } finally {
      flatteningServices = false;
    }
  }

  function observeServices() {
    const primary = document.getElementById('service-grid');
    const secondary = document.getElementById('service-grid-secondary');
    if (!primary || !secondary) return;
    const observer = new MutationObserver(() => setTimeout(flattenServices, 0));
    observer.observe(primary, { childList: true });
    observer.observe(secondary, { childList: true });
    flattenServices();
  }

  function removeLegacyTimes() {
    const select = document.getElementById('booking-time');
    if (!select) return;
    [...select.options].forEach((option) => {
      const value = String(option.value || option.textContent || '').trim();
      if (/^\d{2}:\d{2}$/.test(value)) option.remove();
    });
    if (!select.options.length) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'Scegli prima giorno e barbiere';
      select.appendChild(option);
    }
    const hint = document.getElementById('time-hint');
    if (hint && !select.value) hint.textContent = 'Gli orari vengono caricati dalla disponibilità reale.';
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
      <p class="booking-staff-help">Scegli Paolo, Giuseppe oppure lascia al sistema il primo posto libero.</p>
      <p class="booking-live-note">Disponibilità aggiornata in tempo reale · 2 postazioni · slot ogni 30 minuti.</p>
    `;
    grid.insertAdjacentElement('beforebegin', box);

    box.querySelector('select')?.addEventListener('change', () => {
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
      ? 'Scegli giorno e orario: il sistema assegna automaticamente il primo barbiere disponibile.'
      : `Stai visualizzando gli orari realmente disponibili di ${staffName(slug)}.`;
  }

  function chosenStaffForStart(startsAt) {
    const slug = selectedStaff();
    if (slug !== 'any') return slug;
    return (availabilityByStart.get(startsAt) || [])[0] || '';
  }

  function decorateBookingSummary() {
    const summary = document.getElementById('booking-summary');
    if (!summary) return;
    summary.querySelector('.booking-staff-summary')?.remove();
    const startsAt = document.getElementById('booking-time')?.value || '';
    const chosen = chosenStaffForStart(startsAt);
    const item = document.createElement('p');
    item.className = 'booking-staff-summary';
    item.textContent = chosen ? `Barbiere assegnato: ${staffName(chosen)}` : 'Barbiere: verrà assegnato al salvataggio';
    summary.appendChild(item);
  }

  function observeSummary() {
    const summary = document.getElementById('booking-summary');
    if (!summary) return;
    new MutationObserver(() => setTimeout(decorateBookingSummary, 0)).observe(summary, { childList: true });
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
    if (!successful.length) return results[0]?.response || jsonResponse({ ok: false, error: { message: 'Disponibilità temporaneamente non raggiungibile.' } }, 502);

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
        const order = STAFF.map((staff) => staff.slug).filter((slug) => entry.staff.includes(slug));
        availabilityByStart.set(startsAt, order);
        const baseLabel = entry.slot.label || new Date(startsAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
        return {
          ...entry.slot,
          starts_at: startsAt,
          label: `${baseLabel} · ${entry.staff.length === 2 ? '2 posti liberi' : '1 posto libero'}`
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
      const nextBody = { ...originalBody, staffSlug };
      const response = await nativeFetch(input, { ...init, body: JSON.stringify(nextBody) });
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

      if (url.pathname.endsWith('/api/availability') && method === 'GET') {
        const choice = selectedStaff();
        if (choice === 'any') return mergedAvailability(url.toString(), init);
        availabilityByStart.clear();
        const result = await fetchAvailabilityFor(url.toString(), init, choice);
        if (result.response.ok && Array.isArray(result.data?.slots)) {
          result.data.slots.forEach((slot) => {
            const startsAt = slot.starts_at || slot.startsAt || '';
            if (startsAt) availabilityByStart.set(startsAt, [choice]);
          });
        }
        return result.response;
      }

      if (url.pathname.endsWith('/api/appointments') && method === 'POST' && init.body) {
        return createWithFallback(input, init);
      }

      if (url.pathname.endsWith('/api/waitlist') && method === 'POST' && init.body) {
        const nextBody = safeJson(init.body);
        const choice = selectedStaff();
        if (choice === 'any') {
          return jsonResponse({ ok: false, error: { message: 'Per la lista d’attesa scegli Paolo oppure Giuseppe.' } }, 400);
        }
        nextBody.staffSlug = choice;
        return nativeFetch(input, { ...init, body: JSON.stringify(nextBody) });
      }

      return nativeFetch(input, init);
    };
  }

  function updateStaticCopy() {
    const faq = document.getElementById('faq-confirmation-answer');
    if (faq) faq.textContent = 'Quando prenoti, il posto viene registrato nel gestionale sul barbiere assegnato. La barberia può confermarlo, spostarlo o riassegnarlo.';
    const faqChange = document.getElementById('faq-change-answer');
    if (faqChange) faqChange.textContent = 'Sì. La barberia può spostare l’appuntamento dal gestionale senza creare una seconda prenotazione.';
    const consent = document.querySelector('#booking-consent + span');
    if (consent) consent.innerHTML = 'Ho letto l’<a href="privacy.html" target="_blank" rel="noopener noreferrer">informativa privacy</a> e chiedo la registrazione dell’appuntamento.';
    const submit = document.getElementById('booking-submit');
    if (submit) submit.innerHTML = 'Prenota appuntamento <span class="btn-arrow" aria-hidden="true">→</span>';
    const successTitle = document.querySelector('#booking-success h3');
    if (successTitle) successTitle.textContent = 'Appuntamento registrato.';
    const successEyebrow = document.querySelector('#booking-success .eyebrow');
    if (successEyebrow) successEyebrow.textContent = 'Prenotazione ricevuta';
  }

  function observeLegacyUi() {
    const time = document.getElementById('booking-time');
    if (time) new MutationObserver(() => removeLegacyTimes()).observe(time, { childList: true });
    const booking = document.getElementById('prenota');
    if (booking) new MutationObserver(() => updateStaticCopy()).observe(booking, { childList: true, subtree: true });
  }

  installVisualRestyle();
  observeServices();
  removeLegacyTimes();
  installStaffPicker();
  observeSummary();
  updateStaticCopy();
  observeLegacyUi();
  interceptBookingFetches();
})();
