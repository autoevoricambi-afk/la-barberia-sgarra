begin;

alter table public.appointments
  add column if not exists reserved_starts_at timestamptz,
  add column if not exists reserved_ends_at timestamptz,
  add column if not exists consent_at timestamptz not null default now();

update public.appointments
set reserved_starts_at = coalesce(reserved_starts_at, starts_at),
    reserved_ends_at = coalesce(reserved_ends_at, ends_at)
where reserved_starts_at is null or reserved_ends_at is null;

alter table public.appointments
  alter column reserved_starts_at set not null,
  alter column reserved_ends_at set not null;

alter table public.appointments drop constraint if exists appointments_no_active_overlap;
alter table public.appointments
  add constraint appointments_no_active_overlap
  exclude using gist (
    staff_id with =,
    tstzrange(reserved_starts_at, reserved_ends_at, '[)') with &&
  ) where (status in ('pending', 'confirmed'));

create table if not exists public.service_conflicts (
  location_id uuid not null references public.locations(id) on delete cascade,
  service_slug_a text not null,
  service_slug_b text not null,
  reason text not null default '',
  primary key (location_id, service_slug_a, service_slug_b),
  check (service_slug_a < service_slug_b)
);

insert into public.service_conflicts (location_id, service_slug_a, service_slug_b, reason)
select l.id, 'barba', 'taglio-barba', 'Servizio già incluso nel pacchetto Taglio + barba'
from public.locations l where l.slug = 'via-corato-48'
on conflict do nothing;

insert into public.service_conflicts (location_id, service_slug_a, service_slug_b, reason)
select l.id, 'taglio-barba', 'taglio-uomo', 'Servizio già incluso nel pacchetto Taglio + barba'
from public.locations l where l.slug = 'via-corato-48'
on conflict do nothing;

create table if not exists public.booking_rate_limits (
  key_hash text not null,
  window_started_at timestamptz not null,
  hits integer not null default 1,
  primary key (key_hash, window_started_at)
);

