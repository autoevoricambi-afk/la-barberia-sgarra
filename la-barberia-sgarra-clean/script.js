'use strict';

/**
 * La Barberia Sgarra — application script
 * Moduli: config, analytics, nav, smooth scroll, reveal, lightbox, booking, year, SEO URL
 */
(function initApp() {
  document.documentElement.classList.add('js');

  var config = window.SITE_CONFIG || {};
  var WHATSAPP = String(config.whatsappNumber || '393296410828');

  initSeoUrls();
  initYear();
  initAnalyticsBootstrap();
  initClickTracking();
  initMobileNav();
  initSmoothNav();
  initReveal();
  initLightbox();
  initBookingForm();
  initCookieBanner();

  /* ---------- Config / SEO ---------- */
  function initSeoUrls() {
    var base = String(config.siteUrl || '').replace(/\/$/, '');
    if (!base) return;

    var canonical = document.getElementById('canonical-link');
    var ogUrl = document.getElementById('og-url');
    var ogImage = document.getElementById('og-image');
    var twImage = document.getElementById('twitter-image');

    if (canonical) canonical.setAttribute('href', base + '/');
    if (ogUrl) ogUrl.setAttribute('content', base + '/');
    if (ogImage) {
      var ogSrc = ogImage.getAttribute('content') || '';
      if (ogSrc && ogSrc.indexOf('http') !== 0) {
        ogImage.setAttribute('content', base + '/' + ogSrc.replace(/^\//, ''));
      }
    }
    if (twImage) {
      var twSrc = twImage.getAttribute('content') || '';
      if (twSrc && twSrc.indexOf('http') !== 0) {
        twImage.setAttribute('content', base + '/' + twSrc.replace(/^\//, ''));
      }
    }
  }

  function initYear() {
    var yearEl = document.getElementById('year');
    if (yearEl) yearEl.textContent = String(new Date().getFullYear());
  }

  /* ---------- Analytics ---------- */
  function trackEvent(eventName, parameters) {
    var params = parameters && typeof parameters === 'object' ? parameters : {};
    var safe = {};
    Object.keys(params).forEach(function (key) {
      if (/name|phone|note|email|message/i.test(key)) return;
      safe[key] = params[key];
    });

    try {
      if (Array.isArray(window.dataLayer)) {
        window.dataLayer.push(Object.assign({ event: eventName }, safe));
      }
    } catch (err) {
      /* no-op */
    }

    try {
      if (typeof window.gtag === 'function') {
        window.gtag('event', eventName, safe);
      }
    } catch (err2) {
      /* no-op */
    }

    if (config.debug) {
      console.info('[trackEvent]', eventName, safe);
    }
  }

  window.trackEvent = trackEvent;

  function initAnalyticsBootstrap() {
    var gaId = String(config.GA4_MEASUREMENT_ID || '').trim();
    var clarityId = String(config.CLARITY_PROJECT_ID || '').trim();
    var consent = null;

    try {
      consent = localStorage.getItem('sgarra_tracking_consent');
    } catch (e) {
      consent = null;
    }

    if (consent !== 'accepted') return;
    if (!gaId && !clarityId) return;

    if (gaId) loadGA4(gaId);
    if (clarityId) loadClarity(clarityId);
  }

  function loadGA4(id) {
    if (document.getElementById('ga4-script')) return;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() {
      window.dataLayer.push(arguments);
    };
    window.gtag('js', new Date());
    window.gtag('config', id, { anonymize_ip: true });

    var s = document.createElement('script');
    s.id = 'ga4-script';
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
    document.head.appendChild(s);
  }

  function loadClarity(id) {
    if (window.clarity) return;
    (function (c, l, a, r, i, t, y) {
      c[a] =
        c[a] ||
        function () {
          (c[a].q = c[a].q || []).push(arguments);
        };
      t = l.createElement(r);
      t.async = 1;
      t.src = 'https://www.clarity.ms/tag/' + i;
      y = l.getElementsByTagName(r)[0];
      y.parentNode.insertBefore(t, y);
    })(window, document, 'clarity', 'script', id);
  }

  function initCookieBanner() {
    var banner = document.getElementById('cookie-banner');
    if (!banner) return;

    var hasIds =
      String(config.GA4_MEASUREMENT_ID || '').trim() ||
      String(config.CLARITY_PROJECT_ID || '').trim();
    if (!hasIds || !config.showCookieBannerWhenTracking) return;

    var consent = null;
    try {
      consent = localStorage.getItem('sgarra_tracking_consent');
    } catch (e) {
      consent = null;
    }
    if (consent) return;

    banner.hidden = false;

    var accept = document.getElementById('cookie-accept');
    var decline = document.getElementById('cookie-decline');

    if (accept) {
      accept.addEventListener('click', function () {
        try {
          localStorage.setItem('sgarra_tracking_consent', 'accepted');
        } catch (e2) {
          /* no-op */
        }
        banner.hidden = true;
        initAnalyticsBootstrap();
      });
    }

    if (decline) {
      decline.addEventListener('click', function () {
        try {
          localStorage.setItem('sgarra_tracking_consent', 'declined');
        } catch (e3) {
          /* no-op */
        }
        banner.hidden = true;
      });
    }
  }

  function initClickTracking() {
    document.addEventListener('click', function (event) {
      var target = event.target.closest('[data-track]');
      if (!target) return;
      var name = target.getAttribute('data-track');
      if (!name) return;
      trackEvent(name, { location: getSectionId(target) });
    });

    document.addEventListener('change', function (event) {
      var el = event.target;
      if (!el || !el.matches || !el.matches('[data-track-service]')) return;
      if (el.checked) {
        trackEvent('service_select', { service: String(el.value || '').slice(0, 40) });
      }
    });
  }

  function getSectionId(el) {
    var section = el.closest('section, header, footer, .sticky-cta');
    return section && section.id ? section.id : section && section.className ? String(section.className).split(' ')[0] : 'unknown';
  }

  /* ---------- Mobile navigation ---------- */
  function initMobileNav() {
    var nav = document.getElementById('main-nav');
    var toggle = document.getElementById('menu-toggle');
    if (!nav || !toggle) return;

    var lastFocus = null;

    function isOpen() {
      return nav.classList.contains('is-open');
    }

    function openMenu() {
      lastFocus = document.activeElement;
      nav.classList.add('is-open');
      toggle.setAttribute('aria-expanded', 'true');
      toggle.setAttribute('aria-label', 'Chiudi il menu');
      document.body.classList.add('nav-open');
      var firstLink = nav.querySelector('a');
      if (firstLink) firstLink.focus();
    }

    function closeMenu() {
      if (!isOpen()) return;
      nav.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Apri il menu');
      document.body.classList.remove('nav-open');
      if (lastFocus && typeof lastFocus.focus === 'function') {
        lastFocus.focus();
      } else {
        toggle.focus();
      }
    }

    toggle.addEventListener('click', function () {
      if (isOpen()) closeMenu();
      else openMenu();
    });

    nav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', closeMenu);
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && isOpen()) {
        event.preventDefault();
        closeMenu();
      }
    });

    document.addEventListener('click', function (event) {
      if (!isOpen()) return;
      if (nav.contains(event.target) || toggle.contains(event.target)) return;
      closeMenu();
    });
  }

  /* ---------- Smooth navigation ---------- */
  function initSmoothNav() {
    document.addEventListener('click', function (event) {
      var link = event.target.closest('a[href^="#"]');
      if (!link) return;
      var id = link.getAttribute('href');
      if (!id || id === '#') return;
      var target = document.querySelector(id);
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    });
  }

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /* ---------- Reveal ---------- */
  function initReveal() {
    var items = Array.prototype.slice.call(document.querySelectorAll('.section-head, .service, .gallery-item, .steps li, .booking-intro, .booking-form, .contact-panel, .faq-item, .trust-item, .final-cta-inner'));
    items.forEach(function (el) {
      el.classList.add('reveal');
    });

    if (!('IntersectionObserver' in window) || prefersReducedMotion()) {
      items.forEach(function (el) {
        el.classList.add('is-visible');
      });
      return;
    }

    var observer = new IntersectionObserver(
      function (entries, obs) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          obs.unobserve(entry.target);
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.1 }
    );

    items.forEach(function (el) {
      observer.observe(el);
    });
  }

  /* ---------- Lightbox ---------- */
  function initLightbox() {
    var root = document.getElementById('lightbox');
    var img = document.getElementById('lightbox-image');
    if (!root || !img) return;

    var lastFocus = null;
    var triggers = Array.prototype.slice.call(document.querySelectorAll('.gallery-trigger'));

    function openLightbox(src, alt) {
      lastFocus = document.activeElement;
      img.src = src;
      img.alt = alt || '';
      root.hidden = false;
      document.body.classList.add('nav-open');
      var closeBtn = root.querySelector('.lightbox-close');
      if (closeBtn) closeBtn.focus();
      trackEvent('gallery_interaction', { action: 'open' });
    }

    function closeLightbox() {
      if (root.hidden) return;
      root.hidden = true;
      img.removeAttribute('src');
      img.alt = '';
      document.body.classList.remove('nav-open');
      if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
    }

    triggers.forEach(function (btn) {
      btn.addEventListener('click', function () {
        openLightbox(btn.getAttribute('data-gallery-src'), btn.getAttribute('data-gallery-alt'));
      });
    });

    root.querySelectorAll('[data-lightbox-close]').forEach(function (el) {
      el.addEventListener('click', closeLightbox);
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !root.hidden) {
        event.preventDefault();
        closeLightbox();
      }
    });
  }

  /* ---------- Booking form ---------- */
  function initBookingForm() {
    var form = document.getElementById('booking-form');
    if (!form) return;

    var dateInput = document.getElementById('booking-date');
    if (dateInput) {
      dateInput.min = todayISO();
    }

    var heroCta = document.getElementById('hero-whatsapp-cta');
    if (heroCta && heroCta.getAttribute('href') === '#prenota') {
      /* keep scroll to form; tracking already on data-track */
    }

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      clearErrors(form);

      var result = validateBooking(form);
      if (!result.valid) {
        trackEvent('booking_validation_error', { field: result.firstField || 'unknown' });
        showError(result.firstField, result.message);
        focusField(result.firstField);
        setStatus('');
        return;
      }

      var message = buildWhatsAppMessage(result.data);
      var url = 'https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent(message);
      trackEvent('whatsapp_booking_submit', {
        services_count: result.data.services.length,
        has_notes: Boolean(result.data.notes)
      });
      setStatus('Apertura di WhatsApp…');
      window.location.href = url;
    });
  }

  function todayISO() {
    var d = new Date();
    var yyyy = d.getFullYear();
    var mm = String(d.getMonth() + 1).padStart(2, '0');
    var dd = String(d.getDate()).padStart(2, '0');
    return yyyy + '-' + mm + '-' + dd;
  }

  function normalizeWhitespace(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function formatDateIT(iso) {
    if (!iso) return '';
    var parts = iso.split('-');
    if (parts.length !== 3) return iso;
    return parts[2] + '/' + parts[1] + '/' + parts[0];
  }

  function validateBooking(form) {
    var formData = new FormData(form);
    var services = formData.getAll('service').map(normalizeWhitespace).filter(Boolean);
    var name = normalizeWhitespace(formData.get('customerName'));
    var phone = normalizeWhitespace(formData.get('customerPhone'));
    var date = normalizeWhitespace(formData.get('bookingDate'));
    var time = normalizeWhitespace(formData.get('bookingTime'));
    var notes = normalizeWhitespace(formData.get('bookingNotes'));
    var consent = formData.get('consent');

    if (!services.length) {
      return { valid: false, firstField: 'services', message: 'Seleziona almeno un servizio.' };
    }
    if (!name) {
      return { valid: false, firstField: 'customer-name', message: 'Inserisci nome e cognome.' };
    }
    if (!phone || phone.replace(/\D/g, '').length < 8) {
      return { valid: false, firstField: 'customer-phone', message: 'Inserisci un numero di telefono valido.' };
    }
    if (!date) {
      return { valid: false, firstField: 'booking-date', message: 'Scegli un giorno preferito.' };
    }
    if (date < todayISO()) {
      return { valid: false, firstField: 'booking-date', message: 'Il giorno non può essere precedente a oggi.' };
    }
    if (!time) {
      return { valid: false, firstField: 'booking-time', message: 'Seleziona una fascia oraria.' };
    }
    if (!consent) {
      return {
        valid: false,
        firstField: 'booking-consent',
        message: 'Conferma di aver compreso che l’orario va confermato in chat.'
      };
    }

    return {
      valid: true,
      data: {
        services: services,
        name: name,
        phone: phone,
        date: date,
        time: time,
        notes: notes
      }
    };
  }

  function buildWhatsAppMessage(data) {
    var lines = [
      'Buongiorno, vorrei richiedere un appuntamento presso La Barberia Sgarra.',
      '',
      'Nome: ' + data.name,
      'Telefono: ' + data.phone,
      'Servizio: ' + data.services.join(', '),
      'Giorno preferito: ' + formatDateIT(data.date),
      'Orario preferito: ' + data.time
    ];
    if (data.notes) lines.push('Note: ' + data.notes);
    lines.push('', 'Resto in attesa di conferma, grazie.');
    return lines.join('\n');
  }

  function clearErrors(form) {
    form.querySelectorAll('.field-error').forEach(function (el) {
      el.hidden = true;
      el.textContent = '';
    });
    form.querySelectorAll('[aria-invalid="true"]').forEach(function (el) {
      el.removeAttribute('aria-invalid');
    });
    var group = form.querySelector('.choice-grid');
    if (group) group.removeAttribute('aria-invalid');
  }

  function showError(fieldKey, message) {
    var map = {
      services: { error: 'services-error', control: '.choice-grid' },
      'customer-name': { error: 'name-error', control: '#customer-name' },
      'customer-phone': { error: 'phone-error', control: '#customer-phone' },
      'booking-date': { error: 'date-error', control: '#booking-date' },
      'booking-time': { error: 'time-error', control: '#booking-time' },
      'booking-consent': { error: 'consent-error', control: '#booking-consent' }
    };
    var entry = map[fieldKey];
    if (!entry) return;
    var errorEl = document.getElementById(entry.error);
    if (errorEl) {
      errorEl.hidden = false;
      errorEl.textContent = message;
    }
    var control = document.querySelector(entry.control);
    if (control) control.setAttribute('aria-invalid', 'true');
  }

  function focusField(fieldKey) {
    if (fieldKey === 'services') {
      var first = document.querySelector('input[name="service"]');
      if (first) first.focus();
      return;
    }
    var el = document.getElementById(fieldKey);
    if (el) el.focus();
  }

  function setStatus(text) {
    var status = document.getElementById('form-status');
    if (status) status.textContent = text || '';
  }
})();
