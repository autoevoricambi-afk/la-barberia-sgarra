(() => {
  const whatsappNumber = "393296410828";
  const dateInput = document.getElementById("dateInput");
  const slots = [...document.querySelectorAll("[data-slot]")];
  const serviceInputs = [...document.querySelectorAll('input[name="service"]')];
  const paymentInputs = [...document.querySelectorAll('input[name="payment"]')];
  const nameInput = document.getElementById("nameInput");
  const phoneInput = document.getElementById("phoneInput");
  const notesInput = document.getElementById("notesInput");
  const summaryText = document.getElementById("summaryText");
  const bookingForm = document.getElementById("bookingForm");
  const copySummary = document.getElementById("copySummary");
  const toast = document.getElementById("toast");
  const year = document.getElementById("year");
  const galleryToggle = document.getElementById("galleryToggle");
  const galleryMore = document.getElementById("galleryMore");
  const menuToggle = document.getElementById("menuToggle");
  const mobileMenu = document.getElementById("mobileMenu");
  let selectedSlot = "";

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function todayISO() {
    const today = new Date();
    return `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  }

  function humanDate(value) {
    if (!value) return "Data non selezionata";
    const [y, m, d] = value.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    return new Intl.DateTimeFormat("it-IT", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric"
    }).format(date);
  }

  function selectedServices() {
    return serviceInputs.filter(input => input.checked).map(input => input.value);
  }

  function selectedPayment() {
    return paymentInputs.find(input => input.checked)?.value || "";
  }

  function summary() {
    const services = selectedServices();
    const date = humanDate(dateInput.value);
    const payment = selectedPayment();
    const customer = nameInput.value.trim();
    const phone = phoneInput.value.trim();
    const notes = notesInput.value.trim();

    return [
      "Ciao La Barberia Sgarra, vorrei richiedere una prenotazione.",
      "",
      `• Nome: ${customer || "Da inserire"}`,
      `• Telefono: ${phone || "Da inserire"}`,
      `• Servizi: ${services.length ? services.join(", ") : "Da selezionare"}`,
      `• Giorno: ${date}`,
      `• Orario richiesto: ${selectedSlot || "Da selezionare"}`,
      "• Durata slot: 1 ora",
      `• Pagamento preferito: ${payment || "Da selezionare"}`,
      `• Note: ${notes || "Nessuna nota"}`,
      "",
      "Attendo conferma della disponibilità. Grazie."
    ].join("\n");
  }

  function updateSummary() {
    const services = selectedServices();
    const payment = selectedPayment();
    const chunks = [];
    chunks.push(services.length ? services.join(", ") : "Nessun servizio selezionato");
    chunks.push(dateInput.value ? humanDate(dateInput.value) : "data da scegliere");
    chunks.push(selectedSlot ? `ore ${selectedSlot}` : "slot da scegliere");
    chunks.push(payment || "pagamento da scegliere");
    summaryText.textContent = chunks.join(" · ");
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2800);
  }

  function scrollBooking() {
    document.getElementById("prenota").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function checkServiceByName(serviceName) {
    const input = serviceInputs.find(item => item.value === serviceName);
    if (input) {
      input.checked = true;
      syncServiceCards();
      updateSummary();
    }
  }

  function syncServiceCards() {
    document.querySelectorAll(".service-card").forEach(card => {
      const service = card.dataset.service;
      const active = serviceInputs.find(input => input.value === service)?.checked;
      card.classList.toggle("selected", Boolean(active));
      const button = card.querySelector(".select-service");
      if (button) button.textContent = active ? "Selezionato" : "Seleziona";
    });
  }

  dateInput.min = todayISO();
  year.textContent = new Date().getFullYear();

  document.querySelectorAll("[data-scroll-booking]").forEach(button => {
    button.addEventListener("click", scrollBooking);
  });

  document.querySelectorAll("[data-service-short]").forEach(button => {
    button.addEventListener("click", () => {
      checkServiceByName(button.dataset.serviceShort);
      scrollBooking();
      showToast("Servizio aggiunto alla prenotazione.");
    });
  });

  document.querySelectorAll(".service-card .select-service").forEach(button => {
    button.addEventListener("click", event => {
      const card = event.currentTarget.closest(".service-card");
      const service = card.dataset.service;
      const input = serviceInputs.find(item => item.value === service);
      if (!input) return;
      input.checked = !input.checked;
      syncServiceCards();
      updateSummary();
      if (input.checked) showToast(`${service} selezionato.`);
    });
  });

  serviceInputs.forEach(input => input.addEventListener("change", () => {
    syncServiceCards();
    updateSummary();
  }));

  paymentInputs.forEach(input => input.addEventListener("change", updateSummary));
  [dateInput, nameInput, phoneInput, notesInput].forEach(input => input.addEventListener("input", updateSummary));

  slots.forEach(button => {
    button.addEventListener("click", () => {
      selectedSlot = button.dataset.slot;
      slots.forEach(item => item.classList.toggle("selected", item === button));
      updateSummary();
    });
  });

  bookingForm.addEventListener("submit", event => {
    event.preventDefault();
    const services = selectedServices();
    const payment = selectedPayment();

    if (!services.length) {
      showToast("Seleziona almeno un servizio.");
      return;
    }
    if (!dateInput.value) {
      showToast("Seleziona il giorno.");
      dateInput.focus();
      return;
    }
    if (!selectedSlot) {
      showToast("Seleziona uno slot orario.");
      return;
    }
    if (!payment) {
      showToast("Seleziona il pagamento preferito.");
      return;
    }
    if (!nameInput.value.trim() || !phoneInput.value.trim()) {
      showToast("Inserisci nome e telefono.");
      return;
    }

    const message = encodeURIComponent(summary());
    window.open(`https://wa.me/${whatsappNumber}?text=${message}`, "_blank", "noopener");
    showToast("Richiesta pronta: si apre WhatsApp.");
  });

  copySummary.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(summary());
      showToast("Riepilogo copiato.");
    } catch (error) {
      showToast("Copia non disponibile su questo dispositivo.");
    }
  });

  galleryToggle.addEventListener("click", () => {
    const isHidden = galleryMore.hasAttribute("hidden");
    if (isHidden) {
      galleryMore.removeAttribute("hidden");
      galleryToggle.textContent = "Riduci gallery";
    } else {
      galleryMore.setAttribute("hidden", "");
      galleryToggle.textContent = "Mostra altri tagli";
    }
  });

  menuToggle.addEventListener("click", () => {
    const isOpen = !mobileMenu.hasAttribute("hidden");
    if (isOpen) {
      mobileMenu.setAttribute("hidden", "");
      menuToggle.setAttribute("aria-expanded", "false");
    } else {
      mobileMenu.removeAttribute("hidden");
      menuToggle.setAttribute("aria-expanded", "true");
    }
  });

  mobileMenu.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", () => {
      mobileMenu.setAttribute("hidden", "");
      menuToggle.setAttribute("aria-expanded", "false");
    });
  });

  syncServiceCards();
  updateSummary();
})();
