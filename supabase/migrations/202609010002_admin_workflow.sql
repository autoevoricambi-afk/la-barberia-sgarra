begin;

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
  v_allowed boolean := false;
begin
  select a.* into v_appointment
  from public.appointments a
  where a.id = p_appointment_id
  for update;
  if not found then raise exception 'appointment_not_found'; end if;

  v_allowed := case v_appointment.status
    when 'pending' then p_to_status in ('confirmed', 'cancelled_by_customer', 'cancelled_by_shop')
    when 'confirmed' then p_to_status in ('completed', 'cancelled_by_customer', 'cancelled_by_shop', 'no_show')
    else false
  end;
  if not v_allowed then raise exception 'invalid_transition'; end if;

  update public.appointments a
  set status = p_to_status
  where a.id = p_appointment_id;

  insert into public.appointment_status_history (
    appointment_id, from_status, to_status, actor_type, actor_id, reason
  ) values (
    p_appointment_id, v_appointment.status, p_to_status, 'staff', p_actor_id, coalesce(trim(p_reason), '')
  );

  insert into public.integration_outbox (appointment_id, event_type, payload, idempotency_key)
  values (
    p_appointment_id,
    'booking.status_changed',
    jsonb_build_object('reference', v_appointment.reference, 'from', v_appointment.status, 'to', p_to_status),
    p_appointment_id::text || ':status:' || p_to_status || ':' || extract(epoch from clock_timestamp())::bigint::text
  );

  return query
    select a.id, a.reference, a.status, a.starts_at, a.ends_at
    from public.appointments a where a.id = p_appointment_id;
end;
$$;

revoke all on function public.admin_transition_appointment(uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.admin_transition_appointment(uuid, text, uuid, text) to service_role;

commit;
