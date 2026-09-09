/**
 * La Barberia Sgarra — configurazione centrale
 * Compilare solo dati verificati. Non inventare orari/giorni/prezzi/recensioni.
 */
window.SITE_CONFIG = Object.freeze({
  /**
   * launchReady resta false finché dominio, contenuti, privacy e booking
   * non superano la checklist di lancio. In staging il sito resta noindex.
   */
  launchReady: false,
  siteUrl: 'https://labarberiasgarra.it',
  legalName: 'La Barberia Sgarra di Sgarra Paolo',
  vatNumber: '08703770720',
  foundingDate: '',
  priceRange: '',
  googleBusinessUrl: 'https://share.google/LM2DalvQ9mnTZB1kh',

  /**
   * Il fallback resta protetto; /api/public-config abilita live soltanto
   * quando il database conferma catalogo e booking attivi.
   */
  booking: {
    mode: 'request',
    apiBase: '/api',
    staffSlug: 'paolo-sgarra',
    serviceCatalogReady: false,
    privacyVersion: '2026-09-01',
    bookingHorizonDays: 45
  },
  pwaEnabled: true,

  whatsappNumber: '393296410828',
  phoneDisplay: '+39 329 641 0828',
  phoneHref: 'tel:+393296410828',

  address: {
    street: 'Via Corato 48',
    city: 'Andria',
    postalCode: '76123',
    region: 'BT',
    country: 'IT',
    label: 'Via Corato 48, Andria'
  },

  mapsUrl: 'https://share.google/LM2DalvQ9mnTZB1kh',

  instagramUrl: 'https://www.instagram.com/la_barberia_sgarra/',
  instagramHandle: '@la_barberia_sgarra',

  openingHoursApproved: true,
  openingHours: {
    verified: true,
    note: 'Mar–Gio 08:30–13:00 / 15:30–20:30 · Ven 08:30–13:00 / 14:30–20:30 · Sab 08:30–20:30 · Lun e Dom chiuso',
    days: [
      { weekday: 2, opensAt: '08:30', closesAt: '13:00' },
      { weekday: 2, opensAt: '15:30', closesAt: '20:30' },
      { weekday: 3, opensAt: '08:30', closesAt: '13:00' },
      { weekday: 3, opensAt: '15:30', closesAt: '20:30' },
      { weekday: 4, opensAt: '08:30', closesAt: '13:00' },
      { weekday: 4, opensAt: '15:30', closesAt: '20:30' },
      { weekday: 5, opensAt: '08:30', closesAt: '13:00' },
      { weekday: 5, opensAt: '14:30', closesAt: '20:30' },
      { weekday: 6, opensAt: '08:30', closesAt: '20:30' }
    ]
  },

  paoloBioApproved: false,
  barber: {
    name: 'Paolo Sgarra',
    bioApproved: false,
    bio: 'Ogni taglio parte dall’ascolto. Forma, proporzioni e dettagli vengono costruiti sulla persona, non copiati da una fotografia.',
    bioNeutral: 'Dietro ogni lavoro c’è Paolo Sgarra, il barbiere della Barberia Sgarra ad Andria.'
  },

  studioMediaApproved: true,
  locationMediaApproved: false,

  /** Fallback coerente con il listino reale; in live viene aggiornato dall’API. */
  services: {
    primary: [
      { id: 'taglio', label: 'Taglio', desc: 'Taglio uomo · 30 min · €12,00' },
      { id: 'taglio-shampoo', label: 'Taglio + shampoo', desc: 'Taglio con shampoo · 30 min · €15,00' },
      { id: 'taglio-barba', label: 'Taglio + barba', desc: 'Taglio e barba · 30 min · €17,00' },
      { id: 'taglio-baby', label: 'Taglio baby', desc: 'Taglio bambino · 30 min · €10,00' },
      { id: 'completo', label: 'Completo', desc: 'Servizio completo · 30 min · €23,00' }
    ],
    secondary: [
      { id: 'barba', label: 'Barba', desc: 'Servizio barba · 30 min · €6,00' },
      { id: 'barba-old-school', label: 'Barba old school', desc: 'Servizio barba old school · 30 min · €9,00' },
      { id: 'sopracciglia', label: 'Sopracciglia', desc: 'Sistemazione sopracciglia · 30 min · €3,00' },
      { id: 'shampoo', label: 'Shampoo', desc: 'Shampoo · 30 min · €5,00' },
      { id: 'pettinata', label: 'Pettinata', desc: 'Pettinata e styling · 30 min · €3,00' }
    ]
  },

  gallery: [
    { src: 'assets/images/gallery/taglio-8.webp', fallback: 'assets/images/gallery/taglio-8.jpg', w: 322, h: 423, alt: 'Sfumatura laterale e cima texturizzata', caption: 'Sfumatura', span: 'tall' },
    { src: 'assets/images/gallery/taglio-13.webp', fallback: 'assets/images/gallery/taglio-13.jpg', w: 324, h: 424, alt: 'Skin fade con cima pettinata', caption: 'Fade', span: '' },
    { src: 'assets/images/gallery/taglio-18.webp', fallback: 'assets/images/gallery/taglio-18.jpg', w: 323, h: 406, alt: 'Fade con frangia in negozio', caption: 'In negozio', span: '' },
    { src: 'assets/images/gallery/taglio-19.webp', fallback: 'assets/images/gallery/taglio-19.jpg', w: 325, h: 406, alt: 'Low taper con line-up', caption: 'Line-up', span: 'wide' },
    { src: 'assets/images/gallery/taglio-14.webp', fallback: 'assets/images/gallery/taglio-14.jpg', w: 323, h: 406, alt: 'Cliente dopo il taglio in poltrona', caption: 'Risultato', span: '' },
    { src: 'assets/images/gallery/taglio-9.webp', fallback: 'assets/images/gallery/taglio-9.jpg', w: 322, h: 423, alt: 'Taglio texturizzato in barberia', caption: 'Texture', span: '' },
    { src: 'assets/images/gallery/taglio-17.webp', fallback: 'assets/images/gallery/taglio-17.jpg', w: 323, h: 406, alt: 'Sfumatura e volume sopra', caption: 'Volume', span: '' },
    { src: 'assets/images/gallery/taglio-12.webp', fallback: 'assets/images/gallery/taglio-12.jpg', w: 322, h: 424, alt: 'Taglio uomo rifinito di profilo', caption: 'Profilo', span: '' }
  ],

  media: {
    hero: {
      mode: 'image',
      poster: 'assets/posters/hero-poster.webp',
      imageSrcset: 'assets/images/studio/interno-01.webp',
      imageFallback: 'assets/images/studio/interno-01.jpg',
      width: 960,
      height: 1280,
      videoMp4: '',
      videoWebm: ''
    },
    studio: {
      enabled: true,
      videoMp4: '',
      videoWebm: '',
      poster: 'assets/posters/studio-poster.webp',
      stills: [
        { src: 'assets/images/studio/interno-01.webp', alt: 'Interno della barberia rinnovata' },
        { src: 'assets/images/studio/interno-02.webp', alt: 'Postazioni e illuminazione della barberia' },
        { src: 'assets/images/studio/interno-03.webp', alt: 'Ambiente della Barberia Sgarra' }
      ]
    }
  },

  instagramMedia: [
    { type: 'reel', url: '', localVideo: '', poster: '', title: '', enabled: false }
  ],

  reviewsEnabled: false,
  reviews: [],

  GA4_MEASUREMENT_ID: '',
  CLARITY_PROJECT_ID: '',
  firstPartyAnalyticsEnabled: false,
  debug: false,
  showCookieBannerWhenTracking: true
});

/* Carica l’estensione operativa due-barbieri prima dell’app principale. */
(function loadTwoBarberEnhancements() {
  var script = document.createElement('script');
  script.src = 'site-enhancements.js?v=20260909-3';
  script.async = false;
  document.head.appendChild(script);
})();
