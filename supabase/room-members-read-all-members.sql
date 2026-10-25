-- Allow every active member to see the roster and progress for their own room.
-- It does not expose members of rooms they have not joined.
do $$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'room_members'
      and policyname = 'room_members_read_self_or_host'
  ) then
    alter policy "room_members_read_self_or_host"
      on public.room_members
      using ((select private.can_read_room(room_id)));
  else
    create policy "room_members_read_self_or_host"
      on public.room_members
      for select
      to authenticated
      using ((select private.can_read_room(room_id)));
  end if;
end;
$$;
