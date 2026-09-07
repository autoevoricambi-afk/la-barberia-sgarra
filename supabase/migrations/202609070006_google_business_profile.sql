begin;

-- Link ufficiale condiviso da Paolo. Alimenta sia il profilo pubblico sia
-- le richieste recensione create dal gestionale dopo un appuntamento completato.
update public.locations
set
  review_url = 'https://share.google/LM2DalvQ9mnTZB1kh',
  updated_at = now()
where slug = 'via-corato-48';

commit;
