-- Track whether each active non-host member is still on the game screen.
-- The room's start marker is cleared when all players return to the lobby.

alter table public.room_members
  add column if not exists is_playing boolean not null default false;

create or replace function private.reset_room_start_when_no_players()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.left_at is distinct from old.left_at
     or new.kicked_at is distinct from old.kicked_at
     or new.is_playing is distinct from old.is_playing then
    update public.rooms as room
    set started_at = null
    where room.id = new.room_id
      and room.started_at is not null
      and not exists (
        select 1
        from public.room_members as member
        where member.room_id = room.id
          and member.user_id <> room.host_user_id
          and member.left_at is null
          and member.kicked_at is null
          and member.is_playing
      );
  end if;
  return new;
end;
$$;

revoke execute on function private.reset_room_start_when_no_players() from public, anon, authenticated;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'room_members_reset_start_when_no_players'
      and tgrelid = 'public.room_members'::regclass
      and not tgisinternal
  ) then
    create trigger room_members_reset_start_when_no_players
      after update of left_at, kicked_at on public.room_members
      for each row
      execute function private.reset_room_start_when_no_players();
  end if;
  if not exists (
    select 1 from pg_trigger
    where tgname = 'room_members_reset_start_when_no_one_playing'
      and tgrelid = 'public.room_members'::regclass
      and not tgisinternal
  ) then
    create trigger room_members_reset_start_when_no_one_playing
      after update of is_playing on public.room_members
      for each row
      execute function private.reset_room_start_when_no_players();
  end if;
end;
$$;

create or replace function public.set_room_playing(
  p_room_code text,
  p_is_playing boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_room_id uuid;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'AUTH_REQUIRED';
  end if;
  if p_is_playing is null then
    raise exception using errcode = '22023', message = 'PLAYING_STATE_REQUIRED';
  end if;

  select room.id into v_room_id
  from public.rooms as room
  where room.room_code = p_room_code;
  if v_room_id is null then
    raise exception using errcode = 'P0002', message = 'ROOM_NOT_FOUND';
  end if;

  update public.room_members as member
  set is_playing = p_is_playing
  where member.room_id = v_room_id
    and member.user_id = v_user_id
    and member.left_at is null
    and member.kicked_at is null;
  if not found then
    raise exception using errcode = '42501', message = 'ACTIVE_MEMBERSHIP_REQUIRED';
  end if;

  return jsonb_build_object('room_code', p_room_code, 'is_playing', p_is_playing);
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
  if not exists (
    select 1 from public.room_members as member
    where member.room_id = v_room.id
      and member.user_id <> v_room.host_user_id
      and member.left_at is null
      and member.kicked_at is null
  ) then
    raise exception using errcode = '22023', message = 'NO_ACTIVE_PLAYERS';
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

revoke execute on function public.set_room_playing(text, boolean) from public, anon;
grant execute on function public.set_room_playing(text, boolean) to authenticated;
revoke execute on function public.start_room(text) from public, anon;
grant execute on function public.start_room(text) to authenticated;
