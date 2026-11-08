-- =====================================================================
-- Practice runs: fines night that leaves no trace.
--
-- start_party(..., p_practice => true) runs the night exactly as normal.
-- end_party() then puts everything back: motions return to unheard,
-- votes are deleted, results are cleared and the weeks reopen, so
-- nothing reaches the history page.
-- =====================================================================

alter table public.app_state
  add column practice boolean not null default false;

-- Replace start_party with a version that takes p_practice.
drop function public.start_party(boolean);

create or replace function public.start_party(
  p_include_current boolean default false,
  p_practice        boolean default false
)
returns void
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_state public.app_state;
  v_cutoff timestamptz;
begin
  perform private.assert_host();
  select * into v_state from public.app_state where id = 1 for update;
  if v_state.mode = 'party' then
    raise exception 'Fines night is already on.';
  end if;

  v_cutoff := case when p_include_current then private.open_deadline() else now() end;

  if p_include_current then
    insert into public.weeks (deadline) values (v_cutoff) on conflict (deadline) do nothing;
  end if;

  update public.weeks set status = 'party'
  where status = 'open' and deadline <= v_cutoff;

  update public.app_state
  set mode = 'party', phase = null, current_motion_id = null,
      party_started_at = now(), practice = p_practice
  where id = 1;
end;
$$;

create or replace function public.end_party()
returns void
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_state public.app_state;
begin
  perform private.assert_host();
  select * into v_state from public.app_state where id = 1 for update;
  if v_state.mode <> 'party' then
    raise exception 'Fines night isn''t on.';
  end if;

  if v_state.practice then
    -- Practice: undo everything that happened tonight.
    update public.app_state set current_motion_id = null, phase = null where id = 1;

    delete from public.votes v
    using public.motions m, public.weeks w
    where v.motion_id = m.id and m.week_id = w.id and w.status = 'party';

    update public.motions m
    set status = 'pending', votes_cast = 0, fine_votes = null, no_fine_votes = null,
        opened_at = null, resolved_at = null
    from public.weeks w
    where m.week_id = w.id and w.status = 'party';

    update public.weeks set status = 'open' where status = 'party';
  else
    if v_state.current_motion_id is not null then
      delete from public.votes
      where motion_id = v_state.current_motion_id
        and exists (select 1 from public.motions where id = v_state.current_motion_id and status = 'active');
      update public.motions
      set status = 'skipped', votes_cast = 0, resolved_at = now()
      where id = v_state.current_motion_id and status = 'active';
    end if;

    update public.weeks set status = 'archived', archived_at = now() where status = 'party';
  end if;

  update public.app_state
  set mode = 'submit', phase = null, current_motion_id = null,
      party_started_at = null, practice = false
  where id = 1;
end;
$$;

revoke execute on function public.start_party(boolean, boolean) from public, anon;
grant execute on function public.start_party(boolean, boolean) to authenticated;
revoke execute on function public.end_party() from public, anon;
grant execute on function public.end_party() to authenticated;
