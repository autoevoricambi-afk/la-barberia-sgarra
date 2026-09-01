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
  siteUrl: 'https://la-barberia-sgarra.vercel.app',
  legalName: 'La Barberia Sgarra di Sgarra Paolo',
  vatNumber: '08703770720',
  foundingDate: '',
  priceRange: '',
  googleBusinessUrl: '',

  /**
   * `request`: il flusso prepara WhatsApp senza salvare dati.
   * `live`: usa API e disponibilità reali, ma soltanto con catalogo e orari approvati.
   */
  booking: {
    mode: 'request',
    apiBase: '/api',
    staffSlug: 'paolo-sgarra',
    serviceCatalogReady: false,
    privacyVersion: '2026-09-01',
    bookingHorizonDays: 45
  },
  pwaEnabled: false,

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

  mapsUrl:
    'https://www.google.com/maps/search/?api=1&query=La%20Barberia%20Sgarra%20Via%20Corato%2048%20Andria',

  instagramUrl: 'https://www.instagram.com/la_barberia_sgarra/',
  instagramHandle: '@la_barberia_sgarra',

  /** Orari: non mostrare in UI finché openingHoursApproved !== true */
  openingHoursApproved: false,
  openingHours: {
    verified: false,
    note: '08:00–13:00 / 15:00–20:00',
    days: []
  },

  /** Bio pubblica: se false → copy neutro sicuro, nessuna nota editoriale */
  paoloBioApproved: false,
  barber: {
    name: 'Paolo Sgarra',
    bioApproved: false,
    bio:
      'Ogni taglio parte dall’ascolto. Forma, proporzioni e dettagli vengono costruiti sulla persona, non copiati da una fotografia.',
    bioNeutral:
      'Dietro ogni lavoro c’è Paolo Sgarra, il barbiere della Barberia Sgarra ad Andria.'
  },

  /** Media locale: se false non usare primi piani di tagli come “interno” */
  studioMediaApproved: false,
  /** Media posizione: se false sezione tipografica senza foto non pertinenti */
  locationMediaApproved: false,

  services: {
    primary: [
      { id: 'taglio-uomo', label: 'Taglio uomo', desc: 'Forma e rifinitura.' },
      { id: 'fade', label: 'Fade', desc: 'Transizione pulita.' },
      { id: 'taglio-barba', label: 'Taglio + barba', desc: 'Il servizio completo.' },
      { id: 'barba', label: 'Barba', desc: 'Contorni e proporzioni.' },
      { id: 'cambio-look', label: 'Cambio look', desc: 'Un taglio costruito da zero.' }
    ],
    secondary: [
      { id: 'rasatura', label: 'Rasatura', desc: 'Finitura netta.' },
      { id: 'shampoo', label: 'Shampoo', desc: 'Da abbinare al taglio.' },
      { id: 'doppio-shampoo', label: 'Doppio shampoo', desc: 'Lavaggio più completo.' },
      { id: 'shampoo-styling', label: 'Shampoo + styling', desc: 'Chiusura con prodotto.' }
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
      imageSrcset:
        'assets/images/hero/hero-640.webp 640w, assets/images/hero/hero-960.webp 960w',
      imageFallback: 'assets/images/hero/hero-fallback.jpg',
      width: 640,
      height: 837,
      videoMp4: '',
      videoWebm: ''
    },
    studio: {
      enabled: true,
      videoMp4: '',
      videoWebm: '',
      poster: 'assets/posters/studio-poster.webp',
      stills: [
        { src: 'assets/images/studio/interno-01.webp', alt: 'Interno della barberia, postazione e dettagli' },
        { src: 'assets/images/studio/interno-02.webp', alt: 'Postazione con luci e prodotti' },
        { src: 'assets/images/studio/interno-03.webp', alt: 'Cliente e ambiente del negozio' }
      ]
    }
  },

  instagramMedia: [
    {
      type: 'reel',
      url: '',
      localVideo: '',
      poster: '',
      title: '',
      enabled: false
    }
  ],

  reviewsEnabled: false,
  reviews: [],

  GA4_MEASUREMENT_ID: '',
  CLARITY_PROJECT_ID: '',
  debug: false,
  showCookieBannerWhenTracking: true
});
