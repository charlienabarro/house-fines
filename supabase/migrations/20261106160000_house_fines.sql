-- =====================================================================
-- House Fines: schema, row level security and game functions
--
-- Run this once against a fresh Supabase project, either:
--   * paste it into Supabase Dashboard -> SQL Editor -> Run, or
--   * `npx supabase db push` if you use the Supabase CLI.
--
-- Design notes
--   * Motions never store who submitted them. Spam is limited with
--     submission_counts (member + week + a number), which shares nothing
--     with a motion except the week.
--   * Clients never insert into motions directly. submit_motion() works
--     out the week from the server clock, so the Friday 18:00 deadline
--     can't be dodged by a client with a wrong clock.
--   * Everything the host does in party mode goes through a function that
--     checks the caller is the host.
--   * Helpers used by policies live in the "private" schema, which the
--     Supabase API doesn't expose, so nobody can call them over HTTP.
-- =====================================================================

create schema if not exists private;

-- ---------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------
create type public.app_mode      as enum ('submit', 'party');
create type public.party_phase   as enum ('discussion', 'voting', 'revealed');
create type public.motion_status as enum ('pending', 'active', 'passed', 'failed', 'skipped');
create type public.vote_choice   as enum ('fine', 'no_fine');
create type public.week_status   as enum ('open', 'party', 'archived');

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------

-- One row per housemate. id is the Supabase auth user id.
create table public.members (
  id           uuid primary key references auth.users (id) on delete cascade,
  username     text not null unique check (username ~ '^[a-z0-9][a-z0-9_.-]{1,31}$'),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 40),
  is_host      boolean not null default false,
  created_at   timestamptz not null default now()
);

-- At most one host.
create unique index members_one_host on public.members (is_host) where is_host;

-- A week is identified by its deadline (a Friday at 18:00 Europe/London).
--   open     -> still collecting, or closed but waiting for fines night
--   party    -> being played through right now
--   archived -> done, shows on the history page
create table public.weeks (
  id           bigint generated always as identity primary key,
  deadline     timestamptz not null unique,
  status       public.week_status not null default 'open',
  motion_count integer not null default 0 check (motion_count >= 0),
  archived_at  timestamptz
);

-- No submitter column, on purpose.
create table public.motions (
  id            uuid primary key default gen_random_uuid(),
  week_id       bigint not null references public.weeks (id) on delete cascade,
  accused_id    uuid not null references public.members (id) on delete cascade,
  reason        text not null check (char_length(reason) between 3 and 500),
  punishment    text check (punishment is null or char_length(punishment) between 1 and 60),
  status        public.motion_status not null default 'pending',
  votes_cast    integer not null default 0,
  fine_votes    integer,
  no_fine_votes integer,
  created_at    timestamptz not null default now(),
  opened_at     timestamptz,
  resolved_at   timestamptz
);

create index motions_week_status_idx on public.motions (week_id, status);
create index motions_accused_idx     on public.motions (accused_id);

-- One vote per member per motion.
create table public.votes (
  motion_id  uuid not null references public.motions (id) on delete cascade,
  member_id  uuid not null references public.members (id) on delete cascade,
  vote       public.vote_choice not null,
  created_at timestamptz not null default now(),
  primary key (motion_id, member_id)
);

create index votes_member_idx on public.votes (member_id);

-- Rate limit only. No timestamps and no motion ids, so it can't be matched
-- up with individual motions.
create table public.submission_counts (
  member_id uuid not null references public.members (id) on delete cascade,
  week_id   bigint not null references public.weeks (id) on delete cascade,
  submitted integer not null default 0,
  primary key (member_id, week_id)
);

-- Single row of global state that every phone subscribes to.
create table public.app_state (
  id                smallint primary key default 1 check (id = 1),
  mode              public.app_mode not null default 'submit',
  phase             public.party_phase,
  current_motion_id uuid references public.motions (id) on delete set null,
  accused_can_vote  boolean not null default true,
  submission_limit  integer not null default 10 check (submission_limit between 1 and 100),
  party_started_at  timestamptz,
  updated_at        timestamptz not null default now(),
  constraint submit_mode_has_no_motion check (mode = 'party' or (phase is null and current_motion_id is null))
);

insert into public.app_state (id) values (1);

-- ---------------------------------------------------------------------
-- Private helpers (not reachable over the API)
-- ---------------------------------------------------------------------

create or replace function private.is_member()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.members where id = (select auth.uid()));
$$;

create or replace function private.is_host()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.members where id = (select auth.uid()) and is_host);
$$;

create or replace function private.assert_host()
returns void
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not private.is_host() then
    raise exception 'Only the host can do that.' using errcode = '42501';
  end if;
end;
$$;

