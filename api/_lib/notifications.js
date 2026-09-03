import { supabaseRequest } from './supabase.js';

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[char]));
}

function formatRome(value) {
  return new Intl.DateTimeFormat('it-IT', {
    timeZone: 'Europe/Rome', dateStyle: 'full', timeStyle: 'short'
  }).format(new Date(value));
}

function notificationConfig() {
  return {
    resendKey: String(process.env.RESEND_API_KEY || '').trim(),
    from: String(process.env.NOTIFICATION_FROM_EMAIL || '').trim(),
    barberEmail: String(process.env.BARBER_NOTIFICATION_EMAIL || '').trim(),
    webhookUrl: String(process.env.BOOKING_NOTIFICATION_WEBHOOK_URL || '').trim(),
    webhookSecret: String(process.env.BOOKING_NOTIFICATION_WEBHOOK_SECRET || '').trim()
  };
}

async function appointmentDetails(appointmentId) {
  const params = new URLSearchParams({
    id: `eq.${appointmentId}`,
    select: 'id,reference,status,starts_at,ends_at,notes,source,deposit_required,deposit_amount_cents,deposit_status,customers(name,phone_normalized,email),appointment_items(service_name_snapshot)',
    limit: '1'
  });
  const rows = await supabaseRequest(`/rest/v1/appointments?${params.toString()}`);
  return Array.isArray(rows) ? rows[0] : null;
}

function isCustomerEvent(eventType) {
  return [
    'booking.status_changed', 'booking.rescheduled', 'booking.reminder_day_before',
    'booking.reminder_same_day', 'review.request', 'waitlist.slot_available', 'deposit.status_changed'
  ].includes(eventType);
}

function notificationCopy(event, appointment) {
  const payload = event.payload || {};
  const copies = {
    'booking.created': ['Nuova richiesta di appuntamento', 'È arrivata una nuova richiesta dal sito.'],
    'booking.status_changed': ['Aggiornamento appuntamento', 'Lo stato del tuo appuntamento è stato aggiornato.'],
    'booking.rescheduled': ['Appuntamento spostato', 'Il tuo appuntamento è stato spostato.'],
    'booking.reminder_day_before': ['Promemoria appuntamento di domani', 'Ti ricordiamo il tuo appuntamento di domani alla Barberia Sgarra.'],
    'booking.reminder_same_day': ['Promemoria appuntamento di oggi', 'Ti aspettiamo oggi alla Barberia Sgarra.'],
    'review.request': ['Com’è andato il tuo appuntamento?', 'Grazie per essere passato. Se ti va, lascia una recensione alla Barberia Sgarra.'],
    'waitlist.created': ['Nuova richiesta in lista d’attesa', 'Un cliente è entrato nella lista d’attesa.'],
    'waitlist.slot_available': ['Si è liberato un posto', 'Si è liberato un posto compatibile con la tua richiesta. Contatta subito Paolo per verificarne la disponibilità.'],
    'deposit.status_changed': ['Aggiornamento caparra', 'Lo stato della caparra del tuo appuntamento è stato aggiornato.'],
    'inventory.low_stock': ['Prodotto in esaurimento', `Paolo, ${payload.productName || 'un prodotto'} sta finendo: ne restano ${payload.quantity ?? 'poche unità'} ${payload.unit || ''}.`]
  };
  return copies[event.event_type] || ['Aggiornamento Barberia Sgarra', 'C’è un nuovo aggiornamento nel gestionale.'];
}

async function sendResendEmail(config, event, appointment) {
  const payload = event.payload || {};
  const customer = appointment?.customers || {};
  const toCustomer = isCustomerEvent(event.event_type);
  const recipient = toCustomer
    ? String(payload.email || customer.email || '').trim()
    : config.barberEmail;
  if (!config.resendKey || !config.from || !recipient) return { skipped: true, channel: 'email' };
  const services = (appointment?.appointment_items || []).map((item) => item.service_name_snapshot).join(' · ');
  const [title, intro] = notificationCopy(event, appointment);
  const reference = appointment?.reference || payload.reference || '';
  const startsAt = appointment?.starts_at || payload.startsAt || '';
  const reviewUrl = payload.reviewUrl || '';
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.resendKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `sgarra-${event.idempotency_key}`.slice(0, 256)
    },
    body: JSON.stringify({
      from: config.from,
      to: [recipient],
      subject: reference ? `${title} · ${reference}` : title,
      html: `<h1>${escapeHtml(title)}</h1><p>${escapeHtml(intro)}</p>` +
        (reference ? `<p><strong>${escapeHtml(reference)}</strong></p>` : '') +
        (startsAt ? `<p>${escapeHtml(formatRome(startsAt))}</p>` : '') +
        (!toCustomer && (payload.name || customer.name) ? `<p>${escapeHtml(payload.name || customer.name)} · ${escapeHtml(payload.phone || customer.phone_normalized || '')}</p>` : '') +
        (services ? `<p>${escapeHtml(services)}</p>` : '') +
        (appointment?.status ? `<p>Stato: ${escapeHtml(appointment.status)}</p>` : '') +
        (reviewUrl ? `<p><a href="${escapeHtml(reviewUrl)}">Lascia una recensione</a></p>` : '')
    })
  });
  if (!response.ok) throw new Error(`resend_${response.status}`);
  return { sent: true, channel: 'email' };
}

