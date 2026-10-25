-- Track the most recent successful client heartbeat for active room members.
alter table public.room_members
  add column if not exists last_seen_at timestamptz not null default now();

update public.room_members
set last_seen_at = now()
where last_seen_at is null;

create or replace function public.heartbeat_room(p_room_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_seen_at timestamptz := clock_timestamp();
  v_room_id uuid;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'AUTH_REQUIRED';
  end if;

  select room.id into v_room_id
  from public.rooms as room
  where room.room_code = p_room_code;
  if v_room_id is null then
    raise exception using errcode = 'P0002', message = 'ROOM_NOT_FOUND';
  end if;

  update public.room_members as member
  set last_seen_at = v_seen_at
  where member.room_id = v_room_id
    and member.user_id = v_user_id
    and member.left_at is null
    and member.kicked_at is null;
  if not found then
    raise exception using errcode = '42501', message = 'ACTIVE_MEMBERSHIP_REQUIRED';
  end if;

  return jsonb_build_object('room_code', p_room_code, 'last_seen_at', v_seen_at);
end;
$$;

revoke execute on function public.heartbeat_room(text) from public, anon;
grant execute on function public.heartbeat_room(text) to authenticated;
