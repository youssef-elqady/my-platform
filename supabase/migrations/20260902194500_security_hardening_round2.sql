-- ============================================================
-- Security hardening round 2
-- ============================================================

-- Analytics events: the original RPC already exists with a BIGINT
-- return type. PostgreSQL does not allow CREATE OR REPLACE to change
-- a function's return type, so this migration preserves that contract.
-- The browser never supplies user_id; the server derives it from auth.uid().
create or replace function public.track_analytics_event(
  p_event_type text,
  p_page_path text default null,
  p_content_id uuid default null,
  p_content_type text default null,
  p_session_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_event_id bigint;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  insert into public.analytics_events(
    user_id,event_type,page_path,content_id,content_type,session_id,metadata
  ) values (
    v_user_id,p_event_type,p_page_path,p_content_id,p_content_type,p_session_id,coalesce(p_metadata,'{}'::jsonb)
  )
  returning id into v_event_id;

  return v_event_id;
end;
$$;

revoke all on function public.track_analytics_event(text,text,uuid,text,uuid,jsonb) from public;
grant execute on function public.track_analytics_event(text,text,uuid,text,uuid,jsonb) to authenticated;

-- Storage is private and is restricted to PDF assets used by the platform.
update storage.buckets
set public = false,
    file_size_limit = 20971520,
    allowed_mime_types = array['application/pdf']::text[]
where id = 'platform-files';

-- Atomic replacement of a lesson's targeting rules.
create or replace function public.set_lesson_targets(
  p_lesson_id uuid,
  p_grade_id uuid default null,
  p_group_ids uuid[] default '{}'::uuid[]
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_course_grade uuid;
  v_group_id uuid;
  v_group_grade uuid;
begin
  if not public.is_active_admin() and not public.has_staff_permission('lessons.manage') then
    raise exception 'Not authorized';
  end if;

  select c.grade_id into v_course_grade
  from public.lessons l
  join public.chapters ch on ch.id = l.chapter_id
  join public.courses c on c.id = ch.course_id
  where l.id = p_lesson_id;

  if v_course_grade is null then
    raise exception 'Lesson not found';
  end if;

  if p_grade_id is not null and p_grade_id <> v_course_grade then
    raise exception 'Target grade does not match lesson course';
  end if;

  foreach v_group_id in array coalesce(p_group_ids,'{}'::uuid[]) loop
    select grade_id into v_group_grade from public.groups where id = v_group_id and is_active = true;
    if v_group_grade is null then raise exception 'Invalid target group'; end if;
    if v_group_grade <> coalesce(p_grade_id, v_course_grade) then raise exception 'Target group does not match target grade'; end if;
  end loop;

  delete from public.content_targets where lesson_id = p_lesson_id;
  if p_grade_id is not null then
    insert into public.content_targets(lesson_id,grade_id) values (p_lesson_id,p_grade_id);
  end if;
  foreach v_group_id in array coalesce(p_group_ids,'{}'::uuid[]) loop
    insert into public.content_targets(lesson_id,group_id) values (p_lesson_id,v_group_id);
  end loop;
end;
$$;

revoke all on function public.set_lesson_targets(uuid,uuid,uuid[]) from public;
grant execute on function public.set_lesson_targets(uuid,uuid,uuid[]) to authenticated;

-- Protect the existing direct-write surface: target rows are managed by the RPC.
drop policy if exists content_targets_admin_all on public.content_targets;
create policy content_targets_admin_all on public.content_targets
for all to authenticated
using ((select public.is_active_admin()) or (select public.has_staff_permission('lessons.manage')))
with check ((select public.is_active_admin()) or (select public.has_staff_permission('lessons.manage')));
