begin;

create sequence if not exists public.waitlist_reference_seq;

alter table public.locations
  add column if not exists public_booking_enabled boolean not null default false,
  add column if not exists review_url text not null default '',
  add column if not exists cancellation_strike_limit integer not null default 3 check (cancellation_strike_limit between 1 and 10),
  add column if not exists deposit_amount_cents integer not null default 0 check (deposit_amount_cents between 0 and 100000),
  add column if not exists deposit_payment_url text not null default '';

alter table public.customers
  add column if not exists email text,
  add column if not exists completed_visits integer not null default 0 check (completed_visits >= 0),
  add column if not exists late_cancellations integer not null default 0 check (late_cancellations >= 0),
  add column if not exists no_show_count integer not null default 0 check (no_show_count >= 0),
  add column if not exists deposit_required boolean not null default false,
  add column if not exists last_visit_at timestamptz;

alter table public.appointments
  add column if not exists deposit_required boolean not null default false,
  add column if not exists deposit_amount_cents integer not null default 0 check (deposit_amount_cents between 0 and 100000),
  add column if not exists deposit_status text not null default 'not_required' check (
    deposit_status in ('not_required', 'pending', 'paid', 'waived', 'refunded')
  ),
  add column if not exists late_cancellation boolean not null default false;

alter table public.booking_events drop constraint if exists booking_events_event_name_check;
alter table public.booking_events add constraint booking_events_event_name_check check (event_name in (
  'service_view', 'booking_start', 'slot_view', 'slot_selected', 'booking_confirmed',
  'booking_cancelled', 'appointment_completed', 'no_show', 'review_requested',
  'review_clicked', 'rebooking_confirmed', 'waitlist_joined'
));

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  sku text not null default '',
  name text not null,
  unit text not null default 'pz',
  stock_quantity numeric(12,2) not null default 0 check (stock_quantity >= 0),
  low_stock_threshold numeric(12,2) not null default 2 check (low_stock_threshold >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists products_location_name_idx
  on public.products (location_id, lower(name));
create unique index if not exists products_location_sku_idx
  on public.products (location_id, sku) where sku <> '';
create index if not exists products_low_stock_idx
  on public.products (location_id, active, stock_quantity, low_stock_threshold);

create table if not exists public.inventory_movements (
  id bigint generated always as identity primary key,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity_delta numeric(12,2) not null check (quantity_delta <> 0),
  quantity_after numeric(12,2) not null check (quantity_after >= 0),
  reason text not null check (reason in ('sale', 'use', 'restock', 'correction', 'waste')),
  note text not null default '',
  actor_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists inventory_movements_product_created_idx
  on public.inventory_movements (product_id, created_at desc);

create table if not exists public.waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default (
    'WL-' || to_char(current_date, 'YYMMDD') || '-' || lpad(nextval('public.waitlist_reference_seq')::text, 5, '0')
  ),
  location_id uuid not null references public.locations(id) on delete cascade,
  staff_id uuid not null references public.staff(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete restrict,
  service_slugs text[] not null check (cardinality(service_slugs) between 1 and 4),
  desired_date date not null,
  time_preference text not null default 'any' check (time_preference in ('morning', 'afternoon', 'any')),
  notes text not null default '',
  status text not null default 'waiting' check (status in ('waiting', 'notified', 'booked', 'cancelled', 'expired')),
  privacy_version text not null,
  consent_at timestamptz not null default now(),
  notified_at timestamptz,
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists waitlist_match_idx
  on public.waitlist_entries (staff_id, desired_date, status);

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at before update on public.products
for each row execute function public.set_updated_at();

drop trigger if exists waitlist_set_updated_at on public.waitlist_entries;
create trigger waitlist_set_updated_at before update on public.waitlist_entries
for each row execute function public.set_updated_at();

create or replace function public.apply_customer_deposit_policy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_required boolean;
  v_amount integer;
begin
  select c.deposit_required, l.deposit_amount_cents
  into v_required, v_amount
  from public.customers c
  join public.locations l on l.id = c.location_id
  where c.id = new.customer_id;

  new.deposit_required := coalesce(v_required, false);
  new.deposit_amount_cents := case when coalesce(v_required, false) then coalesce(v_amount, 0) else 0 end;
  new.deposit_status := case
    when coalesce(v_required, false) and coalesce(v_amount, 0) > 0 then 'pending'
    else 'not_required'
  end;
  return new;
end;
$$;

drop trigger if exists appointments_apply_deposit_policy on public.appointments;
create trigger appointments_apply_deposit_policy
before insert on public.appointments
for each row execute function public.apply_customer_deposit_policy();

create or replace function public.public_booking_configuration()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'configured', exists (
      select 1 from public.services s where s.location_id = l.id and s.active
    ) and exists (
      select 1 from public.business_hours h join public.staff st on st.id = h.staff_id
      where st.location_id = l.id and st.active and h.active
    ),
    'bookingEnabled', l.public_booking_enabled,
    'bookingHorizonDays', l.booking_horizon_days,
    'reviewUrl', l.review_url,
    'services', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.slug,
        'label', s.name,
        'description', s.description,
        'durationMinutes', s.duration_minutes,
        'priceCents', s.price_cents
      ) order by s.sort_order, s.name)
      from public.services s
      where s.location_id = l.id and s.active
    ), '[]'::jsonb)
  )
  from public.locations l
  where l.slug = 'via-corato-48' and l.active
  limit 1;