create table if not exists public.booking_events (
  id bigint generated always as identity primary key,
  event_name text not null check (event_name in (
    'service_view', 'booking_start', 'slot_view', 'slot_selected', 'booking_confirmed',
    'booking_cancelled', 'appointment_completed', 'no_show', 'review_requested',
    'review_clicked', 'rebooking_confirmed'
  )),
  path text not null default '/',
  source text not null default 'website',
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.booking_settings_audit (
  id bigint generated always as identity primary key,
  actor_id uuid,
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists booking_events_name_created_idx on public.booking_events (event_name, created_at);
create index if not exists booking_rate_limits_created_idx on public.booking_rate_limits (window_started_at);

create or replace function public.consume_public_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window timestamptz;
  v_hits integer;
begin
  if length(coalesce(p_key, '')) <> 64
     or p_limit < 1 or p_limit > 1000
     or p_window_seconds < 10 or p_window_seconds > 86400 then
    return false;
  end if;

  v_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  insert into public.booking_rate_limits (key_hash, window_started_at, hits)
  values (p_key, v_window, 1)
  on conflict (key_hash, window_started_at)
  do update set hits = public.booking_rate_limits.hits + 1
  where public.booking_rate_limits.hits < p_limit
  returning hits into v_hits;

  delete from public.booking_rate_limits where window_started_at < now() - interval '2 days';
  return v_hits is not null and v_hits <= p_limit;
end;
$$;

create or replace function public.public_available_slots(
  p_date date,
  p_staff_slug text,
  p_service_slugs text[]
)
returns table (starts_at timestamptz, ends_at timestamptz, label text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff public.staff%rowtype;
  v_location public.locations%rowtype;
  v_service_count integer;
  v_duration_minutes integer;
  v_buffer_before integer;
  v_buffer_after integer;
  v_window record;
  v_candidate timestamptz;
  v_candidate_end timestamptz;
  v_reserved_start timestamptz;
  v_reserved_end timestamptz;
  v_window_start timestamptz;
  v_window_end timestamptz;
begin
  if p_date is null or coalesce(array_length(p_service_slugs, 1), 0) = 0 then return; end if;

  select s.* into v_staff
  from public.staff s join public.locations l on l.id = s.location_id
  where s.slug = p_staff_slug and s.active and l.active
  limit 1;
  if not found then return; end if;
  select l.* into v_location from public.locations l where l.id = v_staff.location_id;

  if p_date < (now() at time zone v_location.timezone)::date
     or p_date > ((now() at time zone v_location.timezone)::date + v_location.booking_horizon_days) then return; end if;

  select count(*), sum(s.duration_minutes), sum(s.buffer_before_minutes), sum(s.buffer_after_minutes)
  into v_service_count, v_duration_minutes, v_buffer_before, v_buffer_after
  from public.services s
  join public.staff_services ss on ss.service_id = s.id and ss.staff_id = v_staff.id and ss.active
  where s.location_id = v_location.id and s.active and s.slug = any(p_service_slugs);

  if v_service_count <> cardinality(p_service_slugs) or v_duration_minutes is null then return; end if;
  if exists (
    select 1 from public.service_conflicts c
    where c.location_id = v_location.id
      and c.service_slug_a = any(p_service_slugs)
      and c.service_slug_b = any(p_service_slugs)
  ) then return; end if;

  for v_window in
    select bh.opens_at, bh.closes_at from public.business_hours bh
    where bh.staff_id = v_staff.id and bh.active
      and bh.weekday = extract(dow from p_date)::smallint
    order by bh.opens_at
  loop
    v_window_start := (p_date + v_window.opens_at) at time zone v_location.timezone;
    v_window_end := (p_date + v_window.closes_at) at time zone v_location.timezone;
    v_candidate := v_window_start + make_interval(mins => coalesce(v_buffer_before, 0));

    loop
      v_candidate_end := v_candidate + make_interval(mins => v_duration_minutes);
      v_reserved_start := v_candidate - make_interval(mins => coalesce(v_buffer_before, 0));
      v_reserved_end := v_candidate_end + make_interval(mins => coalesce(v_buffer_after, 0));
      exit when v_reserved_end > v_window_end;

      if v_candidate >= now() + make_interval(mins => v_location.min_notice_minutes)
         and not exists (
           select 1 from public.schedule_blocks b
           where b.staff_id = v_staff.id
             and tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(v_reserved_start, v_reserved_end, '[)')
         )
         and not exists (
           select 1 from public.appointments a
           where a.staff_id = v_staff.id and a.status in ('pending', 'confirmed')
             and tstzrange(a.reserved_starts_at, a.reserved_ends_at, '[)') && tstzrange(v_reserved_start, v_reserved_end, '[)')
         ) then
        starts_at := v_candidate;
        ends_at := v_candidate_end;
        label := to_char(v_candidate at time zone v_location.timezone, 'HH24:MI');
        return next;
      end if;
      v_candidate := v_candidate + make_interval(mins => v_location.slot_interval_minutes);
    end loop;
  end loop;
end;
$$;

create or replace function public.create_public_booking(
  p_service_slugs text[], p_staff_slug text, p_starts_at timestamptz,
  p_customer_name text, p_customer_phone text, p_notes text,
  p_privacy_version text, p_idempotency_key text,
  p_source text default 'website', p_client_ip_hint text default 'absent'
)
returns table (reference text, status text, starts_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff public.staff%rowtype;
  v_location public.locations%rowtype;
  v_customer_id uuid;
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
  returning id into v_customer_id;

  insert into public.appointments (
    location_id, staff_id, customer_id, starts_at, ends_at, reserved_starts_at, reserved_ends_at,
    status, source, notes, privacy_version, idempotency_key, consent_at
  ) values (
    v_location.id, v_staff.id, v_customer_id, p_starts_at,
    p_starts_at + make_interval(mins => v_duration),
    p_starts_at - make_interval(mins => coalesce(v_before, 0)),
    p_starts_at + make_interval(mins => v_duration + coalesce(v_after, 0)),
    'pending', 'website', coalesce(trim(p_notes), ''), p_privacy_version, p_idempotency_key, now()
  ) returning id into v_appointment_id;

  insert into public.appointment_items (appointment_id, service_id, service_name_snapshot, duration_minutes_snapshot, price_cents_snapshot)
  select v_appointment_id, s.id, s.name, s.duration_minutes, s.price_cents
  from public.services s where s.location_id = v_location.id and s.active and s.slug = any(p_service_slugs);
  insert into public.appointment_status_history (appointment_id, from_status, to_status, actor_type)
  values (v_appointment_id, null, 'pending', 'customer');
  insert into public.integration_outbox (appointment_id, event_type, payload, idempotency_key)
  values (v_appointment_id, 'booking.created', jsonb_build_object('source', 'website'), p_idempotency_key || ':booking.created');
  insert into public.booking_events (event_name, source, properties)
  values ('booking_confirmed', 'website', jsonb_build_object('status', 'pending'));

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
$$;

create or replace function public.admin_create_booking(
  p_service_slugs text[], p_staff_slug text, p_starts_at timestamptz,
  p_customer_name text, p_customer_phone text, p_notes text,
  p_source text, p_idempotency_key text, p_actor_id uuid
)
returns table (id uuid, reference text, status text, starts_at timestamptz, ends_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_created record;
  v_appointment public.appointments%rowtype;
begin
  if p_source not in ('admin', 'phone', 'whatsapp', 'walk_in') then raise exception 'invalid_source'; end if;
  select * into v_created from public.create_public_booking(
    p_service_slugs, p_staff_slug, p_starts_at, p_customer_name, p_customer_phone,
    p_notes, 'admin-recorded-v1', p_idempotency_key, 'website', 'absent'
  );
  select a.* into v_appointment from public.appointments a where a.idempotency_key = p_idempotency_key;
  update public.appointments set source = p_source, status = 'confirmed' where appointments.id = v_appointment.id;
  update public.appointment_status_history set actor_type = 'staff', actor_id = p_actor_id
  where appointment_id = v_appointment.id and from_status is null;
  return query select a.id, a.reference, a.status, a.starts_at, a.ends_at
  from public.appointments a where a.id = v_appointment.id;
end;
$$;

create or replace function public.admin_reschedule_appointment(
  p_appointment_id uuid, p_starts_at timestamptz, p_actor_id uuid, p_reason text default null
)
returns table (id uuid, reference text, status text, starts_at timestamptz, ends_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_a public.appointments%rowtype;
  v_l public.locations%rowtype;
  v_duration integer;
  v_before integer;
  v_after integer;
  v_reserved_start timestamptz;
  v_reserved_end timestamptz;
begin
  select a.* into v_a from public.appointments a where a.id = p_appointment_id for update;
  if not found then raise exception 'appointment_not_found'; end if;
  if v_a.status not in ('pending', 'confirmed') then raise exception 'appointment_not_reschedulable'; end if;
  select l.* into v_l from public.locations l where l.id = v_a.location_id;
  select sum(i.duration_minutes_snapshot), sum(s.buffer_before_minutes), sum(s.buffer_after_minutes)
  into v_duration, v_before, v_after
  from public.appointment_items i join public.services s on s.id = i.service_id
  where i.appointment_id = v_a.id;
  v_reserved_start := p_starts_at - make_interval(mins => coalesce(v_before, 0));
  v_reserved_end := p_starts_at + make_interval(mins => v_duration + coalesce(v_after, 0));

  if not exists (
    select 1 from public.business_hours h
    where h.staff_id = v_a.staff_id and h.active
      and h.weekday = extract(dow from (p_starts_at at time zone v_l.timezone)::date)::smallint
      and v_reserved_start >= (((p_starts_at at time zone v_l.timezone)::date + h.opens_at) at time zone v_l.timezone)
      and v_reserved_end <= (((p_starts_at at time zone v_l.timezone)::date + h.closes_at) at time zone v_l.timezone)
  ) then raise exception 'outside_business_hours'; end if;
  if exists (select 1 from public.schedule_blocks b where b.staff_id = v_a.staff_id
    and tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(v_reserved_start, v_reserved_end, '[)'))
  then raise exception 'slot_unavailable'; end if;
  if exists (select 1 from public.appointments a where a.staff_id = v_a.staff_id and a.id <> v_a.id
    and a.status in ('pending', 'confirmed')
    and tstzrange(a.reserved_starts_at, a.reserved_ends_at, '[)') && tstzrange(v_reserved_start, v_reserved_end, '[)'))
  then raise exception 'slot_unavailable'; end if;

  update public.appointments set starts_at = p_starts_at,
    ends_at = p_starts_at + make_interval(mins => v_duration),
    reserved_starts_at = v_reserved_start, reserved_ends_at = v_reserved_end
  where appointments.id = v_a.id;
  insert into public.appointment_status_history (appointment_id, from_status, to_status, actor_type, actor_id, reason)
  values (v_a.id, v_a.status, v_a.status, 'staff', p_actor_id, coalesce(nullif(trim(p_reason), ''), 'Appuntamento spostato'));
  insert into public.integration_outbox (appointment_id, event_type, payload, idempotency_key)
  values (v_a.id, 'booking.rescheduled', jsonb_build_object('from', v_a.starts_at, 'to', p_starts_at),
    v_a.id::text || ':rescheduled:' || extract(epoch from clock_timestamp())::bigint::text);
  return query select a.id, a.reference, a.status, a.starts_at, a.ends_at from public.appointments a where a.id = v_a.id;
end;
$$;

create or replace function public.admin_create_schedule_block(
  p_staff_slug text, p_starts_at timestamptz, p_ends_at timestamptz,
  p_kind text, p_reason text, p_actor_id uuid
)
returns table (id uuid, starts_at timestamptz, ends_at timestamptz, kind text, reason text)
language plpgsql
security definer
set search_path = public
as $$
declare v_staff_id uuid; v_id uuid;
begin
  if p_ends_at <= p_starts_at or p_kind not in ('manual', 'closure', 'break') then raise exception 'invalid_block'; end if;
  select s.id into v_staff_id from public.staff s where s.slug = p_staff_slug and s.active limit 1;
  if v_staff_id is null then raise exception 'staff_unavailable'; end if;
  if exists (select 1 from public.appointments a where a.staff_id = v_staff_id and a.status in ('pending', 'confirmed')
    and tstzrange(a.reserved_starts_at, a.reserved_ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)'))
  then raise exception 'block_overlaps_appointment'; end if;
  insert into public.schedule_blocks (staff_id, starts_at, ends_at, kind, reason)
  values (v_staff_id, p_starts_at, p_ends_at, p_kind, coalesce(trim(p_reason), '')) returning schedule_blocks.id into v_id;
  return query select b.id, b.starts_at, b.ends_at, b.kind, b.reason from public.schedule_blocks b where b.id = v_id;
end;
$$;

create or replace function public.admin_delete_schedule_block(p_block_id uuid, p_actor_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  delete from public.schedule_blocks where id = p_block_id and external_id is null;
  return found;
end;
$$;

create or replace function public.admin_replace_booking_settings(
  p_staff_slug text, p_services jsonb, p_hours jsonb, p_location jsonb, p_actor_id uuid
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_staff public.staff%rowtype; v_location_id uuid; v_service_count integer; v_hours_count integer;
begin
  if jsonb_typeof(p_services) <> 'array' or jsonb_array_length(p_services) = 0
     or jsonb_typeof(p_hours) <> 'array' then raise exception 'invalid_settings'; end if;
  select s.* into v_staff from public.staff s where s.slug = p_staff_slug and s.active limit 1;
  if not found then raise exception 'staff_unavailable'; end if;
  v_location_id := v_staff.location_id;

  update public.locations set
    min_notice_minutes = (p_location->>'min_notice_minutes')::integer,
    booking_horizon_days = (p_location->>'booking_horizon_days')::integer,
    slot_interval_minutes = (p_location->>'slot_interval_minutes')::integer
  where id = v_location_id;

  insert into public.services (
    location_id, slug, name, description, duration_minutes, buffer_before_minutes,
    buffer_after_minutes, price_cents, active, sort_order
  )
  select v_location_id, x.slug, x.name, coalesce(x.description, ''), x.duration_minutes,
    coalesce(x.buffer_before_minutes, 0), coalesce(x.buffer_after_minutes, 0),
    x.price_cents, coalesce(x.active, false), coalesce(x.sort_order, 0)
  from jsonb_to_recordset(p_services) as x(
    slug text, name text, description text, duration_minutes integer,
    buffer_before_minutes integer, buffer_after_minutes integer,
    price_cents integer, active boolean, sort_order integer
  )
  on conflict (location_id, slug) do update set
    name = excluded.name, description = excluded.description,
    duration_minutes = excluded.duration_minutes,
    buffer_before_minutes = excluded.buffer_before_minutes,
    buffer_after_minutes = excluded.buffer_after_minutes,
    price_cents = excluded.price_cents, active = excluded.active, sort_order = excluded.sort_order;

  update public.services s set active = false
  where s.location_id = v_location_id and not exists (
    select 1 from jsonb_to_recordset(p_services) as x(slug text) where x.slug = s.slug
  );
  insert into public.staff_services (staff_id, service_id, active)
  select v_staff.id, s.id, s.active from public.services s where s.location_id = v_location_id
  on conflict (staff_id, service_id) do update set active = excluded.active;

  delete from public.business_hours where staff_id = v_staff.id;
  insert into public.business_hours (staff_id, weekday, opens_at, closes_at, active)
  select v_staff.id, x.weekday, x.opens_at, x.closes_at, coalesce(x.active, true)
  from jsonb_to_recordset(p_hours) as x(weekday smallint, opens_at time, closes_at time, active boolean);

  select count(*) into v_service_count from public.services where location_id = v_location_id and active;
  select count(*) into v_hours_count from public.business_hours where staff_id = v_staff.id and active;
  insert into public.booking_settings_audit (actor_id, snapshot)
  values (p_actor_id, jsonb_build_object('services', p_services, 'hours', p_hours, 'location', p_location));
  return jsonb_build_object('activeServices', v_service_count, 'activeHours', v_hours_count);
end;
$$;

create or replace function public.admin_pilot_metrics(p_from timestamptz, p_to timestamptz)
returns jsonb language sql security definer set search_path = public as $$
  select jsonb_build_object(
    'appointments', count(*),
    'pending', count(*) filter (where status = 'pending'),
    'confirmed', count(*) filter (where status = 'confirmed'),
    'completed', count(*) filter (where status = 'completed'),
    'cancelled', count(*) filter (where status in ('cancelled_by_customer', 'cancelled_by_shop')),
    'noShow', count(*) filter (where status = 'no_show'),
    'newCustomers', count(distinct customer_id),
    'website', count(*) filter (where source = 'website'),
    'manual', count(*) filter (where source <> 'website')
  ) from public.appointments where starts_at >= p_from and starts_at < p_to;
$$;

create or replace function public.record_public_event(
  p_event_name text, p_path text, p_source text, p_properties jsonb
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_event_name not in (
    'service_view', 'booking_start', 'slot_view', 'slot_selected', 'booking_confirmed',
    'booking_cancelled', 'appointment_completed', 'no_show', 'review_requested',
    'review_clicked', 'rebooking_confirmed'
  ) then raise exception 'invalid_event'; end if;
  insert into public.booking_events (event_name, path, source, properties)
  values (p_event_name, left(coalesce(p_path, '/'), 160), left(coalesce(p_source, 'website'), 40), coalesce(p_properties, '{}'::jsonb));
end;
$$;

alter table public.service_conflicts enable row level security;
alter table public.booking_rate_limits enable row level security;
alter table public.booking_events enable row level security;
alter table public.booking_settings_audit enable row level security;

revoke all on function public.consume_public_rate_limit(text, integer, integer) from public, anon, authenticated;
revoke all on function public.admin_create_booking(text[], text, timestamptz, text, text, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.admin_reschedule_appointment(uuid, timestamptz, uuid, text) from public, anon, authenticated;
revoke all on function public.admin_create_schedule_block(text, timestamptz, timestamptz, text, text, uuid) from public, anon, authenticated;
revoke all on function public.admin_delete_schedule_block(uuid, uuid) from public, anon, authenticated;
revoke all on function public.admin_replace_booking_settings(text, jsonb, jsonb, jsonb, uuid) from public, anon, authenticated;
revoke all on function public.admin_pilot_metrics(timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.record_public_event(text, text, text, jsonb) from public, anon, authenticated;

grant execute on function public.consume_public_rate_limit(text, integer, integer) to service_role;
grant execute on function public.admin_create_booking(text[], text, timestamptz, text, text, text, text, text, uuid) to service_role;
grant execute on function public.admin_reschedule_appointment(uuid, timestamptz, uuid, text) to service_role;
grant execute on function public.admin_create_schedule_block(text, timestamptz, timestamptz, text, text, uuid) to service_role;
grant execute on function public.admin_delete_schedule_block(uuid, uuid) to service_role;
grant execute on function public.admin_replace_booking_settings(text, jsonb, jsonb, jsonb, uuid) to service_role;
grant execute on function public.admin_pilot_metrics(timestamptz, timestamptz) to service_role;
grant execute on function public.record_public_event(text, text, text, jsonb) to service_role;

commit;
