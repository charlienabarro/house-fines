-- =====================================================================
-- Closing submissions early no longer "uses up" that Friday.
--
-- Before: starting fines night early marked the current Friday's week as
-- played, so afterwards new accusations (and the countdown) jumped to the
-- Friday after.
--
-- Now: the current week's deadline is moved to the moment fines night
-- starts, so it becomes its own week dated today. This Friday's week is
-- created fresh by the next submission, the countdown stays on this
-- Friday, and everyone's weekly count starts again at 0.
--
-- Practice runs keep the old approach, because they must leave the
-- deadline untouched when they're undone.
-- =====================================================================

create or replace function public.start_party(
  p_include_current boolean default false,
  p_practice        boolean default false
)
returns void
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_state   public.app_state;
  v_current timestamptz;
  v_cutoff  timestamptz;
begin
  perform private.assert_host();
  select * into v_state from public.app_state where id = 1 for update;
  if v_state.mode = 'party' then
    raise exception 'Fines night is already on.';
  end if;

  v_cutoff := now();

  if p_include_current then
    v_current := private.open_deadline();
    if p_practice then
      -- Practice: include the current week as-is; end_party reopens it.
      insert into public.weeks (deadline) values (v_current) on conflict (deadline) do nothing;
      v_cutoff := v_current;
    else
      -- Real night: close the current week now, so this Friday stays free.
      update public.weeks set deadline = v_cutoff
      where deadline = v_current and status = 'open';
    end if;
  end if;

  update public.weeks set status = 'party'
  where status = 'open' and deadline <= v_cutoff;

  update public.app_state
  set mode = 'party', phase = null, current_motion_id = null,
      party_started_at = now(), practice = p_practice
  where id = 1;
end;
$$;

revoke execute on function public.start_party(boolean, boolean) from public, anon;
grant execute on function public.start_party(boolean, boolean) to authenticated;
