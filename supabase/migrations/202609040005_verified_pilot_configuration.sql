begin;

-- Configurazione confermata il 4 settembre 2026.
-- I prezzi restano intenzionalmente null e il booking pubblico resta spento
-- fino al collaudo end-to-end con l'email amministrativa autorizzata.

update public.locations
set slot_interval_minutes = 30,
    public_booking_enabled = false,
    updated_at = now()
where slug = 'via-corato-48';

with target_location as (
  select id from public.locations where slug = 'via-corato-48'
), verified_services(slug, name, description, sort_order) as (
  values
    ('taglio-uomo', 'Taglio uomo', 'Forma e rifinitura.', 10),
    ('fade', 'Fade', 'Sfumatura e transizione pulita.', 20),
    ('taglio-barba', 'Taglio + barba', 'Il servizio completo.', 30),
    ('barba', 'Barba', 'Contorni e proporzioni.', 40),
    ('cambio-look', 'Cambio look', 'Un taglio costruito da zero.', 50),
    ('rasatura', 'Rasatura', 'Finitura netta.', 60),
    ('shampoo', 'Shampoo', 'Da abbinare al taglio.', 70),
    ('doppio-shampoo', 'Doppio shampoo', 'Lavaggio più completo.', 80),
    ('shampoo-styling', 'Shampoo + styling', 'Chiusura con prodotto.', 90)
)
insert into public.services (
  location_id, slug, name, description, duration_minutes,
  buffer_before_minutes, buffer_after_minutes, price_cents, active, sort_order
)
select l.id, s.slug, s.name, s.description, 30, 0, 0, null, true, s.sort_order
from target_location l cross join verified_services s
on conflict (location_id, slug) do update set
  name = excluded.name,
  description = excluded.description,
  duration_minutes = 30,
  buffer_before_minutes = 0,
  buffer_after_minutes = 0,
  price_cents = null,
  active = true,
  sort_order = excluded.sort_order,
  updated_at = now();

update public.services s
set active = false, updated_at = now()
from public.locations l
where s.location_id = l.id
  and l.slug = 'via-corato-48'
  and s.slug not in (
    'taglio-uomo', 'fade', 'taglio-barba', 'barba', 'cambio-look',
    'rasatura', 'shampoo', 'doppio-shampoo', 'shampoo-styling'
  );

insert into public.staff_services (staff_id, service_id, active)
select st.id, sv.id, sv.active
from public.staff st
join public.locations l on l.id = st.location_id and l.slug = 'via-corato-48'
join public.services sv on sv.location_id = l.id
where st.slug = 'paolo-sgarra'
on conflict (staff_id, service_id) do update set active = excluded.active;

delete from public.business_hours bh
using public.staff st, public.locations l
where bh.staff_id = st.id
  and st.location_id = l.id
  and st.slug = 'paolo-sgarra'
  and l.slug = 'via-corato-48';

with paolo as (
  select st.id
  from public.staff st
  join public.locations l on l.id = st.location_id
  where st.slug = 'paolo-sgarra' and l.slug = 'via-corato-48'
), verified_hours(weekday, opens_at, closes_at) as (
  values
    (2, time '08:30', time '13:00'),
    (2, time '15:30', time '20:30'),
    (3, time '08:30', time '13:00'),
    (3, time '15:30', time '20:30'),
    (4, time '08:30', time '13:00'),
    (4, time '15:30', time '20:30'),
    (5, time '08:30', time '13:00'),
    (5, time '14:30', time '20:30'),
    (6, time '08:30', time '20:30')
)
insert into public.business_hours (staff_id, weekday, opens_at, closes_at, active)
select p.id, h.weekday, h.opens_at, h.closes_at, true
from paolo p cross join verified_hours h;

commit;
