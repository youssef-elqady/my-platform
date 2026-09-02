-- Realtime for in-platform notifications. RLS still controls who can read rows.
do $$
begin
  begin
    alter publication supabase_realtime add table public.notifications;
  exception when duplicate_object then
    null;
  end;
end $$;