$$;

create or replace function public.join_public_waitlist(
  p_service_slugs text[],
  p_staff_slug text,
  p_desired_date date,
  p_time_preference text,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text,
  p_notes text,
  p_privacy_version text,
  p_idempotency_key text
)
returns table (reference text, status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff public.staff%rowtype;
  v_location public.locations%rowtype;
  v_customer_id uuid;
  v_entry public.waitlist_entries%rowtype;
  v_service_count integer;
begin
  if p_idempotency_key is null or length(p_idempotency_key) < 16 then raise exception 'invalid_idempotency_key'; end if;
  select w.* into v_entry from public.waitlist_entries w where w.idempotency_key = p_idempotency_key;
  if found then reference := v_entry.reference; status := v_entry.status; return next; return; end if;

  select s.* into v_staff
  from public.staff s join public.locations l on l.id = s.location_id
  where s.slug = p_staff_slug and s.active and l.active limit 1;
  if not found then raise exception 'staff_unavailable'; end if;
  select l.* into v_location from public.locations l where l.id = v_staff.location_id;
  if not v_location.public_booking_enabled then raise exception 'booking_not_enabled'; end if;
  if p_desired_date < (now() at time zone v_location.timezone)::date
     or p_desired_date > ((now() at time zone v_location.timezone)::date + v_location.booking_horizon_days) then
    raise exception 'invalid_waitlist_date';
  end if;
  if p_time_preference not in ('morning', 'afternoon', 'any') then raise exception 'invalid_time_preference'; end if;

  select count(*) into v_service_count
  from public.services s
  join public.staff_services ss on ss.service_id = s.id and ss.staff_id = v_staff.id and ss.active
  where s.location_id = v_location.id and s.active and s.slug = any(p_service_slugs);
  if v_service_count <> cardinality(p_service_slugs) then raise exception 'invalid_services'; end if;

  insert into public.customers (location_id, name, phone_normalized, email)
  values (v_location.id, trim(p_customer_name), p_customer_phone, nullif(lower(trim(p_customer_email)), ''))
  on conflict (location_id, phone_normalized) do update set
    name = excluded.name,
    email = coalesce(excluded.email, public.customers.email),
    updated_at = now()
  returning id into v_customer_id;

  insert into public.waitlist_entries (
    location_id, staff_id, customer_id, service_slugs, desired_date, time_preference,
    notes, privacy_version, idempotency_key
  ) values (
    v_location.id, v_staff.id, v_customer_id, p_service_slugs, p_desired_date,
    p_time_preference, coalesce(trim(p_notes), ''), p_privacy_version, p_idempotency_key
  ) returning * into v_entry;

  insert into public.integration_outbox (appointment_id, event_type, payload, idempotency_key)
  values (
    null,
    'waitlist.created',
    jsonb_build_object('waitlistId', v_entry.id, 'reference', v_entry.reference, 'name', trim(p_customer_name),
      'phone', p_customer_phone, 'email', nullif(lower(trim(p_customer_email)), ''),
      'services', p_service_slugs, 'desiredDate', p_desired_date, 'timePreference', p_time_preference),
    p_idempotency_key || ':waitlist.created'
  );

  reference := v_entry.reference; status := v_entry.status; return next;
exception
  when unique_violation then
    select w.* into v_entry from public.waitlist_entries w where w.idempotency_key = p_idempotency_key;
    if found then reference := v_entry.reference; status := v_entry.status; return next; return; end if;
    raise;
end;
$$;

create or replace function public.create_public_booking_v2(
  p_service_slugs text[],
  p_staff_slug text,
  p_starts_at timestamptz,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text,
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
  v_reference text;
  v_status text;
  v_starts_at timestamptz;
  v_enabled boolean;
begin
  select l.public_booking_enabled into v_enabled
  from public.staff s join public.locations l on l.id = s.location_id
  where s.slug = p_staff_slug and s.active and l.active limit 1;
  if not coalesce(v_enabled, false) then raise exception 'booking_not_enabled'; end if;

  select b.reference, b.status, b.starts_at
  into v_reference, v_status, v_starts_at
  from public.create_public_booking(
    p_service_slugs, p_staff_slug, p_starts_at, p_customer_name, p_customer_phone,
    p_notes, p_privacy_version, p_idempotency_key, p_source, p_client_ip_hint
  ) b;

  if nullif(trim(p_customer_email), '') is not null then
    update public.customers c set email = lower(trim(p_customer_email))
    from public.appointments a
    where a.reference = v_reference and a.customer_id = c.id;
  end if;
  reference := v_reference; status := v_status; starts_at := v_starts_at; return next;
end;
$$;

create or replace function public.admin_upsert_product(
  p_product_id uuid,
  p_sku text,
  p_name text,
  p_unit text,
  p_low_stock_threshold numeric,
  p_active boolean,
  p_actor_id uuid
)
returns public.products
language plpgsql
security definer
set search_path = public
as $$
declare
  v_location_id uuid;
  v_product public.products%rowtype;
begin
  select id into v_location_id from public.locations where slug = 'via-corato-48' limit 1;
  if v_location_id is null then raise exception 'location_not_found'; end if;

  if p_product_id is null then
    insert into public.products (location_id, sku, name, unit, low_stock_threshold, active)
    values (v_location_id, coalesce(trim(p_sku), ''), trim(p_name), trim(p_unit), p_low_stock_threshold, p_active)
    returning * into v_product;
  else
    update public.products p set
      sku = coalesce(trim(p_sku), ''), name = trim(p_name), unit = trim(p_unit),
      low_stock_threshold = p_low_stock_threshold, active = p_active
    where p.id = p_product_id and p.location_id = v_location_id
    returning * into v_product;
    if not found then raise exception 'product_not_found'; end if;
  end if;
  return v_product;
end;
$$;

create or replace function public.admin_record_inventory_movement(
  p_product_id uuid,
  p_quantity_delta numeric,
  p_reason text,
  p_note text,
  p_actor_id uuid
)
returns public.products
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product public.products%rowtype;
  v_before numeric;
  v_after numeric;
  v_movement_id bigint;
begin
  if p_quantity_delta = 0 or p_reason not in ('sale', 'use', 'restock', 'correction', 'waste') then
    raise exception 'invalid_inventory_movement';
  end if;
  select p.* into v_product from public.products p where p.id = p_product_id and p.active for update;
  if not found then raise exception 'product_not_found'; end if;
  v_before := v_product.stock_quantity;
  v_after := v_before + p_quantity_delta;
  if v_after < 0 then raise exception 'insufficient_stock'; end if;

  update public.products set stock_quantity = v_after where id = p_product_id returning * into v_product;
  insert into public.inventory_movements (product_id, quantity_delta, quantity_after, reason, note, actor_id)
  values (p_product_id, p_quantity_delta, v_after, p_reason, coalesce(trim(p_note), ''), p_actor_id)
  returning id into v_movement_id;

  if v_after <= v_product.low_stock_threshold
     and (v_before > v_product.low_stock_threshold or p_reason in ('sale', 'use', 'waste')) then
    insert into public.integration_outbox (appointment_id, event_type, payload, idempotency_key)
    values (
      null,
      'inventory.low_stock',
      jsonb_build_object('productId', v_product.id, 'productName', v_product.name,
        'quantity', v_after, 'unit', v_product.unit, 'threshold', v_product.low_stock_threshold),
      'inventory:' || v_movement_id::text || ':low-stock'
    ) on conflict (idempotency_key) do nothing;
  end if;
  return v_product;
end;
$$;

create or replace function public.admin_update_waitlist(
  p_waitlist_id uuid,
  p_status text,
  p_note text,
  p_actor_id uuid
)
returns public.waitlist_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry public.waitlist_entries%rowtype;
  v_customer public.customers%rowtype;
begin
  if p_status not in ('waiting', 'notified', 'booked', 'cancelled', 'expired') then raise exception 'invalid_waitlist_status'; end if;
  select w.* into v_entry from public.waitlist_entries w where w.id = p_waitlist_id for update;
  if not found then raise exception 'waitlist_not_found'; end if;
  select c.* into v_customer from public.customers c where c.id = v_entry.customer_id;

  update public.waitlist_entries set
    status = p_status,
    notes = case when nullif(trim(p_note), '') is null then notes else trim(p_note) end,
    notified_at = case when p_status = 'notified' then now() else notified_at end
  where id = p_waitlist_id returning * into v_entry;

  if p_status = 'notified' then
    insert into public.integration_outbox (appointment_id, event_type, payload, idempotency_key)
    values (
      null,
      'waitlist.slot_available',
      jsonb_build_object('waitlistId', v_entry.id, 'reference', v_entry.reference,
        'name', v_customer.name, 'phone', v_customer.phone_normalized, 'email', v_customer.email,
        'services', v_entry.service_slugs, 'desiredDate', v_entry.desired_date,
        'timePreference', v_entry.time_preference),
      v_entry.id::text || ':manual-notify:' || extract(epoch from clock_timestamp())::bigint::text
    );
  end if;
  return v_entry;
end;
$$;

create or replace function public.admin_set_deposit_status(
  p_appointment_id uuid,
  p_status text,
  p_actor_id uuid
)
returns table (id uuid, reference text, deposit_required boolean, deposit_amount_cents integer, deposit_status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appointment public.appointments%rowtype;
begin
  if p_status not in ('pending', 'paid', 'waived', 'refunded') then raise exception 'invalid_deposit_status'; end if;
  select a.* into v_appointment from public.appointments a where a.id = p_appointment_id for update;
  if not found then raise exception 'appointment_not_found'; end if;
  if not v_appointment.deposit_required and p_status not in ('waived', 'refunded') then raise exception 'deposit_not_required'; end if;

  update public.appointments a set deposit_status = p_status where a.id = p_appointment_id;
  insert into public.integration_outbox (appointment_id, event_type, payload, idempotency_key)
  values (p_appointment_id, 'deposit.status_changed', jsonb_build_object('status', p_status),
    p_appointment_id::text || ':deposit:' || p_status || ':' || extract(epoch from clock_timestamp())::bigint::text);
  return query select a.id, a.reference, a.deposit_required, a.deposit_amount_cents, a.deposit_status
  from public.appointments a where a.id = p_appointment_id;
end;
$$;

create or replace function public.admin_transition_appointment(
  p_appointment_id uuid,
  p_to_status text,
  p_actor_id uuid,
  p_reason text default null
)
returns table (id uuid, reference text, status text, starts_at timestamptz, ends_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appointment public.appointments%rowtype;
  v_location public.locations%rowtype;
  v_allowed boolean := false;
  v_late boolean := coalesce(p_reason, '') = 'late_cancellation';
  v_risk_count integer;
  v_services text[];
  v_wait record;
begin
  select a.* into v_appointment from public.appointments a where a.id = p_appointment_id for update;
  if not found then raise exception 'appointment_not_found'; end if;
  select l.* into v_location from public.locations l where l.id = v_appointment.location_id;

  v_allowed := case v_appointment.status
    when 'pending' then p_to_status in ('confirmed', 'cancelled_by_customer', 'cancelled_by_shop')
    when 'confirmed' then p_to_status in ('completed', 'cancelled_by_customer', 'cancelled_by_shop', 'no_show')
    else false
  end;
  if not v_allowed then raise exception 'invalid_transition'; end if;

  update public.appointments a set status = p_to_status, late_cancellation = v_late where a.id = p_appointment_id;
  insert into public.appointment_status_history (appointment_id, from_status, to_status, actor_type, actor_id, reason)
  values (p_appointment_id, v_appointment.status, p_to_status, 'staff', p_actor_id, coalesce(trim(p_reason), ''));

  if p_to_status = 'completed' then
    update public.customers set completed_visits = completed_visits + 1, last_visit_at = now()
    where id = v_appointment.customer_id;
    if nullif(v_location.review_url, '') is not null then
      insert into public.integration_outbox (appointment_id, event_type, payload, available_at, idempotency_key)
      values (p_appointment_id, 'review.request', jsonb_build_object('reviewUrl', v_location.review_url),
        now() + interval '2 hours', p_appointment_id::text || ':review.request')
      on conflict (idempotency_key) do nothing;
    end if;
  elsif p_to_status = 'no_show' or (p_to_status = 'cancelled_by_customer' and v_late) then
    update public.customers set
      no_show_count = no_show_count + case when p_to_status = 'no_show' then 1 else 0 end,
      late_cancellations = late_cancellations + case when v_late then 1 else 0 end
    where id = v_appointment.customer_id
    returning no_show_count + late_cancellations into v_risk_count;
    if v_risk_count >= v_location.cancellation_strike_limit then
      update public.customers set deposit_required = true where id = v_appointment.customer_id;
    end if;
  end if;

  insert into public.integration_outbox (appointment_id, event_type, payload, idempotency_key)
  values (
    p_appointment_id, 'booking.status_changed',
    jsonb_build_object('reference', v_appointment.reference, 'from', v_appointment.status, 'to', p_to_status, 'late', v_late),
    p_appointment_id::text || ':status:' || p_to_status || ':' || extract(epoch from clock_timestamp())::bigint::text
  );

  if p_to_status in ('cancelled_by_customer', 'cancelled_by_shop') then
    select array_agg(s.slug order by s.slug) into v_services
    from public.appointment_items i join public.services s on s.id = i.service_id
    where i.appointment_id = p_appointment_id;

    for v_wait in
      select w.id, w.reference, w.service_slugs, w.desired_date, w.time_preference,
        c.name, c.phone_normalized, c.email
      from public.waitlist_entries w join public.customers c on c.id = w.customer_id
      where w.staff_id = v_appointment.staff_id and w.status = 'waiting'
        and w.desired_date = (v_appointment.starts_at at time zone v_location.timezone)::date
        and w.service_slugs && coalesce(v_services, '{}'::text[])
      order by w.created_at asc limit 20
    loop
      insert into public.integration_outbox (appointment_id, event_type, payload, idempotency_key)
      values (
        p_appointment_id, 'waitlist.slot_available',
        jsonb_build_object('waitlistId', v_wait.id, 'reference', v_wait.reference,
          'name', v_wait.name, 'phone', v_wait.phone_normalized, 'email', v_wait.email,
          'services', v_wait.service_slugs, 'startsAt', v_appointment.starts_at,
          'timePreference', v_wait.time_preference),
        v_wait.id::text || ':slot:' || p_appointment_id::text
      ) on conflict (idempotency_key) do nothing;
    end loop;
  end if;

  return query select a.id, a.reference, a.status, a.starts_at, a.ends_at
  from public.appointments a where a.id = p_appointment_id;
end;
$$;

create or replace function public.enqueue_due_automations(p_now timestamptz default now())
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day_before integer := 0;
  v_same_day integer := 0;
  v_expired integer := 0;
begin
  insert into public.integration_outbox (appointment_id, event_type, payload, idempotency_key)
  select a.id, 'booking.reminder_day_before', '{}'::jsonb, a.id::text || ':reminder:day-before'
  from public.appointments a join public.locations l on l.id = a.location_id
  where a.status = 'confirmed'
    and (a.starts_at at time zone l.timezone)::date = (p_now at time zone l.timezone)::date + 1
  on conflict (idempotency_key) do nothing;
  get diagnostics v_day_before = row_count;

  insert into public.integration_outbox (appointment_id, event_type, payload, idempotency_key)
  select a.id, 'booking.reminder_same_day', '{}'::jsonb, a.id::text || ':reminder:same-day'
  from public.appointments a join public.locations l on l.id = a.location_id
  where a.status = 'confirmed' and a.starts_at > p_now
    and (a.starts_at at time zone l.timezone)::date = (p_now at time zone l.timezone)::date
  on conflict (idempotency_key) do nothing;
  get diagnostics v_same_day = row_count;

  update public.waitlist_entries w set status = 'expired'
  from public.locations l
  where w.location_id = l.id and w.status in ('waiting', 'notified')
    and w.desired_date < (p_now at time zone l.timezone)::date;
  get diagnostics v_expired = row_count;

  return jsonb_build_object('dayBefore', v_day_before, 'sameDay', v_same_day, 'waitlistExpired', v_expired);
end;
$$;

create or replace function public.admin_pilot_metrics(p_from timestamptz, p_to timestamptz)
returns jsonb
language sql
security definer
set search_path = public
as $$
  with scoped as (
    select a.*,
      coalesce((select sum(i.price_cents_snapshot) from public.appointment_items i where i.appointment_id = a.id), 0) as value_cents
    from public.appointments a where a.starts_at >= p_from and a.starts_at < p_to
  )
  select jsonb_build_object(
    'appointments', count(*),
    'pending', count(*) filter (where status = 'pending'),
    'confirmed', count(*) filter (where status = 'confirmed'),
    'completed', count(*) filter (where status = 'completed'),
    'cancelled', count(*) filter (where status in ('cancelled_by_customer', 'cancelled_by_shop')),
    'noShow', count(*) filter (where status = 'no_show'),
    'newCustomers', count(distinct customer_id),
    'website', count(*) filter (where source = 'website'),
    'manual', count(*) filter (where source <> 'website'),
    'estimatedRevenueCents', coalesce(sum(value_cents) filter (where status in ('confirmed', 'completed')), 0),
    'waitlist', (select count(*) from public.waitlist_entries where status in ('waiting', 'notified')),
    'lowStock', (select count(*) from public.products where active and stock_quantity <= low_stock_threshold),
    'atRiskCustomers', (select count(*) from public.customers where deposit_required)
  ) from scoped;
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
    slot_interval_minutes = (p_location->>'slot_interval_minutes')::integer,
    public_booking_enabled = coalesce((p_location->>'public_booking_enabled')::boolean, false),
    review_url = coalesce(p_location->>'review_url', ''),
    cancellation_strike_limit = coalesce((p_location->>'cancellation_strike_limit')::integer, 3),
    deposit_amount_cents = coalesce((p_location->>'deposit_amount_cents')::integer, 0),
    deposit_payment_url = coalesce(p_location->>'deposit_payment_url', '')
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
  return jsonb_build_object('activeServices', v_service_count, 'activeHours', v_hours_count,
    'publicBookingEnabled', coalesce((p_location->>'public_booking_enabled')::boolean, false));
end;
$$;

alter table public.products enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.waitlist_entries enable row level security;

revoke all on function public.public_booking_configuration() from public, anon, authenticated;
revoke all on function public.join_public_waitlist(text[], text, date, text, text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.create_public_booking_v2(text[], text, timestamptz, text, text, text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.admin_upsert_product(uuid, text, text, text, numeric, boolean, uuid) from public, anon, authenticated;
revoke all on function public.admin_record_inventory_movement(uuid, numeric, text, text, uuid) from public, anon, authenticated;
revoke all on function public.admin_update_waitlist(uuid, text, text, uuid) from public, anon, authenticated;
revoke all on function public.admin_set_deposit_status(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.enqueue_due_automations(timestamptz) from public, anon, authenticated;

grant execute on function public.public_booking_configuration() to service_role;
grant execute on function public.join_public_waitlist(text[], text, date, text, text, text, text, text, text, text) to service_role;
grant execute on function public.create_public_booking_v2(text[], text, timestamptz, text, text, text, text, text, text, text, text) to service_role;
grant execute on function public.admin_upsert_product(uuid, text, text, text, numeric, boolean, uuid) to service_role;
grant execute on function public.admin_record_inventory_movement(uuid, numeric, text, text, uuid) to service_role;
grant execute on function public.admin_update_waitlist(uuid, text, text, uuid) to service_role;
grant execute on function public.admin_set_deposit_status(uuid, text, uuid) to service_role;
grant execute on function public.enqueue_due_automations(timestamptz) to service_role;
grant execute on function public.admin_pilot_metrics(timestamptz, timestamptz) to service_role;

commit;
