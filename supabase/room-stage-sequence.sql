-- Store the host's ordered stage selection for each room.
alter table public.rooms
  add column if not exists stage_ids text[] not null default '{}';

update public.rooms
set stage_ids = array[stage_id]
where cardinality(stage_ids) = 0
  and stage_id is not null
  and btrim(stage_id) <> '';

create or replace function public.set_room_stages(
  p_room_code text,
  p_stage_ids text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_room public.rooms%rowtype;
  v_stage_ids text[];
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'AUTH_REQUIRED';
  end if;

  select coalesce(array_agg(btrim(selected.stage_id) order by selected.ordinality), array[]::text[])
  into v_stage_ids
  from unnest(coalesce(p_stage_ids, array[]::text[])) with ordinality as selected(stage_id, ordinality);

  if cardinality(v_stage_ids) = 0
     or exists (select 1 from unnest(v_stage_ids) as selected(stage_id) where selected.stage_id = '')
     or cardinality(v_stage_ids) <> (select count(distinct selected.stage_id) from unnest(v_stage_ids) as selected(stage_id)) then
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
  if v_room.started_at is not null then
    raise exception using errcode = '22023', message = 'ROOM_ALREADY_STARTED';
  end if;

  update public.rooms as room
  set stage_ids = v_stage_ids,
      stage_id = v_stage_ids[1]
  where room.id = v_room.id;

  update public.room_members as member
  set current_stage_id = null,
      completed_stage_ids = '{}',
      is_playing = false
  where member.room_id = v_room.id
    and member.left_at is null
    and member.kicked_at is null;

  return jsonb_build_object(
    'room_code', p_room_code,
    'stage_id', v_stage_ids[1],
    'stage_ids', to_jsonb(v_stage_ids)
  );
end;
$$;

revoke execute on function public.set_room_stages(text, text[]) from public, anon;
grant execute on function public.set_room_stages(text, text[]) to authenticated;
