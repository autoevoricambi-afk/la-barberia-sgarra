(() => {
  const nav = document.getElementById('main-nav');
  const menuToggle = document.querySelector('.menu-toggle');
  const form = document.getElementById('booking-form');
  const dateInput = document.getElementById('booking-date');
  const formError = document.getElementById('form-error');
  const year = document.getElementById('year');
  const phoneNumber = '393296410828';

  if (year) {
    year.textContent = new Date().getFullYear();
  }

  if (dateInput) {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    dateInput.min = `${yyyy}-${mm}-${dd}`;
  }

  const closeMenu = () => {
    if (!nav || !menuToggle) return;
    nav.classList.remove('is-open');
    menuToggle.setAttribute('aria-expanded', 'false');
  };

  if (menuToggle && nav) {
    menuToggle.addEventListener('click', () => {
      const isOpen = nav.classList.toggle('is-open');
      menuToggle.setAttribute('aria-expanded', String(isOpen));
    });

    nav.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', closeMenu);
    });

    document.addEventListener('click', (event) => {
      if (!nav.classList.contains('is-open')) return;
      if (nav.contains(event.target) || menuToggle.contains(event.target)) return;
      closeMenu();
    });
  }

  const revealItems = Array.from(document.querySelectorAll('.reveal'));
  if ('IntersectionObserver' in window && revealItems.length) {
    const observer = new IntersectionObserver((entries, currentObserver) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        currentObserver.unobserve(entry.target);
      });
    }, {
      rootMargin: '0px 0px -10% 0px',
      threshold: 0.12
    });

    revealItems.forEach((item) => observer.observe(item));
  } else {
    revealItems.forEach((item) => item.classList.add('is-visible'));
  }

  const normalizeWhitespace = (value) => String(value || '').replace(/\s+/g, ' ').trim();

  const formatDate = (rawDate) => {
    if (!rawDate) return '';
    const [yearPart, monthPart, dayPart] = rawDate.split('-');
    return `${dayPart}/${monthPart}/${yearPart}`;
  };

  if (form) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (formError) formError.textContent = '';

      const formData = new FormData(form);
      const services = formData.getAll('service').map(normalizeWhitespace).filter(Boolean);
      const customerName = normalizeWhitespace(formData.get('customerName'));
      const customerPhone = normalizeWhitespace(formData.get('customerPhone'));
      const bookingDate = normalizeWhitespace(formData.get('bookingDate'));
      const bookingTime = normalizeWhitespace(formData.get('bookingTime'));
      const bookingNotes = normalizeWhitespace(formData.get('bookingNotes'));

      if (!services.length) {
        if (formError) formError.textContent = 'Seleziona almeno un servizio.';
        return;
      }

      if (!customerName || !customerPhone || !bookingDate || !bookingTime) {
        if (formError) formError.textContent = 'Completa i campi obbligatori prima di inviare la richiesta.';
        return;
      }

      const formattedDate = formatDate(bookingDate);
      const message = [
        'Buongiorno, vorrei richiedere un appuntamento presso La Barberia Sgarra.',
        '',
        `Nome: ${customerName}`,
        `Telefono: ${customerPhone}`,
        `Servizi richiesti: ${services.join(', ')}`,
        `Giorno richiesto: ${formattedDate}`,
        `Orario preferito: ${bookingTime}`,
        bookingNotes ? `Note: ${bookingNotes}` : null,
        '',
        'Resto in attesa di conferma, grazie.'
      ].filter(Boolean).join('\n');

      const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    });
  }
})();
