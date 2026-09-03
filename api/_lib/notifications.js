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
    webhookUrl: String(process.env.BOOKING_NOTIFICATION_WEBHOOK_URL || '').trim()
  };
}

async function appointmentDetails(appointmentId) {
  const params = new URLSearchParams({
    id: `eq.${appointmentId}`,
    select: 'id,reference,status,starts_at,ends_at,notes,source,customers(name,phone_normalized),appointment_items(service_name_snapshot)',
    limit: '1'
  });
  const rows = await supabaseRequest(`/rest/v1/appointments?${params.toString()}`);
  return Array.isArray(rows) ? rows[0] : null;
}

async function sendResendEmail(config, event, appointment) {
  if (!config.resendKey || !config.from || !config.barberEmail) return { skipped: true, channel: 'email' };
  const customer = appointment.customers || {};
  const services = (appointment.appointment_items || []).map((item) => item.service_name_snapshot).join(' · ');
  const title = event.event_type === 'booking.created' ? 'Nuova richiesta' : 'Aggiornamento appuntamento';
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.resendKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `sgarra-${event.idempotency_key}`.slice(0, 256)
    },
    body: JSON.stringify({
      from: config.from,
      to: [config.barberEmail],
      subject: `${title} ${appointment.reference}`,
      html: `<h1>${escapeHtml(title)}</h1><p><strong>${escapeHtml(appointment.reference)}</strong></p><p>${escapeHtml(formatRome(appointment.starts_at))}</p><p>${escapeHtml(customer.name)} · <a href="tel:${escapeHtml(customer.phone_normalized)}">${escapeHtml(customer.phone_normalized)}</a></p><p>${escapeHtml(services)}</p><p>Stato: ${escapeHtml(appointment.status)}</p><p>Origine: ${escapeHtml(appointment.source)}</p>`
    })
  });
  if (!response.ok) throw new Error(`resend_${response.status}`);
  return { sent: true, channel: 'email' };
}

async function sendWebhook(config, event, appointment) {
  if (!config.webhookUrl) return { skipped: true, channel: 'webhook' };
  const response = await fetch(config.webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': event.idempotency_key },
    body: JSON.stringify({ event: event.event_type, appointment })
  });
  if (!response.ok) throw new Error(`webhook_${response.status}`);
  return { sent: true, channel: 'webhook' };
}

export async function processOutboxEvent(event) {
  const config = notificationConfig();
  if ((!config.resendKey || !config.from || !config.barberEmail) && !config.webhookUrl) {
    throw new Error('notification_channel_not_configured');
  }
  const appointment = await appointmentDetails(event.appointment_id);
  if (!appointment) throw new Error('notification_appointment_not_found');
  return Promise.all([
    sendResendEmail(config, event, appointment),
    sendWebhook(config, event, appointment)
  ]);
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
