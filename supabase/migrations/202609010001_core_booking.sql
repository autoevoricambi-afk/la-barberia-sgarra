begin;

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

create sequence if not exists public.booking_reference_seq;

create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null,
  timezone text not null default 'Europe/Rome',
  currency char(3) not null default 'EUR',
  min_notice_minutes integer not null default 120 check (min_notice_minutes between 0 and 10080),
  booking_horizon_days integer not null default 45 check (booking_horizon_days between 1 and 365),
  slot_interval_minutes integer not null default 15 check (slot_interval_minutes in (5, 10, 15, 20, 30, 60)),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.staff (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete restrict,
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  display_name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (location_id, slug)
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete restrict,
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null,
  description text not null default '',
  duration_minutes integer not null check (duration_minutes between 5 and 480),
  buffer_before_minutes integer not null default 0 check (buffer_before_minutes between 0 and 120),
  buffer_after_minutes integer not null default 0 check (buffer_after_minutes between 0 and 120),
  price_cents integer check (price_cents is null or price_cents >= 0),
  currency char(3) not null default 'EUR',
  active boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (location_id, slug)
);

create table if not exists public.staff_services (
  staff_id uuid not null references public.staff(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  active boolean not null default true,
  primary key (staff_id, service_id)
);

create table if not exists public.business_hours (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  opens_at time not null,
  closes_at time not null,
  active boolean not null default true,
  check (closes_at > opens_at),
  unique (staff_id, weekday, opens_at, closes_at)
);

create table if not exists public.schedule_blocks (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  kind text not null default 'manual' check (kind in ('manual', 'closure', 'break', 'google_calendar')),
  external_id text,
  reason text not null default '',
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete restrict,
  name text not null,
  phone_normalized text not null check (phone_normalized ~ '^\+[1-9][0-9]{7,14}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (location_id, phone_normalized)
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default (
    'SG-' || to_char(current_date, 'YYMMDD') || '-' || lpad(nextval('public.booking_reference_seq')::text, 5, '0')
  ),
  location_id uuid not null references public.locations(id) on delete restrict,
  staff_id uuid not null references public.staff(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'pending' check (
    status in ('pending', 'confirmed', 'completed', 'cancelled_by_customer', 'cancelled_by_shop', 'no_show')
  ),
  source text not null default 'website' check (source in ('website', 'admin', 'phone', 'whatsapp', 'walk_in')),
  notes text not null default '' check (length(notes) <= 500),
  privacy_version text not null,
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

alter table public.appointments
  add constraint appointments_no_active_overlap
  exclude using gist (
    staff_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status in ('pending', 'confirmed'));

create table if not exists public.appointment_items (
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete restrict,
  service_name_snapshot text not null,
  duration_minutes_snapshot integer not null check (duration_minutes_snapshot > 0),
  price_cents_snapshot integer check (price_cents_snapshot is null or price_cents_snapshot >= 0),
  primary key (appointment_id, service_id)
);

create table if not exists public.appointment_status_history (
  id bigint generated always as identity primary key,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  from_status text,
  to_status text not null,
  actor_type text not null check (actor_type in ('system', 'customer', 'staff')),
  actor_id uuid,
  reason text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.integration_outbox (
  id bigint generated always as identity primary key,
  appointment_id uuid references public.appointments(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  processed_at timestamptz,
  last_error text,
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists appointments_staff_start_idx on public.appointments (staff_id, starts_at);
create index if not exists appointments_customer_idx on public.appointments (customer_id, starts_at desc);
create index if not exists appointments_status_start_idx on public.appointments (status, starts_at);
create unique index if not exists schedule_blocks_external_idx
  on public.schedule_blocks (staff_id, kind, external_id)
  where external_id is not null;
create index if not exists schedule_blocks_staff_range_idx on public.schedule_blocks using gist (
  staff_id,
  tstzrange(starts_at, ends_at, '[)')
);
create index if not exists integration_outbox_pending_idx on public.integration_outbox (available_at)
  where processed_at is null;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists locations_set_updated_at on public.locations;
create trigger locations_set_updated_at before update on public.locations
for each row execute function public.set_updated_at();

drop trigger if exists staff_set_updated_at on public.staff;
create trigger staff_set_updated_at before update on public.staff
for each row execute function public.set_updated_at();

drop trigger if exists services_set_updated_at on public.services;
create trigger services_set_updated_at before update on public.services
for each row execute function public.set_updated_at();

drop trigger if exists customers_set_updated_at on public.customers;
create trigger customers_set_updated_at before update on public.customers
for each row execute function public.set_updated_at();

drop trigger if exists appointments_set_updated_at on public.appointments;
create trigger appointments_set_updated_at before update on public.appointments
for each row execute function public.set_updated_at();

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
  v_window record;
  v_candidate timestamptz;
  v_candidate_end timestamptz;
  v_window_end timestamptz;
begin
  if p_date is null or coalesce(array_length(p_service_slugs, 1), 0) = 0 then
    return;
  end if;

  select s.* into v_staff
  from public.staff s
  join public.locations l on l.id = s.location_id
  where s.slug = p_staff_slug and s.active and l.active
  limit 1;
  if not found then return; end if;

  select l.* into v_location from public.locations l where l.id = v_staff.location_id;

  if p_date < (now() at time zone v_location.timezone)::date
     or p_date > ((now() at time zone v_location.timezone)::date + v_location.booking_horizon_days) then
    return;
  end if;

  select count(*), sum(s.duration_minutes + s.buffer_before_minutes + s.buffer_after_minutes)
    into v_service_count, v_duration_minutes
  from public.services s
  join public.staff_services ss on ss.service_id = s.id and ss.staff_id = v_staff.id and ss.active
  where s.location_id = v_location.id and s.active and s.slug = any(p_service_slugs);

  if v_service_count <> cardinality(p_service_slugs) or v_duration_minutes is null then return; end if;

  for v_window in
    select bh.opens_at, bh.closes_at
    from public.business_hours bh
    where bh.staff_id = v_staff.id
      and bh.active
      and bh.weekday = extract(dow from p_date)::smallint
    order by bh.opens_at
  loop
    v_candidate := (p_date + v_window.opens_at) at time zone v_location.timezone;
    v_window_end := (p_date + v_window.closes_at) at time zone v_location.timezone;

    while v_candidate + make_interval(mins => v_duration_minutes) <= v_window_end loop
      v_candidate_end := v_candidate + make_interval(mins => v_duration_minutes);

      if v_candidate >= now() + make_interval(mins => v_location.min_notice_minutes)
         and not exists (
           select 1 from public.schedule_blocks b
           where b.staff_id = v_staff.id
             and tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(v_candidate, v_candidate_end, '[)')
         )
         and not exists (
           select 1 from public.appointments a
           where a.staff_id = v_staff.id
             and a.status in ('pending', 'confirmed')
             and tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(v_candidate, v_candidate_end, '[)')
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
  p_service_slugs text[],
  p_staff_slug text,
  p_starts_at timestamptz,
  p_customer_name text,
  p_customer_phone text,
  p_notes text,
  p_privacy_version text,
  p_idempotency_key text,
  p_source text default 'website',
  p_client_ip_hint text default 'absent'
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
  v_duration_minutes integer;
  v_existing public.appointments%rowtype;
begin
  if p_idempotency_key is null or length(p_idempotency_key) < 16 then
    raise exception 'invalid_idempotency_key';
  end if;

  select a.* into v_existing from public.appointments a where a.idempotency_key = p_idempotency_key;
  if found then
    reference := v_existing.reference;
    status := v_existing.status;
    starts_at := v_existing.starts_at;
    return next;
    return;
  end if;

  select s.* into v_staff
  from public.staff s
  join public.locations l on l.id = s.location_id
  where s.slug = p_staff_slug and s.active and l.active
  limit 1;
  if not found then raise exception 'staff_unavailable'; end if;
  select l.* into v_location from public.locations l where l.id = v_staff.location_id;

  if not exists (
    select 1
    from public.public_available_slots(
      (p_starts_at at time zone v_location.timezone)::date,
      p_staff_slug,
      p_service_slugs
    ) slot
    where slot.starts_at = p_starts_at
  ) then
    raise exception 'slot_unavailable';
  end if;

  select sum(s.duration_minutes + s.buffer_before_minutes + s.buffer_after_minutes)
    into v_duration_minutes
  from public.services s
  where s.location_id = v_location.id and s.active and s.slug = any(p_service_slugs);

  insert into public.customers (location_id, name, phone_normalized)
  values (v_location.id, trim(p_customer_name), p_customer_phone)
  on conflict (location_id, phone_normalized)
  do update set name = excluded.name, updated_at = now()
  returning id into v_customer_id;

  insert into public.appointments (
    location_id, staff_id, customer_id, starts_at, ends_at, status, source, notes,
    privacy_version, idempotency_key
  ) values (
    v_location.id, v_staff.id, v_customer_id, p_starts_at,
    p_starts_at + make_interval(mins => v_duration_minutes), 'pending', p_source,
    coalesce(trim(p_notes), ''), p_privacy_version, p_idempotency_key
  ) returning id into v_appointment_id;

  insert into public.appointment_items (
    appointment_id, service_id, service_name_snapshot, duration_minutes_snapshot, price_cents_snapshot
  )
  select v_appointment_id, s.id, s.name, s.duration_minutes, s.price_cents
  from public.services s
  where s.location_id = v_location.id and s.active and s.slug = any(p_service_slugs);

  insert into public.appointment_status_history (appointment_id, from_status, to_status, actor_type)
  values (v_appointment_id, null, 'pending', 'customer');

  insert into public.integration_outbox (appointment_id, event_type, payload, idempotency_key)
  values (
    v_appointment_id,
    'booking.created',
    jsonb_build_object('reference', (select a.reference from public.appointments a where a.id = v_appointment_id)),
    p_idempotency_key || ':booking.created'
  );

  return query
    select a.reference, a.status, a.starts_at from public.appointments a where a.id = v_appointment_id;
exception
  when exclusion_violation then
    raise exception 'slot_unavailable';
  when unique_violation then
    select a.* into v_existing from public.appointments a where a.idempotency_key = p_idempotency_key;
    if found then
      reference := v_existing.reference;
      status := v_existing.status;
      starts_at := v_existing.starts_at;
      return next;
      return;
    end if;
    raise;
end;
$$;

insert into public.locations (slug, name, timezone, currency, active)
values ('via-corato-48', 'La Barberia Sgarra', 'Europe/Rome', 'EUR', true)
on conflict (slug) do update set name = excluded.name, timezone = excluded.timezone;

insert into public.staff (location_id, slug, display_name, active)
select l.id, 'paolo-sgarra', 'Paolo Sgarra', true
from public.locations l where l.slug = 'via-corato-48'
on conflict (location_id, slug) do update set display_name = excluded.display_name, active = true;

alter table public.locations enable row level security;
alter table public.staff enable row level security;
alter table public.services enable row level security;
alter table public.staff_services enable row level security;
alter table public.business_hours enable row level security;
alter table public.schedule_blocks enable row level security;
alter table public.customers enable row level security;
alter table public.appointments enable row level security;
alter table public.appointment_items enable row level security;
alter table public.appointment_status_history enable row level security;
alter table public.integration_outbox enable row level security;

revoke all on function public.public_available_slots(date, text, text[]) from public, anon, authenticated;
revoke all on function public.create_public_booking(text[], text, timestamptz, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.public_available_slots(date, text, text[]) to service_role;
grant execute on function public.create_public_booking(text[], text, timestamptz, text, text, text, text, text, text, text) to service_role;

commit;
