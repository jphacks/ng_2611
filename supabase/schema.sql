create table if not exists public.saves (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.saves enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'saves' and policyname = 'saves_select_own'
  ) then
    create policy "saves_select_own"
      on public.saves for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'saves' and policyname = 'saves_insert_own'
  ) then
    create policy "saves_insert_own"
      on public.saves for insert
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'saves' and policyname = 'saves_update_own'
  ) then
    create policy "saves_update_own"
      on public.saves for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end;
$$;

-- Classroom rooms. Direct client writes are disabled; mutations go through
-- authenticated RPC functions below so ownership and host permissions are
-- checked in the database.
create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  room_code text not null unique
    check (room_code ~ '^[0-9]{4}$'),
  created_by uuid not null references auth.users(id) on delete cascade,
  host_user_id uuid not null references auth.users(id) on delete cascade,
  stage_id text,
  started_at timestamptz,
  created_at timestamptz not null default now(),
  check (host_user_id is not null)
);

-- Additive migration for projects where the rooms table already exists.
alter table public.rooms add column if not exists started_at timestamptz;

create table if not exists public.room_members (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null
    check (char_length(btrim(display_name)) between 1 and 40),
  current_stage_id text,
  completed_stage_ids text[] not null default '{}',
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  kicked_at timestamptz,
  primary key (room_id, user_id)
);

create unique index if not exists room_members_active_display_name_key
  on public.room_members (room_id, lower(btrim(display_name)))
  where left_at is null and kicked_at is null;

create unique index if not exists room_members_one_active_room_per_user
  on public.room_members (user_id)
  where left_at is null and kicked_at is null;

create index if not exists room_members_room_id_idx
  on public.room_members (room_id);

alter table public.rooms enable row level security;
alter table public.room_members enable row level security;

revoke all on table public.rooms from anon, authenticated;
revoke all on table public.room_members from anon, authenticated;
grant select on table public.rooms to authenticated;
grant select on table public.room_members to authenticated;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create or replace function private.can_read_room(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.room_members as member
    where member.room_id = p_room_id
      and member.user_id = (select auth.uid())
      and member.left_at is null
      and member.kicked_at is null
  );
$$;

create or replace function private.is_room_host(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.rooms as room
    join public.room_members as member
      on member.room_id = room.id
     and member.user_id = room.host_user_id
     and member.left_at is null
     and member.kicked_at is null
    where room.id = p_room_id
      and room.host_user_id = (select auth.uid())
  );
$$;

revoke execute on function private.can_read_room(uuid) from public, anon;
revoke execute on function private.is_room_host(uuid) from public, anon;
grant execute on function private.can_read_room(uuid) to authenticated;
grant execute on function private.is_room_host(uuid) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'rooms' and policyname = 'rooms_read_active_member'
  ) then
    create policy "rooms_read_active_member"
      on public.rooms for select
      to authenticated
      using ((select private.can_read_room(id)));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'room_members' and policyname = 'room_members_read_self_or_host'
  ) then
    create policy "room_members_read_self_or_host"
      on public.room_members for select
      to authenticated
      using ((select private.can_read_room(room_id)));
  else
    alter policy "room_members_read_self_or_host"
      on public.room_members
      using ((select private.can_read_room(room_id)));
  end if;
end;
$$;

