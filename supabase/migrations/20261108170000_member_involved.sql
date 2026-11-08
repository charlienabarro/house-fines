-- =====================================================================
-- Optional housemates: the host can mark someone as not involved.
--
-- A member who isn't involved can still sign in and watch, but can't be
-- accused, can't submit accusations and can't vote, and doesn't count
-- towards "x of y voted".
-- =====================================================================

alter table public.members
  add column active boolean not null default true;

create or replace function private.is_active_member()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.members where id = (select auth.uid()) and active);
$$;

-- Voting needs an involved member.
create or replace function private.can_vote_on(p_motion_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select private.is_active_member()
     and private.voting_open_for(p_motion_id)
     and (
       (select accused_can_vote from public.app_state where id = 1)
       or not exists (
         select 1 from public.motions
         where id = p_motion_id and accused_id = (select auth.uid())
       )
     );
$$;

-- Submitting needs an involved member, accusing an involved member.
create or replace function public.submit_motion(
  p_accused_id uuid,
  p_reason     text,
  p_punishment text default null
)
returns void
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_uid        uuid := auth.uid();
  v_state      public.app_state;
  v_deadline   timestamptz;
  v_week_id    bigint;
  v_count      integer;
  v_reason     text := btrim(coalesce(p_reason, ''));
  v_punishment text := nullif(btrim(coalesce(p_punishment, '')), '');
begin
  if v_uid is null or not private.is_member() then
    raise exception 'You need to be signed in.' using errcode = '42501';
  end if;
  if not private.is_active_member() then
    raise exception 'The host has you sitting this one out.';
  end if;

  select * into v_state from public.app_state where id = 1;
  if v_state.mode = 'party' then
    raise exception 'Fines night is on. Submissions reopen once it''s over.';
  end if;

  if p_accused_id is null
     or not exists (select 1 from public.members where id = p_accused_id and active) then
    raise exception 'Pick someone from the house.';
  end if;
  if char_length(v_reason) < 3 then
    raise exception 'Give a reason (at least 3 characters).';
  end if;
  if char_length(v_reason) > 500 then
    raise exception 'Keep the reason under 500 characters.';
  end if;
  if char_length(v_punishment) > 60 then
    raise exception 'Keep the punishment under 60 characters.';
  end if;

  v_deadline := private.open_deadline();
  insert into public.weeks (deadline) values (v_deadline) on conflict (deadline) do nothing;
  select id into v_week_id from public.weeks where deadline = v_deadline;

  insert into public.submission_counts as sc (member_id, week_id, submitted)
  values (v_uid, v_week_id, 1)
  on conflict (member_id, week_id) do update set submitted = sc.submitted + 1
  returning submitted into v_count;

  if v_count > v_state.submission_limit then
    raise exception 'You''ve used all % of your motions this week.', v_state.submission_limit;
  end if;

  insert into public.motions (week_id, accused_id, reason, punishment)
  values (v_week_id, p_accused_id, v_reason, v_punishment);
end;
$$;

-- Host: switch someone in or out.
create or replace function public.set_member_active(p_member_id uuid, p_active boolean)
returns void
language plpgsql volatile security definer
set search_path = ''
as $$
begin
  perform private.assert_host();
  if exists (select 1 from public.members where id = p_member_id and is_host) and not p_active then
    raise exception 'The host is always involved.';
  end if;
  update public.members set active = p_active where id = p_member_id;
  if not found then
    raise exception 'No such housemate.';
  end if;
end;
$$;

revoke execute on function private.is_active_member() from public, anon;
grant execute on function private.is_active_member() to authenticated;
revoke execute on function private.can_vote_on(uuid) from public, anon;
grant execute on function private.can_vote_on(uuid) to authenticated;
revoke execute on function public.submit_motion(uuid, text, text) from public, anon;
grant execute on function public.submit_motion(uuid, text, text) to authenticated;
revoke execute on function public.set_member_active(uuid, boolean) from public, anon;
grant execute on function public.set_member_active(uuid, boolean) to authenticated;

-- Phones refresh the house list live when the host flips someone.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.members;
  end if;
end;
$$;
