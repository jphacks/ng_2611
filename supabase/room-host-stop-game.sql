-- Allow the current room host to end an active game without deleting the room.
create or replace function public.stop_room_game(p_room_code text)
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
  if v_room.host_user_id <> v_user_id then
    raise exception using errcode = '42501', message = 'HOST_REQUIRED';
  end if;

  update public.room_members as member
  set is_playing = false,
      current_stage_id = null
  where member.room_id = v_room.id
    and member.left_at is null
    and member.kicked_at is null;

  update public.rooms as room
  set started_at = null
  where room.id = v_room.id;

  return jsonb_build_object('room_code', p_room_code, 'stopped', true);
end;
$$;

revoke execute on function public.stop_room_game(text) from public, anon;
grant execute on function public.stop_room_game(text) to authenticated;