create or replace function public.create_room(
  p_room_code text,
  p_display_name text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_room_id uuid;
  v_name text := btrim(p_display_name);
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'AUTH_REQUIRED';
  end if;

  if p_room_code is null or p_room_code !~ '^[0-9]{4}$' then
    raise exception using errcode = '22023', message = 'ROOM_CODE_MUST_BE_4_DIGITS';
  end if;

  if v_name is null or char_length(v_name) not between 1 and 40 then
    raise exception using errcode = '22023', message = 'DISPLAY_NAME_INVALID';
  end if;

  if exists (
    select 1 from public.room_members as member
    where member.user_id = v_user_id
      and member.left_at is null
      and member.kicked_at is null
  ) then
    raise exception using errcode = '23505', message = 'ALREADY_IN_ANOTHER_ROOM';
  end if;

  begin
    insert into public.rooms (room_code, created_by, host_user_id)
    values (p_room_code, v_user_id, v_user_id)
    returning id into v_room_id;
  exception when unique_violation then
    raise exception using errcode = '23505', message = 'ROOM_CODE_IN_USE';
  end;

  insert into public.room_members (room_id, user_id, display_name)
  values (v_room_id, v_user_id, v_name);

  return jsonb_build_object(
    'room_id', v_room_id,
    'room_code', p_room_code,
    'created_by', v_user_id,
    'host_user_id', v_user_id,
    'stage_id', null,
    'display_name', v_name
  );
end;
$$;

create or replace function public.join_room(
  p_room_code text,
  p_display_name text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_room public.rooms%rowtype;
  v_member public.room_members%rowtype;
  v_member_exists boolean := false;
  v_name text := btrim(p_display_name);
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'AUTH_REQUIRED';
  end if;

  if p_room_code is null or p_room_code !~ '^[0-9]{4}$' then
    raise exception using errcode = '22023', message = 'ROOM_CODE_MUST_BE_4_DIGITS';
  end if;

  if v_name is null or char_length(v_name) not between 1 and 40 then
    raise exception using errcode = '22023', message = 'DISPLAY_NAME_INVALID';
  end if;

  select * into v_room
  from public.rooms as room
  where room.room_code = p_room_code
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'ROOM_NOT_FOUND';
  end if;

  select * into v_member
  from public.room_members as member
  where member.room_id = v_room.id and member.user_id = v_user_id
  for update;
  v_member_exists := found;

  if v_member_exists and v_member.kicked_at is not null then
    raise exception using errcode = '42501', message = 'MEMBER_KICKED';
  end if;

  if v_member_exists and v_member.left_at is null then
    raise exception using errcode = '23505', message = 'ALREADY_IN_ROOM';
  end if;

  if exists (
    select 1 from public.room_members as member
    where member.user_id = v_user_id
      and member.left_at is null
      and member.kicked_at is null
  ) then
    raise exception using errcode = '23505', message = 'ALREADY_IN_ANOTHER_ROOM';
  end if;

  if exists (
    select 1 from public.room_members as member
    where member.room_id = v_room.id
      and lower(btrim(member.display_name)) = lower(v_name)
      and member.left_at is null
      and member.kicked_at is null
      and member.user_id <> v_user_id
  ) then
    raise exception using errcode = '23505', message = 'DISPLAY_NAME_IN_USE';
  end if;

  if v_member_exists then
    update public.room_members as member
    set display_name = v_name,
        current_stage_id = null,
        completed_stage_ids = '{}',
        joined_at = now(),
        left_at = null,
        kicked_at = null
    where member.room_id = v_room.id and member.user_id = v_user_id;
  else
    insert into public.room_members (room_id, user_id, display_name)
    values (v_room.id, v_user_id, v_name);
  end if;

  return jsonb_build_object(
    'room_id', v_room.id,
    'room_code', v_room.room_code,
    'created_by', v_room.created_by,
    'host_user_id', v_room.host_user_id,
    'stage_id', v_room.stage_id,
    'user_id', v_user_id,
    'display_name', v_name
  );
end;
$$;

create or replace function public.leave_room(p_room_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_room public.rooms%rowtype;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'AUTH_REQUIRED';
  end if;

  select * into v_room
  from public.rooms as room
  where room.room_code = p_room_code
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'ROOM_NOT_FOUND';
  end if;

  if v_room.created_by = v_user_id then
    delete from public.rooms as room where room.id = v_room.id;
    return jsonb_build_object('deleted', true, 'room_code', p_room_code);
  end if;

  update public.room_members as member
  set left_at = now()
  where member.room_id = v_room.id
    and member.user_id = v_user_id
    and member.left_at is null
    and member.kicked_at is null;

  if not found then
    raise exception using errcode = '42501', message = 'ACTIVE_MEMBERSHIP_REQUIRED';
  end if;

  if v_room.host_user_id = v_user_id then
    update public.rooms as room
    set host_user_id = v_room.created_by
    where room.id = v_room.id;
  end if;

  return jsonb_build_object('deleted', false, 'room_code', p_room_code);
end;
$$;

create or replace function public.set_room_host(
  p_room_code text,
  p_new_host_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_room public.rooms%rowtype;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'AUTH_REQUIRED';
  end if;

  select * into v_room from public.rooms as room
  where room.room_code = p_room_code for update;
  if not found then raise exception using errcode = 'P0002', message = 'ROOM_NOT_FOUND'; end if;
  if v_room.host_user_id <> v_user_id then
    raise exception using errcode = '42501', message = 'HOST_REQUIRED';
  end if;

  if not exists (
    select 1 from public.room_members as member
    where member.room_id = v_room.id
      and member.user_id = p_new_host_user_id
      and member.left_at is null
      and member.kicked_at is null
  ) then
    raise exception using errcode = '22023', message = 'NEW_HOST_MUST_BE_ACTIVE_MEMBER';
  end if;

  update public.rooms as room set host_user_id = p_new_host_user_id where room.id = v_room.id;
  return jsonb_build_object('room_code', p_room_code, 'host_user_id', p_new_host_user_id);
end;
$$;

create or replace function public.kick_room_member(
  p_room_code text,
  p_target_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_room public.rooms%rowtype;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'AUTH_REQUIRED';
  end if;

  select * into v_room from public.rooms as room
  where room.room_code = p_room_code for update;
  if not found then raise exception using errcode = 'P0002', message = 'ROOM_NOT_FOUND'; end if;
  if v_room.host_user_id <> v_user_id then
    raise exception using errcode = '42501', message = 'HOST_REQUIRED';
  end if;
  if p_target_user_id = v_room.created_by or p_target_user_id = v_user_id then
    raise exception using errcode = '42501', message = 'CANNOT_KICK_OWNER_OR_SELF';
  end if;

  update public.room_members as member
  set left_at = now(), kicked_at = now()
  where member.room_id = v_room.id
    and member.user_id = p_target_user_id
    and member.left_at is null
    and member.kicked_at is null;

  if not found then
    raise exception using errcode = 'P0002', message = 'ACTIVE_MEMBER_NOT_FOUND';
  end if;

  return jsonb_build_object('room_code', p_room_code, 'kicked_user_id', p_target_user_id);
end;
$$;

create or replace function public.unkick_room_member(
  p_room_code text,
  p_target_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_room public.rooms%rowtype;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'AUTH_REQUIRED';
  end if;

  select * into v_room from public.rooms as room
  where room.room_code = p_room_code for update;
  if not found then raise exception using errcode = 'P0002', message = 'ROOM_NOT_FOUND'; end if;
  if v_room.host_user_id <> v_user_id then
    raise exception using errcode = '42501', message = 'HOST_REQUIRED';
  end if;

  update public.room_members as member
  set kicked_at = null
  where member.room_id = v_room.id
    and member.user_id = p_target_user_id
    and member.kicked_at is not null;

  if not found then raise exception using errcode = 'P0002', message = 'KICKED_MEMBER_NOT_FOUND'; end if;
  return jsonb_build_object('room_code', p_room_code, 'unkicked_user_id', p_target_user_id);
end;
$$;

create or replace function public.set_room_stage(
  p_room_code text,
  p_stage_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_room public.rooms%rowtype;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'AUTH_REQUIRED';
  end if;
  if p_stage_id is null or btrim(p_stage_id) = '' then
    raise exception using errcode = '22023', message = 'STAGE_ID_REQUIRED';
  end if;

  select * into v_room from public.rooms as room
  where room.room_code = p_room_code for update;
  if not found then raise exception using errcode = 'P0002', message = 'ROOM_NOT_FOUND'; end if;
  if v_room.host_user_id <> v_user_id then
    raise exception using errcode = '42501', message = 'HOST_REQUIRED';
  end if;

  update public.rooms as room
  set stage_id = btrim(p_stage_id), started_at = null
  where room.id = v_room.id;
  return jsonb_build_object('room_code', p_room_code, 'stage_id', btrim(p_stage_id));
end;
$$;

create or replace function public.start_room(p_room_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_room public.rooms%rowtype;
  v_started_at timestamptz := now();
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'AUTH_REQUIRED';
  end if;

  select * into v_room
  from public.rooms as room
  where room.room_code = p_room_code
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'ROOM_NOT_FOUND';
  end if;
  if v_room.host_user_id <> v_user_id then
    raise exception using errcode = '42501', message = 'HOST_REQUIRED';
  end if;
  if v_room.stage_id is null or btrim(v_room.stage_id) = '' then
    raise exception using errcode = '22023', message = 'STAGE_ID_REQUIRED';
  end if;
  if v_room.started_at is not null then
    raise exception using errcode = '22023', message = 'ROOM_ALREADY_STARTED';
  end if;

  update public.rooms as room
  set started_at = v_started_at
  where room.id = v_room.id;

  return jsonb_build_object(
    'room_code', p_room_code,
    'stage_id', v_room.stage_id,
    'started_at', v_started_at
  );
end;
$$;

create or replace function public.update_room_progress(
  p_room_code text,
  p_current_stage_id text,
  p_completed_stage_ids text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_room_id uuid;
  v_completed text[];
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'AUTH_REQUIRED';
  end if;

  select room.id into v_room_id
  from public.rooms as room
  where room.room_code = p_room_code;
  if v_room_id is null then raise exception using errcode = 'P0002', message = 'ROOM_NOT_FOUND'; end if;

  select coalesce(array_agg(distinct completed.stage_id), array[]::text[]) into v_completed
  from unnest(coalesce(p_completed_stage_ids, '{}')) as completed(stage_id)
  where completed.stage_id is not null and btrim(completed.stage_id) <> '';

  update public.room_members as member
  set current_stage_id = nullif(btrim(p_current_stage_id), ''),
      completed_stage_ids = v_completed
  where member.room_id = v_room_id
    and member.user_id = v_user_id
    and member.left_at is null
    and member.kicked_at is null;

  if not found then raise exception using errcode = '42501', message = 'ACTIVE_MEMBERSHIP_REQUIRED'; end if;
  return jsonb_build_object('room_code', p_room_code, 'current_stage_id', nullif(btrim(p_current_stage_id), ''), 'completed_stage_ids', v_completed);
end;
$$;

create or replace function public.delete_room(p_room_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_room public.rooms%rowtype;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'AUTH_REQUIRED';
  end if;

  select * into v_room from public.rooms as room
  where room.room_code = p_room_code for update;
  if not found then raise exception using errcode = 'P0002', message = 'ROOM_NOT_FOUND'; end if;
  if v_room.created_by <> v_user_id then
    raise exception using errcode = '42501', message = 'ROOM_CREATOR_REQUIRED';
  end if;

  delete from public.rooms as room where room.id = v_room.id;
  return jsonb_build_object('deleted', true, 'room_code', p_room_code);
end;
$$;

revoke execute on function public.create_room(text, text) from public, anon;
revoke execute on function public.join_room(text, text) from public, anon;
revoke execute on function public.leave_room(text) from public, anon;
revoke execute on function public.set_room_host(text, uuid) from public, anon;
revoke execute on function public.kick_room_member(text, uuid) from public, anon;
revoke execute on function public.unkick_room_member(text, uuid) from public, anon;
revoke execute on function public.set_room_stage(text, text) from public, anon;
revoke execute on function public.start_room(text) from public, anon;
revoke execute on function public.update_room_progress(text, text, text[]) from public, anon;
revoke execute on function public.delete_room(text) from public, anon;

grant execute on function public.create_room(text, text) to authenticated;
grant execute on function public.join_room(text, text) to authenticated;
grant execute on function public.leave_room(text) to authenticated;
grant execute on function public.set_room_host(text, uuid) to authenticated;
grant execute on function public.kick_room_member(text, uuid) to authenticated;
grant execute on function public.unkick_room_member(text, uuid) to authenticated;
grant execute on function public.set_room_stage(text, text) to authenticated;
grant execute on function public.start_room(text) to authenticated;
grant execute on function public.update_room_progress(text, text, text[]) to authenticated;
grant execute on function public.delete_room(text) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'rooms'
    ) then
      alter publication supabase_realtime add table public.rooms;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'room_members'
    ) then
      alter publication supabase_realtime add table public.room_members;
    end if;
  end if;
end;
$$;