async function sendWebhook(config, event, appointment) {
  if (!config.webhookUrl) return { skipped: true, channel: 'webhook' };
  const response = await fetch(config.webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': event.idempotency_key,
      ...(config.webhookSecret ? { Authorization: `Bearer ${config.webhookSecret}` } : {})
    },
    body: JSON.stringify({ event: event.event_type, payload: event.payload || {}, appointment })
  });
  if (!response.ok) throw new Error(`webhook_${response.status}`);
  return { sent: true, channel: 'webhook' };
}

export async function processOutboxEvent(event) {
  const config = notificationConfig();
  if ((!config.resendKey || !config.from || !config.barberEmail) && !config.webhookUrl) {
    throw new Error('notification_channel_not_configured');
  }
  const appointment = event.appointment_id ? await appointmentDetails(event.appointment_id) : null;
  if (event.appointment_id && !appointment) throw new Error('notification_appointment_not_found');
  const results = await Promise.all([
    sendResendEmail(config, event, appointment),
    sendWebhook(config, event, appointment)
  ]);
  if (results.every((result) => result?.skipped)) throw new Error('notification_recipient_not_configured');
  if (event.event_type === 'waitlist.slot_available' && event.payload?.waitlistId) {
    await supabaseRequest(`/rest/v1/waitlist_entries?id=eq.${encodeURIComponent(event.payload.waitlistId)}`, {
      method: 'PATCH',
      body: { status: 'notified', notified_at: new Date().toISOString() },
      headers: { Prefer: 'return=minimal' }
    });
  }
  return results;
}

export async function processPendingOutboxForReference(reference) {
  if (!reference) return { processed: 0 };
  const rows = await supabaseRequest(`/rest/v1/appointments?reference=eq.${encodeURIComponent(reference)}&select=id&limit=1`);
  const appointment = Array.isArray(rows) ? rows[0] : null;
  if (!appointment) return { processed: 0 };
  const params = new URLSearchParams({
    appointment_id: `eq.${appointment.id}`,
    processed_at: 'is.null',
    select: 'id,appointment_id,event_type,payload,attempts,idempotency_key',
    order: 'created_at.asc'
  });
  const events = await supabaseRequest(`/rest/v1/integration_outbox?${params.toString()}`);
  let processed = 0;
  for (const event of Array.isArray(events) ? events : []) {
    await processOutboxEvent(event);
    await supabaseRequest(`/rest/v1/integration_outbox?id=eq.${event.id}`, {
      method: 'PATCH',
      body: { processed_at: new Date().toISOString(), attempts: Number(event.attempts || 0) + 1, last_error: null },
      headers: { Prefer: 'return=minimal' }
    });
    processed += 1;
  }
  return { processed };
}

export async function processPendingOutboxForWaitlistReference(reference) {
  if (!reference) return { processed: 0 };
  const rows = await supabaseRequest(`/rest/v1/waitlist_entries?reference=eq.${encodeURIComponent(reference)}&select=id&limit=1`);
  const entry = Array.isArray(rows) ? rows[0] : null;
  if (!entry) return { processed: 0 };
  const params = new URLSearchParams({
    processed_at: 'is.null',
    select: 'id,appointment_id,event_type,payload,attempts,idempotency_key',
    order: 'created_at.asc'
  });
  params.set('payload->>waitlistId', `eq.${entry.id}`);
  const events = await supabaseRequest(`/rest/v1/integration_outbox?${params.toString()}`);
  let processed = 0;
  for (const event of Array.isArray(events) ? events : []) {
    await processOutboxEvent(event);
    await supabaseRequest(`/rest/v1/integration_outbox?id=eq.${event.id}`, {
      method: 'PATCH',
      body: { processed_at: new Date().toISOString(), attempts: Number(event.attempts || 0) + 1, last_error: null },
      headers: { Prefer: 'return=minimal' }
    });
    processed += 1;
  }
  return { processed };
}
