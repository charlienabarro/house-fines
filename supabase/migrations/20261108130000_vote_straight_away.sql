-- =====================================================================
-- No separate discussion phase: a motion opens straight into voting.
-- The house can argue it out while the Fine / No fine buttons are up.
-- =====================================================================

create or replace function private.advance_to_next_motion()
returns uuid
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_next uuid;
begin
  select m.id into v_next
  from public.motions m
  join public.weeks w on w.id = m.week_id
  where w.status = 'party' and m.status = 'pending'
  order by random()
  limit 1;

  if v_next is null then
    update public.app_state set current_motion_id = null, phase = null where id = 1;
    return null;
  end if;

  update public.motions set status = 'active', opened_at = now() where id = v_next;
  update public.app_state set current_motion_id = v_next, phase = 'voting' where id = 1;
  return v_next;
end;
$$;

revoke execute on function private.advance_to_next_motion() from public, anon, authenticated;
