-- Additive migration for host-triggered room stage starts.
-- This does not delete rooms or room members.

alter table public.rooms
  add column if not exists started_at timestamptz;

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

revoke execute on function public.start_room(text) from public, anon;
grant execute on function public.start_room(text) to authenticated;
