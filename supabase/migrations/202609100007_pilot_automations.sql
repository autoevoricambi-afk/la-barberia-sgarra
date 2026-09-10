begin;

-- 1) Auto-conferma: un cliente senza no-show pregressi (no_show_count = 0, incluso
-- chi prenota per la prima volta) parte già confermato. Chi ha almeno un no-show
-- resta 'pending' come oggi, così Paolo lo vede e decide.
create or replace function public.create_public_booking(
  p_service_slugs text[], p_staff_slug text, p_starts_at timestamp with time zone,
  p_customer_name text, p_customer_phone text, p_notes text, p_privacy_version text,
  p_idempotency_key text, p_source text default 'website'::text, p_client_ip_hint text default 'absent'::text
)
returns table(reference text, status text, starts_at timestamp with time zone)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_staff public.staff%rowtype;
  v_location public.locations%rowtype;
  v_customer_id uuid;
  v_no_show_count integer;
  v_initial_status text;
  v_appointment_id uuid;
  v_duration integer;
  v_before integer;
  v_after integer;
  v_existing public.appointments%rowtype;
begin
  if p_idempotency_key is null or length(p_idempotency_key) < 16 then raise exception 'invalid_idempotency_key'; end if;
  select a.* into v_existing from public.appointments a where a.idempotency_key = p_idempotency_key;
  if found then
    reference := v_existing.reference; status := v_existing.status; starts_at := v_existing.starts_at;
    return next; return;
  end if;

  select s.* into v_staff from public.staff s join public.locations l on l.id = s.location_id
  where s.slug = p_staff_slug and s.active and l.active limit 1;
  if not found then raise exception 'staff_unavailable'; end if;
  select l.* into v_location from public.locations l where l.id = v_staff.location_id;

  if not exists (
    select 1 from public.public_available_slots(
      (p_starts_at at time zone v_location.timezone)::date, p_staff_slug, p_service_slugs
    ) slot where slot.starts_at = p_starts_at
  ) then raise exception 'slot_unavailable'; end if;

  select sum(s.duration_minutes), sum(s.buffer_before_minutes), sum(s.buffer_after_minutes)
  into v_duration, v_before, v_after from public.services s
  where s.location_id = v_location.id and s.active and s.slug = any(p_service_slugs);

  insert into public.customers (location_id, name, phone_normalized)
  values (v_location.id, trim(p_customer_name), p_customer_phone)
  on conflict (location_id, phone_normalized) do update set name = excluded.name, updated_at = now()
  returning id, no_show_count into v_customer_id, v_no_show_count;

  v_initial_status := case when coalesce(v_no_show_count, 0) = 0 then 'confirmed' else 'pending' end;

  insert into public.appointments (
    location_id, staff_id, customer_id, starts_at, ends_at, reserved_starts_at, reserved_ends_at,
    status, source, notes, privacy_version, idempotency_key, consent_at
  ) values (
    v_location.id, v_staff.id, v_customer_id, p_starts_at,
    p_starts_at + make_interval(mins => v_duration),
    p_starts_at - make_interval(mins => coalesce(v_before, 0)),
    p_starts_at + make_interval(mins => v_duration + coalesce(v_after, 0)),
    v_initial_status, 'website', coalesce(trim(p_notes), ''), p_privacy_version, p_idempotency_key, now()
  ) returning id into v_appointment_id;

  insert into public.appointment_items (appointment_id, service_id, service_name_snapshot, duration_minutes_snapshot, price_cents_snapshot)
  select v_appointment_id, s.id, s.name, s.duration_minutes, s.price_cents
  from public.services s where s.location_id = v_location.id and s.active and s.slug = any(p_service_slugs);
  insert into public.appointment_status_history (appointment_id, from_status, to_status, actor_type, reason)
  values (
    v_appointment_id, null, v_initial_status, 'customer',
    case when v_initial_status = 'confirmed' then 'Auto-confermato: nessun no-show pregresso.' else '' end
  );
  insert into public.integration_outbox (appointment_id, event_type, payload, idempotency_key)
  values (v_appointment_id, 'booking.created', jsonb_build_object('source', 'website', 'status', v_initial_status), p_idempotency_key || ':booking.created');
  insert into public.booking_events (event_name, source, properties)
  values ('booking_confirmed', 'website', jsonb_build_object('status', v_initial_status));

  return query select a.reference, a.status, a.starts_at from public.appointments a where a.id = v_appointment_id;