-- The first Friday 18:00 (Europe/London) strictly after ts.
-- The arithmetic is done on local wall-clock time, so it stays at 18:00
-- either side of the clocks changing.
create or replace function private.deadline_after(ts timestamptz)
returns timestamptz
language plpgsql stable
set search_path = ''
as $$
declare
  local_ts  timestamp := ts at time zone 'Europe/London';
  candidate timestamp;
begin
  candidate := date_trunc('day', local_ts)
             + make_interval(days => (5 - extract(isodow from local_ts)::int + 7) % 7)
             + interval '18 hours';
  if candidate <= local_ts then
    candidate := candidate + interval '7 days';
  end if;
  return candidate at time zone 'Europe/London';
end;
$$;

-- The deadline new motions go towards right now. Normally the coming
-- Friday, but if the host closed this week early for fines night, the
-- one after.
create or replace function private.open_deadline()
returns timestamptz
language plpgsql stable security definer
set search_path = ''
as $$
declare
  d timestamptz := private.deadline_after(now());
begin
  while exists (select 1 from public.weeks where deadline = d and status <> 'open') loop
    d := private.deadline_after(d);
  end loop;
  return d;
end;
$$;

-- Voting is open on this motion right now.
create or replace function private.voting_open_for(p_motion_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.app_state s
    join public.motions m on m.id = s.current_motion_id
    where s.id = 1
      and s.mode = 'party'
      and s.phase = 'voting'
      and m.id = p_motion_id
      and m.status = 'active'
  );
$$;

