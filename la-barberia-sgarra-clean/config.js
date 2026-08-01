/**
 * Configurazione sito — La Barberia Sgarra
 * Compilare gli ID prima di attivare analytics.
 * Non inserire dati personali dei clienti.
 */
window.SITE_CONFIG = Object.freeze({
  /** Dominio definitivo con https, senza slash finale. Lasciare vuoto finché non verificato. */
  siteUrl: '',

  /** Numero WhatsApp in formato internazionale senza + */
  whatsappNumber: '393296410828',

  /** Telefono visualizzato / tel: */
  phoneDisplay: '+39 329 641 0828',
  phoneHref: 'tel:+393296410828',

  /** Instagram */
  instagramUrl: 'https://www.instagram.com/la_barberia_sgarra/',
  instagramHandle: '@la_barberia_sgarra',

  /** Maps query verificata dai dati in repository */
  mapsUrl:
    'https://www.google.com/maps/search/?api=1&query=La%20Barberia%20Sgarra%20Via%20Corato%2048%20Andria',

  /** Analytics — lasciare vuoti per tenere disattivati */
  GA4_MEASUREMENT_ID: '',
  CLARITY_PROJECT_ID: '',

  /** true = log eventi in console (senza dati sensibili) */
  debug: false,

  /** Cookie banner: mostrato solo se analytics/Clarity attivi */
  showCookieBannerWhenTracking: true
});