exception
  when exclusion_violation then raise exception 'slot_unavailable';
  when unique_violation then
    select a.* into v_existing from public.appointments a where a.idempotency_key = p_idempotency_key;
    if found then
      reference := v_existing.reference; status := v_existing.status; starts_at := v_existing.starts_at;
      return next; return;
    end if;
    raise;
end;
$function$;

-- 2) Blocco agenda: invece di rifiutare il blocco se ci sono appuntamenti in
-- conflitto, prova a riassegnare ciascuno a un barbiere compatibile e libero
-- nello stesso orario. Solo se per un appuntamento non ne trova nessuno, lascia
-- l'appuntamento dov'è e lo marca chiaramente per l'attenzione di Paolo (nel
-- registro modifiche e in coda notifiche) invece di bloccare la creazione del blocco.
--
-- NOTA: la prima versione di questa funzione usava `where id = v_location_id` dentro
-- una subquery su locations — ambiguo con il parametro OUT `id` di RETURNS TABLE,
-- stesso bug già visto altrove nel progetto. Corretto qui pre-calcolando il fuso
-- orario in v_timezone invece di ripetere la subquery.
create or replace function public.admin_create_schedule_block(
  p_staff_slug text, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone,
  p_kind text, p_reason text, p_actor_id uuid
)
returns table(id uuid, starts_at timestamp with time zone, ends_at timestamp with time zone, kind text, reason text)
language plpgsql
set search_path to 'public'
as $function$
declare
  v_staff_id uuid;
  v_location_id uuid;
  v_timezone text;
  v_id uuid;
  v_conflict record;
  v_target record;
  v_reassigned boolean;
