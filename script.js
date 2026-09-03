'use strict';

/**
 * La Barberia Sgarra — Brand Experience App
 */
(function initApp() {
  document.documentElement.classList.add('js');
  var config = window.SITE_CONFIG || {};
  var runtimeBooking = Object.assign({}, config.booking || {});
  var runtimeServices = config.services || { primary: [], secondary: [] };
  var WHATSAPP = String(config.whatsappNumber || '393296410828');
  var currentStep = 1;
  var bookingRequestKey = createBookingRequestKey();
  var lightboxIndex = 0;
  var galleryTriggers = [];
  var stickyZones = {
    hero: true,
    prenota: false,
    finalCta: false,
    footer: false
  };
  var stickyRaf = 0;

  bindConfigLinks();
  initSeoUrls();
  initYear();
  initHeroMedia();
  renderGallery();
  renderServices();
  renderStudio();
  renderReels();
  renderReviews();
  initAnalyticsBootstrap();
  initClickTracking();
  initMobileNav();
  initSmoothNav();
  initReveal();
  initLightbox();
  initServiceSync();
  initBookingWizard();
  initStickyBar();
  initCookieBanner();
  initStudioPlayer();
  initLocationSection();
  initPaoloBio();
  initPwa();
  loadPublicConfiguration();

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function saveDataPreferred() {
    try {
      return !!(navigator.connection && navigator.connection.saveData);
    } catch (e) {
      return false;
    }
  }

  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function normalizeWhitespace(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function createBookingRequestKey() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return 'booking_' + window.crypto.randomUUID();
    }
    return 'booking_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 14);
  }

  function liveBookingEnabled() {
    var booking = runtimeBooking;
    return booking.mode === 'live' && booking.serviceCatalogReady === true;
  }

  function bookingApi(path) {
    var base = String(runtimeBooking.apiBase || '/api').replace(/\/$/, '');
    return base + path;
  }

  async function loadPublicConfiguration() {
    try {
      var response = await fetch(bookingApi('/public-config'), { headers: { Accept: 'application/json' } });
      var payload = await response.json().catch(function () { return {}; });
      if (!response.ok || payload.configured !== true || !Array.isArray(payload.services) || !payload.services.length) return;
      var services = payload.services.map(function (item) {
        var details = [];
        if (item.description) details.push(item.description);
        if (Number(item.durationMinutes) > 0) details.push(Number(item.durationMinutes) + ' min');
        if (item.priceCents != null) details.push('€' + (Number(item.priceCents) / 100).toFixed(2).replace('.', ','));
        return { id: item.id, label: item.label, desc: details.join(' · ') };
      });
      runtimeServices = { primary: services.slice(0, 5), secondary: services.slice(5) };
      runtimeBooking.bookingHorizonDays = Number(payload.bookingHorizonDays || runtimeBooking.bookingHorizonDays || 45);
      runtimeBooking.mode = payload.bookingEnabled === true ? 'live' : 'request';
      runtimeBooking.serviceCatalogReady = payload.bookingEnabled === true;
      renderServices();
      syncBookingDateLimits();
      updateServiceUI();
      configureBookingMode();
    } catch (error) {
      if (config.debug && window.console) console.warn('Configurazione booking non raggiungibile.', error);
    }
  }

  function formatDateIT(iso) {
    if (!iso) return '';
    var p = iso.split('-');
    return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : iso;
  }

  function formatDateLongIT(iso) {
    if (!iso) return '';
    var p = iso.split('-');
    if (p.length !== 3) return iso;
    var months = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
    var day = parseInt(p[2], 10);
    var month = parseInt(p[1], 10) - 1;
    if (isNaN(day) || month < 0 || month > 11) return iso;
    return day + ' ' + months[month] + ' ' + p[0];
  }

  function getFocusable(container) {
    return Array.prototype.slice.call(
      container.querySelectorAll('a[href], button:not([disabled]), textarea, input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')
    ).filter(function (el) {
      return !el.hasAttribute('hidden') && el.getClientRects().length;
    });
  }

  function trapFocus(container, event) {
    if (event.key !== 'Tab') return;
    var focusable = getFocusable(container);
    if (!focusable.length) return;
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ---------- Config bind ---------- */
  function bindConfigLinks() {
    var wa = 'https://wa.me/' + WHATSAPP;
    var maps = config.mapsUrl || '';
    var ig = config.instagramUrl || '';
    var phone = config.phoneHref || 'tel:+393296410828';
    document.querySelectorAll('[data-bind="whatsapp"]').forEach(function (el) { el.setAttribute('href', wa); });
    document.querySelectorAll('[data-bind="maps"]').forEach(function (el) { if (maps) el.setAttribute('href', maps); });
    document.querySelectorAll('[data-bind="instagram"]').forEach(function (el) { if (ig) el.setAttribute('href', ig); });
    document.querySelectorAll('[data-bind="phone"]').forEach(function (el) { el.setAttribute('href', phone); if (el.tagName === 'A' && el.textContent && el.textContent.indexOf('+') === 0) el.textContent = config.phoneDisplay || el.textContent; });

    var bio = document.getElementById('paolo-bio');
    if (bio && config.barber && config.barber.bio && config.paoloBioApproved === true) {
      bio.textContent = config.barber.bio;
    }
  }

  function initPaoloBio() {
    var bio = document.getElementById('paolo-bio');
    if (!bio || !config.barber) return;
    if (config.paoloBioApproved === true && config.barber.bio) {
      bio.textContent = config.barber.bio;
    } else {
      bio.textContent = config.barber.bioNeutral ||
        'Dietro ogni lavoro c’è Paolo Sgarra, il barbiere della Barberia Sgarra ad Andria.';
    }
  }

  function initLocationSection() {
    var grid = document.getElementById('dove-grid');
    var visual = document.getElementById('dove-visual');
    var hours = document.getElementById('hours-note');
    var media = (config.locationMedia && Array.isArray(config.locationMedia.items)) ? config.locationMedia.items : [];

    if (config.locationMediaApproved === true && media.length && visual) {
      visual.hidden = false;
      visual.textContent = '';
      media.forEach(function (item) {
        if (!item || !item.src) return;
        var fig = document.createElement('figure');
        var img = document.createElement('img');
        img.src = item.src;
        img.alt = item.alt || '';
        img.loading = 'lazy';
        img.decoding = 'async';
        fig.appendChild(img);
        visual.appendChild(fig);
      });
      if (grid) grid.classList.remove('is-typo-only');
    } else {
      if (visual) {
        visual.hidden = true;
        visual.textContent = '';
      }
      if (grid) grid.classList.add('is-typo-only');
    }

    if (hours) {
      if (config.openingHoursApproved === true && config.openingHours && config.openingHours.note) {
        hours.hidden = false;
        hours.textContent = config.openingHours.note;
      } else {
        hours.hidden = true;
        hours.textContent = '';
      }
    }
  }

  function initSeoUrls() {
    var base = String(config.siteUrl || '').replace(/\/$/, '');
    var robots = document.getElementById('robots-meta');
    if (robots) {
      robots.setAttribute('content', config.launchReady === true ? 'index, follow' : 'noindex, nofollow');
    }
    if (!base) return;
    var canonical = document.getElementById('canonical-link');
    var ogUrl = document.getElementById('og-url');
    if (canonical) canonical.setAttribute('href', base + '/');
    if (ogUrl) ogUrl.setAttribute('content', base + '/');
    ['og-image', 'twitter-image'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      var src = el.getAttribute('content') || '';
      if (src && src.indexOf('http') !== 0) el.setAttribute('content', base + '/' + src.replace(/^\//, ''));
    });

    var jsonLd = document.getElementById('jsonld-business');
    if (jsonLd) {
      try {
        var data = JSON.parse(jsonLd.textContent || '{}');
        data.url = base + '/';
        if (Array.isArray(data.image)) {
          data.image = data.image.map(function (src) {
            return String(src || '').indexOf('http') === 0
              ? src
              : base + '/' + String(src || '').replace(/^\//, '');
          });
        }
        jsonLd.textContent = JSON.stringify(data);
      } catch (error) {
        if (config.debug) console.warn('[seo] JSON-LD non aggiornato', error);
      }
    }
  }

  function initYear() {
    var el = document.getElementById('year');
    if (el) el.textContent = String(new Date().getFullYear());
  }

  /* ---------- Hero media Mode A/B ---------- */
  function initHeroMedia() {
    var media = (config.media && config.media.hero) || {};
    var video = document.getElementById('hero-video');
    var picture = document.getElementById('hero-picture');
    var canVideo =
      media.mode === 'video' &&
      media.videoMp4 &&
      video &&
      !prefersReducedMotion() &&
      !saveDataPreferred();

    if (canVideo) {
      if (media.videoWebm) {
        var sWebm = document.createElement('source');
        sWebm.src = media.videoWebm;
        sWebm.type = 'video/webm';
        video.appendChild(sWebm);
      }
      var sMp4 = document.createElement('source');
      sMp4.src = media.videoMp4;
      sMp4.type = 'video/mp4';
      video.appendChild(sMp4);
      video.hidden = false;
      if (picture) picture.hidden = true;
      video.muted = true;
      video.setAttribute('playsinline', '');
      var playPromise = video.play();
      if (playPromise && playPromise.catch) {
        playPromise.catch(function () {
          video.hidden = true;
          if (picture) picture.hidden = false;
        });
      }
      trackEvent('video_hero_play', { auto: true });
    }
  }

  /* ---------- Render gallery ---------- */
  function renderGallery() {
    var root = document.getElementById('gallery');
    var more = document.getElementById('gallery-more');
    if (!root) return;
    var items = Array.isArray(config.gallery) ? config.gallery : [];
    root.textContent = '';
    items.forEach(function (item, index) {
      var fig = document.createElement('figure');
      fig.className = 'gallery-item' + (item.span === 'tall' ? ' is-tall' : '') + (item.span === 'wide' ? ' is-wide' : '');
      if (index >= 6) {
        fig.classList.add('is-extra');
        fig.hidden = true;
      }
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'gallery-trigger';
      btn.setAttribute('data-gallery-index', String(index));
      btn.setAttribute('data-gallery-src', item.src);
      btn.setAttribute('data-gallery-alt', item.alt || '');
      btn.setAttribute('data-gallery-caption', item.caption || '');
      btn.setAttribute('aria-label', 'Ingrandisci: ' + (item.caption || item.alt || 'lavoro'));
      var img = document.createElement('img');
      img.src = item.src;
      img.width = item.w || 320;
      img.height = item.h || 400;
      img.alt = item.alt || '';
      img.loading = 'lazy';
      img.decoding = 'async';
      btn.appendChild(img);
      fig.appendChild(btn);
      if (item.caption) {
        var cap = document.createElement('span');
        cap.className = 'gallery-caption';
        cap.textContent = item.caption;
        fig.appendChild(cap);
      }
      root.appendChild(fig);
    });

    if (more) {
      var extras = root.querySelectorAll('.is-extra');
      if (extras.length && window.matchMedia('(max-width: 640px)').matches) {
        more.hidden = false;
        more.addEventListener('click', function () {
          extras.forEach(function (el) { el.hidden = false; });
          more.hidden = true;
          trackEvent('gallery_expand', {});
          refreshGalleryTriggers();
        });
      } else {
        extras.forEach(function (el) { el.hidden = false; });
        more.hidden = true;
      }
    }
    refreshGalleryTriggers();
  }

  function refreshGalleryTriggers() {
    galleryTriggers = Array.prototype.slice.call(document.querySelectorAll('.gallery-trigger'));
  }

  /* ---------- Services ---------- */
  function renderServices() {
    var primary = document.getElementById('service-grid');
    var secondary = document.getElementById('service-grid-secondary');
    var svc = runtimeServices || {};
    if (primary) fillServiceGrid(primary, svc.primary || []);
    if (secondary) fillServiceGrid(secondary, svc.secondary || []);
  }

  function fillServiceGrid(container, list) {
    container.textContent = '';
    list.forEach(function (svc) {
      var label = document.createElement('label');
      label.className = 'service-card';
      var input = document.createElement('input');
      input.type = 'checkbox';
      input.name = 'service';
      input.value = svc.label;
      input.setAttribute('form', 'booking-form');
      input.setAttribute('data-track-service', '');
      input.setAttribute('data-service-id', svc.id || '');
      var selId = 'svc-sel-' + String(svc.id || svc.label).replace(/\s+/g, '-');
      input.setAttribute('aria-describedby', selId);
      var face = document.createElement('span');
      face.className = 'service-face';
      face.innerHTML =
        '<span class="service-mark" aria-hidden="true">✓</span>' +
        '<span class="service-selected-label" id="' + escapeHtml(selId) + '">Selezionato</span>' +
        '<span class="service-title">' + escapeHtml(svc.label) + '</span>' +
        '<span class="service-desc">' + escapeHtml(svc.desc || '') + '</span>';
      label.appendChild(input);
      label.appendChild(face);
      container.appendChild(label);
    });
  }

  function renderStudio() {
    var section = document.getElementById('studio');
    var stillsRoot = document.getElementById('studio-stills');
    var player = document.getElementById('studio-player');
    var studio = (config.media && config.media.studio) || {};
    var approved = config.studioMediaApproved === true;
    var hasVideo = Boolean(studio.videoMp4);

    if (!approved && !hasVideo) {
      if (section) {
        section.hidden = true;
        section.setAttribute('aria-hidden', 'true');
      }
      return;
    }
    if (section) section.hidden = false;

    if (hasVideo && player) {
      player.hidden = false;
      var video = document.getElementById('studio-video');
      if (video) {
        var source = document.createElement('source');
        source.src = studio.videoMp4;
        source.type = 'video/mp4';
        video.appendChild(source);
        if (studio.poster) video.setAttribute('poster', studio.poster);
      }
    }

    if (!stillsRoot) return;
    stillsRoot.textContent = '';
    if (!approved || !Array.isArray(studio.stills) || !studio.stills.length) {
      stillsRoot.hidden = true;
      return;
    }
    stillsRoot.hidden = false;
    stillsRoot.classList.toggle('is-compact', studio.stills.length === 1);
    studio.stills.forEach(function (still) {
      var fig = document.createElement('figure');
      var img = document.createElement('img');
      img.src = still.src;
      img.alt = still.alt || '';
      img.loading = 'lazy';
      img.decoding = 'async';
      img.width = 320;
      img.height = 400;
      fig.appendChild(img);
      stillsRoot.appendChild(fig);
    });
  }

  function initStudioPlayer() {
    var playBtn = document.getElementById('studio-play');
    var video = document.getElementById('studio-video');
    if (!playBtn || !video) return;
    playBtn.addEventListener('click', function () {
      playBtn.hidden = true;
      video.hidden = false;
      video.play();
      trackEvent('video_studio_play', {});
    });
  }

  function renderReels() {
    var section = document.getElementById('reels');
    var grid = document.getElementById('reels-grid');
    var media = Array.isArray(config.instagramMedia) ? config.instagramMedia.filter(function (m) { return m && m.enabled; }) : [];
    if (!section || !grid) return;
    if (!media.length) {
      section.remove();
      return;
    }
    section.hidden = false;
    section.removeAttribute('aria-hidden');
    grid.textContent = '';
    media.slice(0, 3).forEach(function (item) {
      var card = document.createElement('article');
      card.className = 'reel-card';
      if (item.localVideo) {
        var v = document.createElement('video');
        v.src = item.localVideo;
        v.controls = true;
        v.playsInline = true;
        v.preload = 'none';
        if (item.poster) v.poster = item.poster;
        card.appendChild(v);
      } else if (item.poster) {
        var img = document.createElement('img');
        img.src = item.poster;
        img.alt = item.title || 'Reel Instagram';
        img.loading = 'lazy';
        card.appendChild(img);
      }
      if (item.url) {
        var a = document.createElement('a');
        a.href = item.url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.className = 'button button-ghost';
        a.textContent = 'Guarda su Instagram';
        a.setAttribute('data-track', 'instagram_reel_open');
        card.appendChild(a);
      }
      grid.appendChild(card);
    });
  }

  function renderReviews() {
    var section = document.getElementById('recensioni');
    var grid = document.getElementById('reviews-grid');
    if (!section || !grid) return;
    var enabled = !!config.reviewsEnabled;
    var list = Array.isArray(config.reviews) ? config.reviews.filter(function (r) { return r && r.verified && r.text; }) : [];
    if (!enabled || !list.length) {
      section.remove();
      return;
    }
    section.hidden = false;
    grid.textContent = '';
    list.forEach(function (r) {
      var art = document.createElement('article');
      art.className = 'review-card';
      art.innerHTML =
        '<p class="review-text">' + escapeHtml(r.text) + '</p>' +
        '<p class="review-meta">' + escapeHtml(r.author || '') + (r.source ? ' · ' + escapeHtml(r.source) : '') + '</p>';
      grid.appendChild(art);
    });
  }

  /* ---------- Analytics ---------- */
  function trackEvent(eventName, parameters) {
    var params = parameters && typeof parameters === 'object' ? parameters : {};
    var safe = {};
    Object.keys(params).forEach(function (key) {
      if (/name|phone|note|email|message|customer|date/i.test(key)) return;
      safe[key] = params[key];
    });
    try {
      if (Array.isArray(window.dataLayer)) window.dataLayer.push(Object.assign({ event: eventName }, safe));
    } catch (e1) { /* no-op */ }
    try {
      if (typeof window.gtag === 'function') window.gtag('event', eventName, safe);
    } catch (e2) { /* no-op */ }
    try {
      var consent = localStorage.getItem('sgarra_tracking_consent');
      var allowed = ['service_view', 'booking_start', 'slot_view', 'slot_selected', 'booking_confirmed', 'booking_cancelled', 'appointment_completed', 'no_show', 'review_requested', 'review_clicked', 'rebooking_confirmed', 'waitlist_joined'];
      if (config.firstPartyAnalyticsEnabled === true && consent === 'accepted' && allowed.indexOf(eventName) !== -1) {
        fetch('/api/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          keepalive: true,
          body: JSON.stringify({ eventName: eventName, path: location.pathname, source: 'website', properties: safe })
        }).catch(function () { /* la misurazione non blocca mai il sito */ });
      }
    } catch (e3) { /* no-op */ }
    if (config.debug) console.info('[trackEvent]', eventName, safe);
  }
  window.trackEvent = trackEvent;

  function initAnalyticsBootstrap() {
    var gaId = String(config.GA4_MEASUREMENT_ID || '').trim();
    var clarityId = String(config.CLARITY_PROJECT_ID || '').trim();
    var consent = null;
    try { consent = localStorage.getItem('sgarra_tracking_consent'); } catch (e) { consent = null; }
    if (consent !== 'accepted' || (!gaId && !clarityId)) return;
    if (gaId) {
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag('js', new Date());
      window.gtag('config', gaId, { anonymize_ip: true });
      var s = document.createElement('script');
      s.async = true;
      s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(gaId);
      document.head.appendChild(s);
    }
  }

  function initCookieBanner() {
    var banner = document.getElementById('cookie-banner');
    if (!banner) return;
    var hasIds = String(config.GA4_MEASUREMENT_ID || '').trim() || String(config.CLARITY_PROJECT_ID || '').trim() || config.firstPartyAnalyticsEnabled === true;
    if (!hasIds || !config.showCookieBannerWhenTracking) return;
    var consent = null;
    try { consent = localStorage.getItem('sgarra_tracking_consent'); } catch (e) { consent = null; }
    if (consent) return;
    banner.hidden = false;
    var accept = document.getElementById('cookie-accept');
    var decline = document.getElementById('cookie-decline');
    if (accept) accept.addEventListener('click', function () {
      try { localStorage.setItem('sgarra_tracking_consent', 'accepted'); } catch (e2) { /* no-op */ }
      banner.hidden = true;
      initAnalyticsBootstrap();
    });
    if (decline) decline.addEventListener('click', function () {
      try { localStorage.setItem('sgarra_tracking_consent', 'declined'); } catch (e3) { /* no-op */ }
      banner.hidden = true;
    });
  }

  function initClickTracking() {
    document.addEventListener('click', function (event) {
      var target = event.target.closest('[data-track]');
      if (!target) return;
      var name = target.getAttribute('data-track');
      if (name) trackEvent(name, {});
    });
    document.addEventListener('change', function (event) {
      var el = event.target;
      if (!el || !el.matches || !el.matches('[data-track-service]')) return;
      if (el.checked) trackEvent('service_select', { service: String(el.value || '').slice(0, 40) });
    });
  }

  /* ---------- Nav ---------- */
  function initMobileNav() {
    var nav = document.getElementById('main-nav');
    var toggle = document.getElementById('menu-toggle');
    if (!nav || !toggle) return;
    var lastFocus = null;
    function isOpen() { return nav.classList.contains('is-open'); }
    function openMenu() {
      lastFocus = document.activeElement;
      nav.classList.add('is-open');
      toggle.setAttribute('aria-expanded', 'true');
      toggle.setAttribute('aria-label', 'Chiudi il menu');
      document.body.classList.add('nav-open');
      var first = nav.querySelector('a');
      if (first) first.focus();
    }
    function closeMenu() {
      if (!isOpen()) return;
      nav.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Apri il menu');
      document.body.classList.remove('nav-open');
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }
    toggle.addEventListener('click', function () { isOpen() ? closeMenu() : openMenu(); });
    nav.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', closeMenu); });
    document.addEventListener('keydown', function (event) {
      if (!isOpen()) return;
      if (event.key === 'Escape') { event.preventDefault(); closeMenu(); return; }
      trapFocus(nav, event);
    });
    document.addEventListener('click', function (event) {
      if (!isOpen()) return;
      if (nav.contains(event.target) || toggle.contains(event.target)) return;
      closeMenu();
    });
  }

  function getHeaderOffset() {
    var header = document.querySelector('.site-header');
    var h = header ? header.getBoundingClientRect().height : 64;
    return Math.round(h + 12);
  }

  function scrollToId(id) {
    var el = typeof id === 'string' ? document.getElementById(String(id).replace(/^#/, '')) : id;
    if (!el) return;
    var jump = function () {
      var header = getHeaderOffset();
      var se = document.scrollingElement || document.documentElement;
      var y = se.scrollTop + el.getBoundingClientRect().top - header;
      se.scrollTop = Math.max(0, Math.round(y));
    };
    jump();
    window.requestAnimationFrame(function () {
      jump();
      window.requestAnimationFrame(jump);
    });
    window.setTimeout(jump, 80);
    window.setTimeout(jump, 180);
  }

  function initSmoothNav() {
    document.addEventListener('click', function (event) {
      var link = event.target.closest('a[href^="#"]');
      if (!link) return;
      var id = link.getAttribute('href');
      if (!id || id === '#') return;

      if (id === '#prenota') {
        event.preventDefault();
        openBooking({ source: link.getAttribute('data-track') || 'hash_prenota', link: link });
        return;
      }

      var target = document.querySelector(id);
      if (!target) return;
      event.preventDefault();
      scrollToId(id);
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      try { target.focus({ preventScroll: true }); } catch (e) { target.focus(); }
    });
  }

  function initReveal() {
    var items = Array.prototype.slice.call(document.querySelectorAll('.section-head, .paolo-copy, .paolo-media, .booking-shell, .dove-grid, .final-cta-inner, .service-card, .gallery-item'));
    items.forEach(function (el) { el.classList.add('reveal'); });
    if (!('IntersectionObserver' in window) || prefersReducedMotion()) {
      items.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }
    var obs = new IntersectionObserver(function (entries, o) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        o.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    items.forEach(function (el) { obs.observe(el); });
  }

  /* ---------- Lightbox ---------- */
  function initLightbox() {
    var root = document.getElementById('lightbox');
    var img = document.getElementById('lightbox-image');
    var caption = document.getElementById('lightbox-caption');
    var counter = document.getElementById('lightbox-counter');
    var prevBtn = document.getElementById('lightbox-prev');
    var nextBtn = document.getElementById('lightbox-next');
    if (!root || !img) return;
    var lastFocus = null;
    var touchStartX = 0;
    var touchStartY = 0;

    function visibleTriggers() {
      return galleryTriggers.filter(function (btn) {
        var fig = btn.closest('.gallery-item');
        return !fig || !fig.hidden;
      });
    }

    function showAt(index) {
      var items = visibleTriggers();
      if (!items.length) return;
      lightboxIndex = (index + items.length) % items.length;
      var btn = items[lightboxIndex];
      img.src = btn.getAttribute('data-gallery-src') || '';
      img.alt = btn.getAttribute('data-gallery-alt') || '';
      if (caption) caption.textContent = btn.getAttribute('data-gallery-caption') || '';
      if (counter) counter.textContent = (lightboxIndex + 1) + ' / ' + items.length;
    }

    function openLightbox(index) {
      lastFocus = document.activeElement;
      root.hidden = false;
      document.body.classList.add('lightbox-open');
      showAt(index);
      trackEvent('gallery_open', {});
      var closeBtn = root.querySelector('.lightbox-close');
      if (closeBtn) closeBtn.focus();
    }

    function closeLightbox() {
      if (root.hidden) return;
      root.hidden = true;
      img.removeAttribute('src');
      img.alt = '';
      document.body.classList.remove('lightbox-open');
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    document.addEventListener('click', function (event) {
      var btn = event.target.closest('.gallery-trigger');
      if (!btn) return;
      var items = visibleTriggers();
      var idx = items.indexOf(btn);
      openLightbox(idx >= 0 ? idx : 0);
    });

    if (prevBtn) prevBtn.addEventListener('click', function () {
      showAt(lightboxIndex - 1);
      trackEvent('gallery_swipe', { direction: 'prev' });
    });
    if (nextBtn) nextBtn.addEventListener('click', function () {
      showAt(lightboxIndex + 1);
      trackEvent('gallery_swipe', { direction: 'next' });
    });
    root.querySelectorAll('[data-lightbox-close]').forEach(function (el) {
      el.addEventListener('click', closeLightbox);
    });

    document.addEventListener('keydown', function (event) {
      if (root.hidden) return;
      if (event.key === 'Escape') { event.preventDefault(); closeLightbox(); return; }
      if (event.key === 'ArrowLeft') { showAt(lightboxIndex - 1); trackEvent('gallery_swipe', { direction: 'prev' }); }
      if (event.key === 'ArrowRight') { showAt(lightboxIndex + 1); trackEvent('gallery_swipe', { direction: 'next' }); }
      trapFocus(root.querySelector('.lightbox-dialog') || root, event);
    });

    var dialog = root.querySelector('.lightbox-dialog');
    if (dialog) {
      dialog.addEventListener('touchstart', function (event) {
        if (!event.changedTouches || !event.changedTouches[0]) return;
        touchStartX = event.changedTouches[0].clientX;
        touchStartY = event.changedTouches[0].clientY;
      }, { passive: true });
      dialog.addEventListener('touchend', function (event) {
        if (!event.changedTouches || !event.changedTouches[0]) return;
        var dx = event.changedTouches[0].clientX - touchStartX;
        var dy = event.changedTouches[0].clientY - touchStartY;
        if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return;
        if (dx < 0) { showAt(lightboxIndex + 1); trackEvent('gallery_swipe', { direction: 'next' }); }
        else { showAt(lightboxIndex - 1); trackEvent('gallery_swipe', { direction: 'prev' }); }
      }, { passive: true });
    }
  }

  /* ---------- Booking ---------- */
  function getSelectedServices() {
    return Array.prototype.slice.call(document.querySelectorAll('input[name="service"]:checked'))
      .map(function (el) { return normalizeWhitespace(el.value); })
      .filter(Boolean);
  }

  function getSelectedServiceIds() {
    return Array.prototype.slice.call(document.querySelectorAll('input[name="service"]:checked'))
      .map(function (el) { return normalizeWhitespace(el.getAttribute('data-service-id')); })
      .filter(Boolean);
  }

  function renderServiceChips(containerId) {
    var root = document.getElementById(containerId);
    if (!root) return;
    root.textContent = '';
    getSelectedServices().forEach(function (label) {
      var chip = document.createElement('span');
      chip.className = 'service-chip';
      var name = document.createElement('span');
      name.textContent = label;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'service-chip-remove';
      btn.setAttribute('aria-label', 'Rimuovi ' + label);
      btn.textContent = '×';
      btn.addEventListener('click', function () {
        document.querySelectorAll('input[name="service"]').forEach(function (inp) {
          if (normalizeWhitespace(inp.value) === label) inp.checked = false;
        });
        updateServiceUI();
      });
      chip.appendChild(name);
      chip.appendChild(btn);
      root.appendChild(chip);
    });
  }

  function updateServiceUI() {
    var services = getSelectedServices();
    var status = document.getElementById('service-status');
    var wizardBox = document.getElementById('wizard-selected-services');
    var wizardLabel = wizardBox ? wizardBox.querySelector('.service-chosen-label') : null;
    var continueBtn = document.getElementById('step-1-continue');
    var cta = document.getElementById('service-cta');

    if (status) {
      status.hidden = services.length === 0;
      renderServiceChips('service-chips');
    }
    if (wizardLabel) {
      wizardLabel.textContent = services.length ? 'Hai scelto' : 'Nessun servizio selezionato';
    }
    renderServiceChips('wizard-service-chips');
    if (continueBtn) continueBtn.disabled = services.length === 0;
    if (cta) cta.hidden = services.length === 0;

    if (liveBookingEnabled()) {
      var dateInput = document.getElementById('booking-date');
      if (dateInput && dateInput.value) loadAvailability();
      else resetAvailability('Scegli prima il giorno.');
    }

    if (!services.length && currentStep > 1) {
      goToStep(1, false);
    }
  }

  function entryBookingStep() {
    return getSelectedServices().length ? 2 : 1;
  }

  /**
   * Ingresso unico alla prenotazione.
   * options: { source, forceStep, focus, scroll, skipTrack }
   */
  function openBooking(options) {
    var opts = options || {};
    var services = getSelectedServices();
    var step = opts.forceStep != null ? Number(opts.forceStep) : (services.length ? 2 : 1);
    if (step < 1 || step > 3) step = services.length ? 2 : 1;

    goToStep(step, false);
    updateServiceUI();

    if (typeof history !== 'undefined' && history.replaceState) {
      try {
        history.replaceState(null, '', '#prenota');
      } catch (e2) { /* noop */ }
    }

    if (opts.scroll !== false) {
      window.requestAnimationFrame(function () {
        scrollToId('prenota');
      });
    }

    if (opts.focus !== false) {
      window.setTimeout(function () {
        var title = document.getElementById('step-' + step + '-title');
        if (title) {
          try { title.focus({ preventScroll: true }); } catch (e) { /* noop */ }
        }
        if (opts.scroll !== false) scrollToId('prenota');
      }, 60);
    }

    if (!opts.skipTrack) {
      trackEvent('booking_start', {
        source: opts.source || 'open_booking',
        step: step,
        services_count: services.length,
        skip_step_1: step === 2
      });
    }
  }

  function initOtherServicesDisclosure() {
    var details = document.getElementById('other-services');
    if (!details) return;
    var label = details.querySelector('.other-services-label');
    function sync() {
      if (!label) return;
      var open = details.open;
      label.textContent = open
        ? (label.getAttribute('data-open') || 'Nascondi altri servizi −')
        : (label.getAttribute('data-closed') || 'Altri servizi +');
    }
    details.addEventListener('toggle', sync);
    sync();
  }

  function initServiceSync() {
    document.addEventListener('change', function (event) {
      if (!event.target || !event.target.matches || !event.target.matches('input[name="service"]')) return;
      updateServiceUI();
      if (event.target.checked) trackEvent('service_select', { service: event.target.value });
    });

    var cta = document.getElementById('service-cta');
    if (cta) {
      cta.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        if (!getSelectedServices().length) return;
        openBooking({ source: 'services_continue' });
      });
    }

    var edit = document.getElementById('wizard-edit-services');
    if (edit) {
      edit.addEventListener('click', function (event) {
        event.preventDefault();
        var from = currentStep;
        goToStep(1, true);
        trackEvent('booking_step_back', { from: from, to: 1, via: 'modifica' });
      });
    }

    initOtherServicesDisclosure();
    updateServiceUI();
  }

  function syncDateDisplay() {
    var dateInput = document.getElementById('booking-date');
    var display = document.getElementById('date-display-text');
    var control = document.getElementById('date-control');
    if (!dateInput || !display || !control) return;
    var value = normalizeWhitespace(dateInput.value);
    if (!value) {
      display.textContent = 'Scegli il giorno';
      control.setAttribute('data-empty', 'true');
      dateInput.removeAttribute('aria-invalid');
      control.removeAttribute('data-invalid');
    } else {
      display.textContent = formatDateLongIT(value);
      control.setAttribute('data-empty', 'false');
    }
  }

  function openDatePicker() {
    var dateInput = document.getElementById('booking-date');
    if (!dateInput) return;
    if (typeof dateInput.showPicker === 'function') {
      try { dateInput.showPicker(); return; } catch (e) { /* fallback */ }
    }
    dateInput.focus();
    try { dateInput.click(); } catch (e2) { /* noop */ }
  }

  function syncBookingDateLimits() {
    var dateInput = document.getElementById('booking-date');
    if (!dateInput) return;
    dateInput.min = todayISO();
    var horizon = Number(runtimeBooking.bookingHorizonDays || 45);
    var maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + Math.max(1, Math.min(horizon, 365)));
    dateInput.max = maxDate.getFullYear() + '-' + String(maxDate.getMonth() + 1).padStart(2, '0') + '-' + String(maxDate.getDate()).padStart(2, '0');
  }

  function initDateControl() {
    var dateInput = document.getElementById('booking-date');
    var control = document.getElementById('date-control');
    if (!dateInput) return;
    syncBookingDateLimits();
    dateInput.value = '';
    syncDateDisplay();
    dateInput.addEventListener('input', syncDateDisplay);
    dateInput.addEventListener('change', function () {
      syncDateDisplay();
      if (liveBookingEnabled()) loadAvailability();
    });
    if (control) {
      control.addEventListener('click', function (event) {
        if (event.target === dateInput) return;
        openDatePicker();
      });
    }
    if (liveBookingEnabled()) resetAvailability('Scegli prima il giorno.');
  }

  function resetAvailability(message) {
    var select = document.getElementById('booking-time');
    var hint = document.getElementById('time-hint');
    if (!select) return;
    select.textContent = '';
    var option = document.createElement('option');
    option.value = '';
    option.textContent = 'Seleziona';
    select.appendChild(option);
    select.disabled = true;
    if (hint) hint.textContent = message || 'Scegli giorno e servizio.';
  }

  function showWaitlist(show) {
    var box = document.getElementById('waitlist-box');
    if (!box) return;
    box.hidden = !show;
    if (!show) {
      var status = document.getElementById('waitlist-status');
      if (status) status.textContent = '';
    }
  }

  async function loadAvailability() {
    if (!liveBookingEnabled()) return;
    var dateInput = document.getElementById('booking-date');
    var select = document.getElementById('booking-time');
    var hint = document.getElementById('time-hint');
    var serviceIds = getSelectedServiceIds();
    var date = normalizeWhitespace(dateInput && dateInput.value);
    if (!date || !serviceIds.length || !select) {
      resetAvailability(!serviceIds.length ? 'Seleziona prima almeno un servizio.' : 'Scegli prima il giorno.');
      showWaitlist(false);
      return;
    }

    resetAvailability('Controllo degli orari disponibili…');
    showWaitlist(false);
    try {
      var booking = runtimeBooking;
      var query = new URLSearchParams({
        date: date,
        staffSlug: booking.staffSlug || 'paolo-sgarra',
        serviceIds: serviceIds.join(',')
      });
      var response = await fetch(bookingApi('/availability') + '?' + query.toString(), {
        headers: { Accept: 'application/json' }
      });
      var payload = await response.json().catch(function () { return {}; });
      if (!response.ok) throw new Error((payload.error && payload.error.message) || 'Disponibilità non raggiungibile.');
      var slots = Array.isArray(payload.slots) ? payload.slots : [];
      select.textContent = '';
      var first = document.createElement('option');
      first.value = '';
      first.textContent = slots.length ? 'Seleziona un orario' : 'Nessun posto disponibile';
      select.appendChild(first);
      slots.forEach(function (slot) {
        var option = document.createElement('option');
        option.value = slot.starts_at || slot.startsAt || '';
        option.textContent = slot.label || new Date(option.value).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
        select.appendChild(option);
      });
      select.disabled = slots.length === 0;
      if (hint) hint.textContent = slots.length ? slots.length + ' orari realmente disponibili.' : 'Prova un altro giorno oppure entra in lista d’attesa.';
      showWaitlist(slots.length === 0);
      trackEvent('slot_view', { date: date, slots_count: slots.length });
    } catch (error) {
      resetAvailability(error.message || 'Disponibilità non raggiungibile.');
      showWaitlist(false);
    }
  }

  function configureBookingMode() {
    var live = liveBookingEnabled();
    var lead = document.getElementById('booking-lead');
    var submit = document.getElementById('booking-submit');
    var consentCopy = document.querySelector('#booking-consent + span');
    var faqConfirmation = document.getElementById('faq-confirmation-answer');
    if (!live) return;
    if (lead) lead.textContent = 'Scegli uno degli orari realmente disponibili. La richiesta viene registrata e Paolo la conferma.';
    if (submit) submit.innerHTML = 'Richiedi appuntamento <span class="btn-arrow" aria-hidden="true">→</span>';
    if (consentCopy) consentCopy.innerHTML = 'Ho letto l’<a href="privacy.html" target="_blank" rel="noopener noreferrer">informativa privacy</a> e chiedo la registrazione dell’appuntamento.';
    if (faqConfirmation) faqConfirmation.textContent = 'Lo slot viene riservato come richiesta e diventa definitivo quando Paolo lo conferma.';
  }

  function initBookingWizard() {
    var form = document.getElementById('booking-form');
    if (!form) return;
    configureBookingMode();
    initDateControl();
    initWaitlist();

    if (location.hash === '#prenota') {
      openBooking({ source: 'hash_load', skipTrack: true, instant: true });
    } else {
      goToStep(1, false);
    }

    window.addEventListener('hashchange', function () {
      if (location.hash === '#prenota') {
        openBooking({ source: 'hashchange', skipTrack: true });
      }
    });

    form.querySelectorAll('.wizard-next').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (currentStep === 1) {
          if (!validateStep1()) return;
          trackEvent('booking_step_continue', { from: 1, to: 2 });
          goToStep(2, true);
          return;
        }
        if (currentStep === 2) {
          if (!validateStep2()) return;
          trackEvent('booking_step_continue', { from: 2, to: 3 });
          updateSummary();
          goToStep(3, true);
        }
      });
    });

    form.querySelectorAll('.wizard-back').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var back = Number(btn.getAttribute('data-back'));
        trackEvent('booking_step_back', { from: currentStep, to: back });
        goToStep(back, true);
      });
    });

    var timeSelect = document.getElementById('booking-time');
    if (timeSelect) {
      timeSelect.addEventListener('change', function () {
        if (timeSelect.value) trackEvent('slot_selected', { live: liveBookingEnabled() });
      });
    }

    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      clearErrors();
      if (!validateStep1() || !validateStep2() || !validateStep3()) {
        trackEvent('booking_validation_error', { step: currentStep });
        return;
      }
      var data = collectData();
      var submit = document.getElementById('booking-submit');
      if (submit) submit.disabled = true;

      if (liveBookingEnabled()) {
        setStatus('Registrazione dell’appuntamento…');
        try {
          var response = await fetch(bookingApi('/appointments'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({
              serviceIds: data.serviceIds,
              staffSlug: runtimeBooking.staffSlug || 'paolo-sgarra',
              startsAt: data.time,
              name: data.name,
              phone: data.phone,
              email: data.email,
              notes: data.notes,
              privacyVersion: runtimeBooking.privacyVersion || '2026-09-01',
              idempotencyKey: bookingRequestKey,
              website: data.website
            })
          });
          var payload = await response.json().catch(function () { return {}; });
          if (!response.ok) throw new Error((payload.error && payload.error.message) || 'Registrazione non riuscita.');
          var success = document.getElementById('booking-success');
          var copy = document.getElementById('booking-success-copy');
          if (copy) {
            var depositCopy = payload.booking && payload.booking.depositRequired
              ? ' Per questa prenotazione Paolo ti invierà le istruzioni per la caparra.'
              : '';
            copy.textContent = 'Riferimento ' + (payload.booking && payload.booking.reference ? payload.booking.reference : 'registrato') + '. Riceverai la conferma usando il recapito indicato.' + depositCopy;
          }
          form.hidden = true;
          if (success) success.hidden = false;
          bookingRequestKey = createBookingRequestKey();
          trackEvent('booking_confirmed', { status: (payload.booking && payload.booking.status) || 'pending' });
          return;
        } catch (error) {
          setStatus(error.message || 'Registrazione non riuscita. Riprova o scrivi a Paolo.');
          if (submit) submit.disabled = false;
          if (/orario|disponibile/i.test(error.message || '')) loadAvailability();
          return;
        }
      }

      var message = buildWhatsAppMessage(data);
      trackEvent('booking_complete', { services_count: data.services.length, has_notes: Boolean(data.notes) });
      setStatus('Apertura di WhatsApp…');
      window.location.href = 'https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent(message);
    });
  }

  function goToStep(step, focusTitle) {
    currentStep = step;
    var form = document.getElementById('booking-form');
    if (!form) return;
    form.querySelectorAll('.wizard-step').forEach(function (panel) {
      var n = Number(panel.getAttribute('data-step'));
      var active = n === step;
      panel.hidden = !active;
      panel.classList.toggle('is-active', active);
      if (active) panel.setAttribute('aria-current', 'step');
      else panel.removeAttribute('aria-current');
    });
    var num = document.getElementById('wizard-step-num');
    if (num) num.textContent = String(step);
    form.querySelectorAll('.wizard-dots li').forEach(function (dot) {
      var n = Number(dot.getAttribute('data-dot'));
      dot.classList.toggle('is-active', n === step);
      dot.classList.toggle('is-done', n < step);
    });
    trackEvent('booking_step_view', { step: step });
    if (focusTitle) {
      var title = document.getElementById('step-' + step + '-title');
      if (title) title.focus();
    }
    if (step === 1) updateServiceUI();
    if (step === 3) updateSummary();
  }

  function clearErrors() {
    document.querySelectorAll('.field-error').forEach(function (el) { el.hidden = true; el.textContent = ''; });
    document.querySelectorAll('[aria-invalid="true"]').forEach(function (el) { el.removeAttribute('aria-invalid'); });
    var control = document.getElementById('date-control');
    if (control) control.removeAttribute('data-invalid');
    var summary = document.getElementById('error-summary');
    if (summary) summary.hidden = true;
    setStatus('');
  }

  function showFieldError(id, message) {
    var el = document.getElementById(id);
    if (!el) return;
    el.hidden = false;
    el.textContent = message;
  }

  function showErrorSummary(message) {
    var box = document.getElementById('error-summary');
    var text = document.getElementById('error-summary-text');
    if (!box || !text) return;
    text.textContent = message;
    box.hidden = false;
    box.focus();
  }

  function validateStep1() {
    clearErrors();
    if (!getSelectedServices().length) {
      showFieldError('services-error', 'Seleziona almeno un servizio.');
      showErrorSummary('Controlla il campo evidenziato.');
      var first = document.querySelector('input[name="service"]');
      if (first) first.focus();
      return false;
    }
    return true;
  }

  function validateStep2() {
    clearErrors();
    var dateEl = document.getElementById('booking-date');
    var timeEl = document.getElementById('booking-time');
    var control = document.getElementById('date-control');
    var date = normalizeWhitespace(dateEl && dateEl.value);
    var time = normalizeWhitespace(timeEl && timeEl.value);
    if (!date) {
      showFieldError('date-error', 'Scegli un giorno.');
      showErrorSummary('Controlla il campo evidenziato.');
      if (dateEl) {
        dateEl.setAttribute('aria-invalid', 'true');
        if (control) control.setAttribute('data-invalid', 'true');
        dateEl.focus();
      }
      return false;
    }
    if (date < todayISO()) {
      showFieldError('date-error', 'Il giorno non può essere precedente a oggi.');
      showErrorSummary('Controlla il campo evidenziato.');
      if (dateEl) {
        dateEl.setAttribute('aria-invalid', 'true');
        if (control) control.setAttribute('data-invalid', 'true');
        dateEl.focus();
      }
      return false;
    }
    if (control) control.removeAttribute('data-invalid');
    if (!time) {
      showFieldError('time-error', 'Seleziona un orario.');
      showErrorSummary('Controlla il campo evidenziato.');
      if (timeEl) { timeEl.setAttribute('aria-invalid', 'true'); timeEl.focus(); }
      return false;
    }
    return true;
  }

  function validateStep3() {
    clearErrors();
    var nameEl = document.getElementById('customer-name');
    var phoneEl = document.getElementById('customer-phone');
    var emailEl = document.getElementById('customer-email');
    var consentEl = document.getElementById('booking-consent');
    var name = normalizeWhitespace(nameEl && nameEl.value);
    var phone = normalizeWhitespace(phoneEl && phoneEl.value).replace(/[^0-9+]/g, '');
    var email = normalizeWhitespace(emailEl && emailEl.value);
    if (!name) {
      showFieldError('name-error', 'Inserisci il tuo nome.');
      showErrorSummary('Controlla il campo evidenziato.');
      if (nameEl) { nameEl.setAttribute('aria-invalid', 'true'); nameEl.focus(); }
      return false;
    }
    if (!/^(?:\+|00)?[0-9]{8,15}$/.test(phone)) {
      showFieldError('phone-error', 'Inserisci un numero di telefono valido.');
      showErrorSummary('Controlla il campo evidenziato.');
      if (phoneEl) { phoneEl.setAttribute('aria-invalid', 'true'); phoneEl.focus(); }
      return false;
    }
    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      showFieldError('email-error', 'Inserisci un indirizzo email valido.');
      showErrorSummary('Controlla il campo evidenziato.');
      if (emailEl) { emailEl.setAttribute('aria-invalid', 'true'); emailEl.focus(); }
      return false;
    }
    if (!consentEl || !consentEl.checked) {
      showFieldError('consent-error', 'Conferma di aver letto la nota su WhatsApp.');
      showErrorSummary('Controlla il campo evidenziato.');
      if (consentEl) { consentEl.setAttribute('aria-invalid', 'true'); consentEl.focus(); }
      return false;
    }
    return true;
  }

  function collectData() {
    return {
      services: getSelectedServices(),
      serviceIds: getSelectedServiceIds(),
      name: normalizeWhitespace(document.getElementById('customer-name') && document.getElementById('customer-name').value),
      phone: normalizeWhitespace(document.getElementById('customer-phone') && document.getElementById('customer-phone').value),
      email: normalizeWhitespace(document.getElementById('customer-email') && document.getElementById('customer-email').value),
      date: normalizeWhitespace(document.getElementById('booking-date') && document.getElementById('booking-date').value),
      time: normalizeWhitespace(document.getElementById('booking-time') && document.getElementById('booking-time').value),
      notes: normalizeWhitespace(document.getElementById('booking-notes') && document.getElementById('booking-notes').value),
      website: normalizeWhitespace(document.getElementById('booking-website') && document.getElementById('booking-website').value)
    };
  }

  function updateSummary() {
    var box = document.getElementById('booking-summary');
    if (!box) return;
    var data = collectData();
    box.innerHTML =
      '<strong>Riepilogo</strong><br>' +
      'Servizi: ' + escapeHtml(data.services.join(', ') || '—') + '<br>' +
      'Giorno: ' + escapeHtml(formatDateIT(data.date) || '—') + '<br>' +
      'Orario: ' + escapeHtml(liveBookingEnabled() && data.time
        ? new Date(data.time).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
        : (data.time || '—')) +
      (data.name ? '<br>Nome: ' + escapeHtml(data.name) : '') +
      (data.phone ? '<br>Telefono: ' + escapeHtml(data.phone) : '') +
      (data.email ? '<br>Email: ' + escapeHtml(data.email) : '') +
      (data.notes ? '<br>Note: ' + escapeHtml(data.notes) : '');
  }

  function buildWhatsAppMessage(data) {
    var lines = [
      'Ciao Paolo, vorrei richiedere un appuntamento.',
      '',
      'Servizio: ' + data.services.join(', '),
      'Giorno: ' + formatDateIT(data.date),
      'Orario preferito: ' + data.time,
      'Nome: ' + data.name,
      'Telefono: ' + data.phone
    ];
    if (data.notes) lines.push('Note: ' + data.notes);
    lines.push('', 'Attendo la tua conferma, grazie.');
    return lines.join('\n');
  }

  function initWaitlist() {
    var submit = document.getElementById('waitlist-submit');
    if (!submit) return;
    submit.addEventListener('click', async function () {
      var name = normalizeWhitespace(document.getElementById('waitlist-name') && document.getElementById('waitlist-name').value);
      var phone = normalizeWhitespace(document.getElementById('waitlist-phone') && document.getElementById('waitlist-phone').value);
      var email = normalizeWhitespace(document.getElementById('waitlist-email') && document.getElementById('waitlist-email').value);
      var consent = document.getElementById('waitlist-consent');
      var status = document.getElementById('waitlist-status');
      var date = normalizeWhitespace(document.getElementById('booking-date') && document.getElementById('booking-date').value);
      if (name.length < 2 || !/^(?:\+|00)?[0-9\s-]{8,20}$/.test(phone) || (email && !/^\S+@\S+\.\S+$/.test(email)) || !consent || !consent.checked) {
        if (status) status.textContent = 'Inserisci nome, telefono valido e accetta l’informativa.';
        return;
      }
      submit.disabled = true;
      if (status) status.textContent = 'Inserimento nella lista…';
      try {
        var response = await fetch(bookingApi('/waitlist'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            serviceIds: getSelectedServiceIds(),
            staffSlug: runtimeBooking.staffSlug || 'paolo-sgarra',
            desiredDate: date,
            timePreference: document.getElementById('waitlist-time').value,
            name: name,
            phone: phone,
            email: email,
            notes: '',
            privacyVersion: runtimeBooking.privacyVersion || '2026-09-01',
            idempotencyKey: createBookingRequestKey().replace(/^booking_/, 'waitlist_'),
            website: normalizeWhitespace(document.getElementById('booking-website') && document.getElementById('booking-website').value)
          })
        });
        var payload = await response.json().catch(function () { return {}; });
        if (!response.ok) throw new Error((payload.error && payload.error.message) || 'Iscrizione non riuscita.');
        if (status) status.textContent = 'Sei in lista. Riferimento ' + (payload.waitlist && payload.waitlist.reference ? payload.waitlist.reference : 'registrato') + '.';
        submit.textContent = 'Inserito in lista';
        trackEvent('waitlist_joined', { services_count: getSelectedServiceIds().length });
      } catch (error) {
        if (status) status.textContent = error.message || 'Iscrizione non riuscita.';
        submit.disabled = false;
      }
    });
  }

  function setStatus(text) {
    var status = document.getElementById('form-status');
    if (status) status.textContent = text || '';
  }

  function zoneVisible(el, minVisiblePx) {
    if (!el) return false;
    var rect = el.getBoundingClientRect();
    var vh = window.innerHeight || document.documentElement.clientHeight;
    var visible = Math.min(rect.bottom, vh) - Math.max(rect.top, 0);
    return visible >= (minVisiblePx || 48);
  }

  function measureStickyZones() {
    stickyZones.hero = zoneVisible(document.querySelector('.hero'), Math.round((window.innerHeight || 600) * 0.42));
    stickyZones.prenota = zoneVisible(document.getElementById('prenota'), Math.round((window.innerHeight || 600) * 0.2));
    stickyZones.finalCta = zoneVisible(document.querySelector('.final-cta'), 48);
    stickyZones.footer = zoneVisible(document.querySelector('.site-footer'), 24);
  }

  function updateStickyVisibility() {
    var sticky = document.getElementById('sticky-cta');
    if (!sticky) return;
    var hide =
      stickyZones.hero ||
      stickyZones.prenota ||
      stickyZones.finalCta ||
      stickyZones.footer ||
      document.body.classList.contains('keyboard-open') ||
      document.body.classList.contains('nav-open') ||
      document.body.classList.contains('lightbox-open') ||
      document.body.classList.contains('dialog-open');

    document.body.classList.toggle('sticky-hidden', hide);
    sticky.classList.toggle('is-hidden', hide);
    sticky.setAttribute('aria-hidden', hide ? 'true' : 'false');
    if (hide) sticky.style.bottom = '';
  }

  function scheduleStickyUpdate() {
    if (stickyRaf) return;
    stickyRaf = window.requestAnimationFrame(function () {
      stickyRaf = 0;
      measureStickyZones();
      updateStickyVisibility();
    });
  }

  function initStickyBar() {
    function refreshKeyboardState() {
      var active = document.activeElement;
      var focused = !!(active && active.matches && active.matches('input, textarea, select'));
      document.body.classList.toggle('keyboard-open', focused);
      scheduleStickyUpdate();
    }

    document.addEventListener('focusin', function (event) {
      var t = event.target;
      if (t && t.matches && t.matches('input, textarea, select')) {
        document.body.classList.add('keyboard-open');
        updateStickyVisibility();
      }
    });
    document.addEventListener('focusout', function () {
      window.setTimeout(refreshKeyboardState, 60);
    });

    window.addEventListener('scroll', scheduleStickyUpdate, { passive: true });
    window.addEventListener('resize', scheduleStickyUpdate);

    if ('IntersectionObserver' in window) {
      ['.hero', '#prenota', '.final-cta', '.site-footer'].forEach(function (sel) {
        var el = document.querySelector(sel);
        if (!el) return;
        var io = new IntersectionObserver(function () { scheduleStickyUpdate(); }, {
          threshold: [0, 0.1, 0.25, 0.5, 0.75, 1],
          rootMargin: '0px'
        });
        io.observe(el);
      });
    }

    if (window.visualViewport) {
      var lastVvH = window.visualViewport.height;
      window.visualViewport.addEventListener('resize', function () {
        var h = window.visualViewport.height;
        var active = document.activeElement;
        var focused = !!(active && active.matches && active.matches('input, textarea, select'));
        if (focused && lastVvH - h > 80) document.body.classList.add('keyboard-open');
        else if (!focused) document.body.classList.remove('keyboard-open');
        lastVvH = h;
        scheduleStickyUpdate();
      });
      window.visualViewport.addEventListener('scroll', function () {
        var sticky = document.getElementById('sticky-cta');
        if (!sticky || document.body.classList.contains('sticky-hidden')) {
          if (sticky) sticky.style.bottom = '';
          return;
        }
        sticky.style.bottom = Math.max(0, window.innerHeight - window.visualViewport.height - window.visualViewport.offsetTop) + 'px';
      });
    }

    var mo = new MutationObserver(function (mutations) {
      var relevant = mutations.some(function (m) {
        if (m.attributeName !== 'class') return false;
        var cls = document.body.className;
        return /(?:^|\s)(nav-open|lightbox-open|keyboard-open|dialog-open)(?:\s|$)/.test(cls) ||
          m.oldValue && /nav-open|lightbox-open|keyboard-open|dialog-open/.test(m.oldValue);
      });
      if (relevant) scheduleStickyUpdate();
    });
    mo.observe(document.body, { attributes: true, attributeFilter: ['class'], attributeOldValue: true });
    measureStickyZones();
    updateStickyVisibility();
  }

  function initPwa() {
    if (config.pwaEnabled !== true || !('serviceWorker' in navigator)) return;
    var installPrompt = null;
    var installButton = document.getElementById('install-app');
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js').catch(function () {
        if (config.debug && window.console) console.warn('Service worker non registrato.');
      });
    });
    window.addEventListener('beforeinstallprompt', function (event) {
      event.preventDefault();
      installPrompt = event;
      if (installButton) installButton.hidden = false;
    });
    window.addEventListener('appinstalled', function () {
      installPrompt = null;
      if (installButton) installButton.hidden = true;
      trackEvent('pwa_installed', {});
    });
    if (installButton) {
      var ios = /iphone|ipad|ipod/i.test(navigator.userAgent || '');
      var standalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
      if (ios && !standalone) installButton.hidden = false;
      installButton.addEventListener('click', async function () {
        if (installPrompt) {
          installPrompt.prompt();
          await installPrompt.userChoice;
          installPrompt = null;
          installButton.hidden = true;
          return;
        }
        alert('Su iPhone o iPad: tocca Condividi e poi “Aggiungi alla schermata Home”.');
      });
    }
  }
})();