-- The calling member may vote on this motion right now.
create or replace function private.can_vote_on(p_motion_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select private.is_member()
     and private.voting_open_for(p_motion_id)
     and (
       (select accused_can_vote from public.app_state where id = 1)
       or not exists (
         select 1 from public.motions
         where id = p_motion_id and accused_id = (select auth.uid())
       )
     );
$$;

-- Individual votes become visible once voting on that motion has closed.
create or replace function private.votes_visible(p_motion_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select private.is_member()
     and exists (
       select 1 from public.motions
       where id = p_motion_id and status in ('passed', 'failed')
     );
$$;

-- Bring up a random pending motion from the party weeks, or clear the
-- screen if there are none left. Caller must hold the app_state lock.
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
  update public.app_state set current_motion_id = v_next, phase = 'discussion' where id = 1;
  return v_next;
end;
$$;

-- ---------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------

-- Keep weeks.motion_count right, so everyone can see how many motions
-- are in without being able to read them.
create or replace function private.tg_motion_count()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.weeks set motion_count = motion_count + 1 where id = new.week_id;
  elsif tg_op = 'DELETE' then
    update public.weeks set motion_count = greatest(motion_count - 1, 0) where id = old.week_id;
  end if;
  return null;
end;
$$;

create trigger motions_count
after insert or delete on public.motions
for each row execute function private.tg_motion_count();

-- Count votes as they come in (without saying which way) so the room can
-- see "5 of 8 voted".
create or replace function private.tg_vote_count()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  update public.motions set votes_cast = votes_cast + 1 where id = new.motion_id;
  return null;
end;
$$;

create trigger votes_count
after insert on public.votes
for each row execute function private.tg_vote_count();

create or replace function private.tg_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger app_state_touch
before update on public.app_state
for each row execute function private.tg_touch_updated_at();

-- ---------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------
alter table public.members           enable row level security;
alter table public.weeks             enable row level security;
alter table public.motions           enable row level security;
alter table public.votes             enable row level security;
alter table public.submission_counts enable row level security;
alter table public.app_state         enable row level security;

-- members: housemates can see each other. Accounts are created by the seed
-- script with the service role key, never from the app.
create policy "Members can see the house"
  on public.members for select to authenticated
  using (private.is_member());

-- weeks: everyone can see deadlines and counts.
create policy "Members can see weeks"
  on public.weeks for select to authenticated
  using (private.is_member());

-- motions: the host can see everything (to remove joke or abusive ones).
-- Everyone else only sees a motion once it's been brought up on fines
-- night, so contents stay secret until then. Unheard motions stay hidden.
create policy "Host sees all motions, members see ones brought up"
  on public.motions for select to authenticated
  using (private.is_host() or (status <> 'pending' and private.is_member()));

create policy "Only the host updates motion status"
  on public.motions for update to authenticated
  using (private.is_host())
  with check (private.is_host());

create policy "Host can delete motions that haven't been heard"
  on public.motions for delete to authenticated
  using (private.is_host() and status = 'pending');

-- (No insert policy: motions only arrive through submit_motion().)

-- votes: you can always see your own vote. Everyone else's appear once
-- the host closes voting on that motion.
create policy "Own vote, or everyone's once voting has closed"
  on public.votes for select to authenticated
  using (member_id = (select auth.uid()) or private.votes_visible(motion_id));

create policy "Vote while voting is open"
  on public.votes for insert to authenticated
  with check (member_id = (select auth.uid()) and private.can_vote_on(motion_id));

create policy "Change your vote while voting is open"
  on public.votes for update to authenticated
  using (member_id = (select auth.uid()) and private.can_vote_on(motion_id))
  with check (member_id = (select auth.uid()) and private.can_vote_on(motion_id));

-- (No delete policy: once voting closes, votes are fixed.)

-- submission_counts: you can only see your own.
create policy "See your own submission count"
  on public.submission_counts for select to authenticated
  using (member_id = (select auth.uid()));

-- app_state: everyone reads it, only the host changes it.
create policy "Members read app state"
  on public.app_state for select to authenticated
  using (private.is_member());

create policy "Only the host updates app state"
  on public.app_state for update to authenticated
  using (private.is_host())
  with check (private.is_host());

-- ---------------------------------------------------------------------
-- Table privileges
-- Supabase grants everything to anon/authenticated by default and relies
-- on RLS. Tighten that so the logged-out role gets nothing, and so
-- column-level limits actually apply.
-- ---------------------------------------------------------------------
revoke all on public.members, public.weeks, public.motions, public.votes,
              public.submission_counts, public.app_state
  from anon, authenticated;

grant select on public.members, public.weeks, public.submission_counts,
                public.app_state, public.motions, public.votes
  to authenticated;

grant delete on public.motions to authenticated;
grant update (status) on public.motions to authenticated;
grant insert (motion_id, member_id, vote) on public.votes to authenticated;
grant update (vote) on public.votes to authenticated;
-- Mode, phase and current motion only change through the host functions.
grant update (accused_can_vote, submission_limit) on public.app_state to authenticated;

grant all on public.members, public.weeks, public.motions, public.votes,
             public.submission_counts, public.app_state
  to service_role;

grant usage on schema private to authenticated, service_role;

-- ---------------------------------------------------------------------
-- API functions (called with supabase.rpc)
-- ---------------------------------------------------------------------

-- Countdown and counts for the submit screen.
create or replace function public.submit_status()
returns jsonb
language sql stable security invoker
set search_path = ''
as $$
  with d as (select private.open_deadline() as deadline)
  select jsonb_build_object(
    'deadline', d.deadline,
    'motion_count', coalesce(
      (select w.motion_count from public.weeks w where w.deadline = d.deadline), 0),
    'waiting_count', coalesce(
      (select sum(w.motion_count) from public.weeks w
        where w.status = 'open' and w.deadline < d.deadline), 0),
    'my_count', coalesce(
      (select sc.submitted
         from public.submission_counts sc
         join public.weeks w on w.id = sc.week_id
        where w.deadline = d.deadline and sc.member_id = (select auth.uid())), 0),
    'limit', (select s.submission_limit from public.app_state s where s.id = 1)
  )
  from d;
$$;

-- File a motion anonymously. Picks the week from the server clock:
-- anything after Friday 18:00 goes into the following week.
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

  select * into v_state from public.app_state where id = 1;
  if v_state.mode = 'party' then
    raise exception 'Fines night is on. Submissions reopen once it''s over.';
  end if;

  if p_accused_id is null or not exists (select 1 from public.members where id = p_accused_id) then
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

-- Vote Fine / No fine, or change your vote while voting is open.
-- Runs as the caller, so the votes RLS policies do the enforcing.
create or replace function public.cast_vote(p_motion_id uuid, p_vote public.vote_choice)
returns void
language plpgsql volatile security invoker
set search_path = ''
as $$
begin
  if not private.can_vote_on(p_motion_id) then
    raise exception 'Voting isn''t open for you on this motion.';
  end if;

  insert into public.votes (motion_id, member_id, vote)
  values (p_motion_id, (select auth.uid()), p_vote)
  on conflict (motion_id, member_id) do update set vote = excluded.vote;
end;
$$;

-- Host: switch the whole site into party mode.
-- p_include_current closes this week's submissions early and includes
-- them; otherwise only weeks whose deadline has passed are played.
create or replace function public.start_party(p_include_current boolean default false)
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

  -- Make sure the current week exists so closing early marks it as used.
  if p_include_current then
    insert into public.weeks (deadline) values (v_cutoff) on conflict (deadline) do nothing;
  end if;

  update public.weeks set status = 'party'
  where status = 'open' and deadline <= v_cutoff;

  update public.app_state
  set mode = 'party', phase = null, current_motion_id = null, party_started_at = now()
  where id = 1;
end;
$$;

-- Host: bring up the next motion (random order).
create or replace function public.next_motion()
returns uuid
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_state  public.app_state;
  v_status public.motion_status;
begin
  perform private.assert_host();
  select * into v_state from public.app_state where id = 1 for update;
  if v_state.mode <> 'party' then
    raise exception 'Start fines night first.';
  end if;

  if v_state.current_motion_id is not null then
    select status into v_status from public.motions where id = v_state.current_motion_id;
    if v_status = 'active' then
      raise exception 'Close voting on (or skip) the current motion first.';
    end if;
  end if;

  return private.advance_to_next_motion();
end;
$$;

-- Host: end discussion and open voting.
create or replace function public.open_voting()
returns void
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_state public.app_state;
begin
  perform private.assert_host();
  select * into v_state from public.app_state where id = 1 for update;
  if v_state.mode <> 'party' or v_state.current_motion_id is null or v_state.phase <> 'discussion' then
    raise exception 'There''s no motion being discussed.';
  end if;

  update public.app_state set phase = 'voting' where id = 1;
end;
$$;

-- Host: close voting and reveal. A motion passes on a strict majority of
-- votes cast; a tie (or no votes) fails.
create or replace function public.close_voting()
returns public.motion_status
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_state  public.app_state;
  v_fine   integer;
  v_nofine integer;
  v_result public.motion_status;
begin
  perform private.assert_host();
  select * into v_state from public.app_state where id = 1 for update;
  if v_state.mode <> 'party' or v_state.current_motion_id is null or v_state.phase <> 'voting' then
    raise exception 'Voting isn''t open.';
  end if;

  select count(*) filter (where vote = 'fine'),
         count(*) filter (where vote = 'no_fine')
    into v_fine, v_nofine
  from public.votes
  where motion_id = v_state.current_motion_id;

  v_result := case when v_fine > v_nofine then 'passed' else 'failed' end;

  update public.motions
  set status = v_result,
      fine_votes = v_fine,
      no_fine_votes = v_nofine,
      votes_cast = v_fine + v_nofine,
      resolved_at = now()
  where id = v_state.current_motion_id;

  update public.app_state set phase = 'revealed' where id = 1;
  return v_result;
end;
$$;

-- Host: skip the current motion (any votes on it are thrown away) and move
-- straight on to the next one.
create or replace function public.skip_motion()
returns uuid
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_state public.app_state;
begin
  perform private.assert_host();
  select * into v_state from public.app_state where id = 1 for update;
  if v_state.mode <> 'party' or v_state.current_motion_id is null
     or v_state.phase not in ('discussion', 'voting') then
    raise exception 'There''s nothing to skip.';
  end if;

  delete from public.votes where motion_id = v_state.current_motion_id;
  update public.motions
  set status = 'skipped', votes_cast = 0, resolved_at = now()
  where id = v_state.current_motion_id;

  return private.advance_to_next_motion();
end;
$$;

-- Host: end fines night. Archives the weeks that were played and puts
-- the whole site back into submit mode. Motions never brought up stay
-- hidden in the archive.
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

  if v_state.current_motion_id is not null then
    delete from public.votes
    where motion_id = v_state.current_motion_id
      and exists (select 1 from public.motions where id = v_state.current_motion_id and status = 'active');
    update public.motions
    set status = 'skipped', votes_cast = 0, resolved_at = now()
    where id = v_state.current_motion_id and status = 'active';
  end if;

  update public.weeks set status = 'archived', archived_at = now() where status = 'party';

  update public.app_state
  set mode = 'submit', phase = null, current_motion_id = null, party_started_at = null
  where id = 1;
end;
$$;

-- ---------------------------------------------------------------------
-- Function privileges
-- Postgres lets everyone execute functions by default; lock that down.
-- ---------------------------------------------------------------------
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function
  private.is_member(),
  private.is_host(),
  private.can_vote_on(uuid),
  private.votes_visible(uuid),
  private.open_deadline(),
  private.deadline_after(timestamptz)
  to authenticated;

revoke execute on function
  public.submit_status(),
  public.submit_motion(uuid, text, text),
  public.cast_vote(uuid, public.vote_choice),
  public.start_party(boolean),
  public.next_motion(),
  public.open_voting(),
  public.close_voting(),
  public.skip_motion(),
  public.end_party()
  from public, anon;

grant execute on function
  public.submit_status(),
  public.submit_motion(uuid, text, text),
  public.cast_vote(uuid, public.vote_choice),
  public.start_party(boolean),
  public.next_motion(),
  public.open_voting(),
  public.close_voting(),
  public.skip_motion(),
  public.end_party()
  to authenticated;

-- ---------------------------------------------------------------------
-- Realtime: phones listen for changes to these tables. Realtime applies
-- the RLS policies above, so nobody gets rows they couldn't select.
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.app_state, public.weeks, public.motions;
  end if;
end;
$$;
