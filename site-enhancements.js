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
      source.srcset = 'assets/images/studio/interno-01.webp';
      source.removeAttribute('sizes');
    }
    if (image) {
      image.src = 'assets/images/studio/interno-01.jpg';
      image.removeAttribute('srcset');
      image.alt = '';
    }

    const heroLead = document.querySelector('.hero-lead');
    if (heroLead) heroLead.textContent = 'Taglio, barba e cura dei dettagli con Paolo e Giuseppe, in Via Corato ad Andria.';

    const style = document.createElement('style');
    style.id = 'sgarra-2026-restyle';
    style.textContent = `
      .hero{isolation:isolate;background:#080a09}
      .hero-media{overflow:hidden;background:#080a09}
      .hero-media picture,.hero-media picture img{width:100%;height:100%}
      .hero-media picture img{object-fit:cover;object-position:center 48%;filter:blur(2.4px) brightness(.88) saturate(.92) contrast(1.04);transform:scale(1.025)}
      .hero-veil{background:linear-gradient(90deg,rgba(4,7,5,.78) 0%,rgba(4,7,5,.50) 42%,rgba(4,7,5,.24) 72%,rgba(4,7,5,.38) 100%),linear-gradient(0deg,rgba(4,7,5,.62) 0%,rgba(4,7,5,.05) 54%,rgba(4,7,5,.30) 100%)}
      .hero-content{max-width:760px;text-shadow:0 2px 18px rgba(0,0,0,.32)}
      .booking-staff-box{margin:0 0 1rem;padding:1rem;border:1px solid var(--line-strong);background:rgba(178,138,70,.055)}
      .booking-staff-box label{display:grid;gap:.45rem;font-weight:800;color:var(--cream)}
      .booking-staff-box select{min-height:52px;padding:.7rem .8rem;border:1px solid var(--line-strong);background:#0b0d0c;color:var(--cream);font:inherit}
      .booking-staff-help{margin:.55rem 0 0;color:var(--muted);font-size:.84rem;line-height:1.45}
      .booking-capacity-note{display:flex;align-items:flex-start;gap:.55rem;margin:.7rem 0 0;color:var(--brass-soft);font-size:.82rem;line-height:1.45}
      .booking-capacity-dot{flex:0 0 auto;width:.5rem;height:.5rem;border-radius:50%;margin-top:.32rem;background:currentColor;box-shadow:0 0 0 4px rgba(178,138,70,.10)}
      .booking-staff-summary{margin:.45rem 0 0;color:var(--brass-soft);font-weight:700}
      #booking-time option{background:#0b0d0c;color:#f3ede2}
      @media(max-width:720px){.hero-media picture img{object-position:center center;filter:blur(1.7px) brightness(.82) saturate(.92)}.hero-veil{background:linear-gradient(0deg,rgba(4,7,5,.74),rgba(4,7,5,.32) 70%,rgba(4,7,5,.38))}}
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
      <label for="booking-staff">Con chi vuoi prenotare?
        <select id="booking-staff" name="bookingStaff">
          <option value="any">Primo disponibile</option>
          <option value="paolo-sgarra">Paolo Sgarra</option>
          <option value="giuseppe">Giuseppe</option>
        </select>
      </label>
      <p class="booking-staff-help">Paolo e Giuseppe hanno due agende indipendenti. Con “Primo disponibile” manteniamo visibile lo stesso orario finché almeno uno dei due è libero.</p>
      <p class="booking-capacity-note"><span class="booking-capacity-dot" aria-hidden="true"></span><span>Slot ogni 30 minuti · capacità massima 2 clienti nello stesso orario, uno per barbiere. Se compare “1 posto”, l’altro barbiere è già impegnato.</span></p>
    `;
    grid.insertAdjacentElement('beforebegin', box);

    const select = box.querySelector('select');
    select.addEventListener('change', () => {
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
      ? 'Scegli il primo posto libero tra Paolo e Giuseppe: ogni mezz’ora può avere 2 posti, uno per ciascun barbiere.'
      : `Stai verificando la disponibilità reale di ${staffName(slug)}.`;
  }

  function decorateBookingSummary() {
    const summary = document.getElementById('booking-summary');
    if (!summary || summary.querySelector('.booking-staff-summary')) return;
    const item = document.createElement('p');
    item.className = 'booking-staff-summary';
    const slug = selectedStaff();
    const startsAt = document.getElementById('booking-time')?.value || '';
    const candidates = availabilityByStart.get(startsAt) || [];
    const chosen = slug === 'any' ? candidates[0] : slug;
    item.textContent = slug === 'any'
      ? `Barbiere: ${chosen ? staffName(chosen) : 'primo disponibile'}`
      : `Barbiere: ${staffName(slug)}`;
    summary.appendChild(item);
  }

  function observeSummary() {
    const summary = document.getElementById('booking-summary');
    if (!summary) return;
    new MutationObserver(() => setTimeout(decorateBookingSummary, 0)).observe(summary, { childList: true, subtree: false });
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
        if (summary) summary.textContent = `Barbiere: ${staffName(staffSlug)}`;
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
        return (await fetchAvailabilityFor(url.toString(), init, choice)).response;
      }

      if (url.pathname.endsWith('/api/appointments') && method === 'POST' && init.body) {
        return createWithFallback(input, init);
      }

      if (url.pathname.endsWith('/api/waitlist') && method === 'POST' && init.body) {
        const body = safeJson(init.body);
        const choice = selectedStaff();
        if (choice === 'any') {
          return jsonResponse({
            ok: false,
            error: { code: 'choose_staff_for_waitlist', message: 'Per entrare in lista d’attesa scegli prima Paolo oppure Giuseppe.' }
          }, 400);
        }
        body.staffSlug = choice;
        return nativeFetch(input, { ...init, body: JSON.stringify(body) });
      }

      return nativeFetch(input, init);
    };
  }

  function updateStaticCopy() {
    const faq = document.getElementById('faq-confirmation-answer');
    if (faq) faq.textContent = 'La richiesta occupa subito lo slot del barbiere assegnato. Paolo può poi confermarla, spostarla o passarla all’altro barbiere se libero.';
    const paoloSection = document.querySelector('#paolo .paolo-copy');
    if (paoloSection && !document.getElementById('team-operational-note')) {
      const note = document.createElement('p');
      note.id = 'team-operational-note';
      note.className = 'booking-capacity-note';
      note.innerHTML = '<span class="booking-capacity-dot" aria-hidden="true"></span><span>In barberia lavora anche Giuseppe: in prenotazione puoi scegliere lui oppure il primo disponibile.</span>';
      paoloSection.appendChild(note);
    }
  }

  installVisualRestyle();
  installStaffPicker();
  observeSummary();
  updateStaticCopy();
  interceptBookingFetches();
})();
