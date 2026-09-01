-- Compilare esclusivamente dopo l'intervista a Paolo.
-- Nessun prezzo, durata o orario è stato inventato nel database di fondazione.

-- Esempio di forma, intenzionalmente non eseguibile senza sostituire i valori NULL:
-- insert into public.services (
--   location_id, slug, name, description, duration_minutes, price_cents, active, sort_order
-- )
-- select id, 'taglio-uomo', 'Taglio uomo', 'Forma e rifinitura.', NULL, NULL, false, 10
-- from public.locations where slug = 'via-corato-48';

-- Gli orari spezzati usano due righe per giornata:
-- insert into public.business_hours (staff_id, weekday, opens_at, closes_at)
-- select id, NULL, NULL, NULL from public.staff where slug = 'paolo-sgarra';