begin
  if p_ends_at <= p_starts_at or p_kind not in ('manual','closure','break') then raise exception 'invalid_block'; end if;
  select s.id, s.location_id into v_staff_id, v_location_id from public.staff s where s.slug = p_staff_slug and s.active limit 1;
  if v_staff_id is null then raise exception 'staff_unavailable'; end if;
  select loc.timezone into v_timezone from public.locations loc where loc.id = v_location_id;

  for v_conflict in
    select a.* from public.appointments a
    where a.staff_id = v_staff_id
      and a.status in ('pending','confirmed','arrived','in_progress')
      and tstzrange(a.reserved_starts_at, a.reserved_ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')
    for update
  loop
    v_reassigned := false;

    select s.slug, s.display_name into v_target
    from public.staff s
    where s.location_id = v_location_id
      and s.id <> v_staff_id
      and s.active
      and (
        select count(*) from public.appointment_items i
        where i.appointment_id = v_conflict.id
      ) = (
        select count(*) from public.appointment_items i
        join public.staff_services ss on ss.service_id = i.service_id and ss.staff_id = s.id and ss.active
        join public.services sv on sv.id = i.service_id and sv.active
        where i.appointment_id = v_conflict.id
      )
      and exists (
        select 1 from public.business_hours h
        where h.staff_id = s.id and h.active
          and h.weekday = extract(dow from (v_conflict.starts_at at time zone v_timezone))::smallint
          and v_conflict.reserved_starts_at >= (((v_conflict.starts_at at time zone v_timezone)::date + h.opens_at) at time zone v_timezone)
          and v_conflict.reserved_ends_at <= (((v_conflict.starts_at at time zone v_timezone)::date + h.closes_at) at time zone v_timezone)
      )
      and not exists (
        select 1 from public.schedule_blocks b
        where b.staff_id = s.id
          and tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(v_conflict.reserved_starts_at, v_conflict.reserved_ends_at, '[)')
      )
      and not exists (
        select 1 from public.appointments a2
        where a2.staff_id = s.id and a2.id <> v_conflict.id
          and a2.status in ('pending','confirmed')
          and tstzrange(a2.reserved_starts_at, a2.reserved_ends_at, '[)') && tstzrange(v_conflict.reserved_starts_at, v_conflict.reserved_ends_at, '[)')
      )
    limit 1;

    if v_target.slug is not null then
      update public.appointments set staff_id = (select st.id from public.staff st where st.slug = v_target.slug), updated_at = now()
      where public.appointments.id = v_conflict.id;
      insert into public.appointment_status_history (appointment_id, from_status, to_status, actor_type, actor_id, reason)
      values (v_conflict.id, v_conflict.status, v_conflict.status, 'staff', p_actor_id,
        'Riassegnato automaticamente a ' || v_target.display_name || ' per blocco agenda (' || coalesce(nullif(trim(p_reason), ''), p_kind) || ').');
      insert into public.integration_outbox (appointment_id, event_type, payload, idempotency_key)
      values (v_conflict.id, 'booking.reassigned',
        jsonb_build_object('reference', v_conflict.reference, 'toStaff', v_target.display_name, 'startsAt', v_conflict.starts_at, 'reason', 'schedule_block'),
        v_conflict.id::text || ':block-reassigned:' || extract(epoch from clock_timestamp())::bigint::text);
      v_reassigned := true;
    end if;

    if not v_reassigned then
      insert into public.appointment_status_history (appointment_id, from_status, to_status, actor_type, actor_id, reason)
      values (v_conflict.id, v_conflict.status, v_conflict.status, 'staff', p_actor_id,
        'ATTENZIONE: nessun barbiere compatibile libero per il blocco agenda. Serve riassegnazione manuale.');
      insert into public.integration_outbox (appointment_id, event_type, payload, idempotency_key)
      values (v_conflict.id, 'appointment.needs_manual_reassignment',
        jsonb_build_object('reference', v_conflict.reference, 'startsAt', v_conflict.starts_at),
        v_conflict.id::text || ':needs-reassignment:' || extract(epoch from clock_timestamp())::bigint::text);
    end if;
  end loop;

  insert into public.schedule_blocks (staff_id, starts_at, ends_at, kind, reason)
  values (v_staff_id, p_starts_at, p_ends_at, p_kind, coalesce(trim(p_reason), ''))
  returning schedule_blocks.id into v_id;
  return query select b.id, b.starts_at, b.ends_at, b.kind, b.reason from public.schedule_blocks b where b.id = v_id;
end;
$function$;

-- 3) No-show automatico: chiamata a basso costo (nessun cron ad alta frequenza
-- necessario, il piano Vercel Hobby consente al massimo un cron al giorno) che
-- l'endpoint agenda del gestionale invoca a ogni caricamento. Marca no_show ogni
-- appuntamento confermato il cui orario + margine è già passato senza check-in.
-- Riusa admin_transition_appointment così contatori cliente, storico e coda
-- notifiche restano coerenti con un no-show segnato a mano; "Riapri" resta sempre
-- disponibile per correggere un falso positivo.
create or replace function public.admin_detect_overdue_no_shows(p_grace_minutes integer default 20)
returns integer
language plpgsql
set search_path to 'public'
as $function$
declare
  v_appointment record;
  v_count integer := 0;
begin
  for v_appointment in
    select a.id from public.appointments a
    where a.status = 'confirmed'
      and a.starts_at + make_interval(mins => greatest(p_grace_minutes, 0)) <= now()
  loop
    perform public.admin_transition_appointment(
      v_appointment.id, 'no_show', null,
      'Automatico: nessun check-in entro ' || greatest(p_grace_minutes, 0) || ' minuti dall''orario.'
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$function$;

commit;
