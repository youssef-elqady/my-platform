-- ============================================================
-- ADMIN PLATFORM HARDENING
-- Content targeting / homework solutions / question choices /
-- assistant RBAC / audit trail / QR attendance / score notices
-- ============================================================

-- ------------------------------------------------------------
-- Homework and exam metadata
-- ------------------------------------------------------------
alter table public.assignments add column if not exists content_type text not null default 'text';
alter table public.assignments add column if not exists solution_video_provider text;
alter table public.assignments add column if not exists solution_video_asset_id text;
alter table public.assignments add column if not exists solution_release_mode text not null default 'after_deadline';
alter table public.assignments add column if not exists solution_requires_submission boolean not null default false;
alter table public.assignments add column if not exists solution_release_at timestamptz;
alter table public.assignments add constraint assignments_content_type_valid check (content_type in ('text','pdf','mixed'));
alter table public.assignments add constraint assignments_solution_release_valid check (solution_release_mode in ('immediate','after_deadline','scheduled'));

alter table public.exams add column if not exists instructions text;
alter table public.exams add column if not exists result_mode text not null default 'after_submit';
alter table public.exams add column if not exists pass_percentage numeric(5,2) not null default 50;
alter table public.exams add column if not exists auto_submit_on_tab_switch boolean not null default false;

-- Normalize legacy/unknown values before enforcing the new domain.
update public.exams
set result_mode = 'after_submit'
where result_mode is null
   or result_mode not in ('after_submit','after_window','manual');

alter table public.exams add constraint exams_result_mode_valid check (result_mode in ('after_submit','after_window','manual'));
alter table public.exams add constraint exams_pass_percentage_valid check (pass_percentage between 0 and 100);

-- ------------------------------------------------------------
-- Content targeting: lesson -> grade/group(s)
-- ------------------------------------------------------------
alter table public.content_targets enable row level security;
drop policy if exists content_targets_admin_all on public.content_targets;
create policy content_targets_admin_all on public.content_targets
for all to authenticated
using ((select public.is_active_admin()))
with check ((select public.is_active_admin()));

create index if not exists content_targets_lesson_scope_idx
on public.content_targets(lesson_id, grade_id, group_id);

-- Students may only see a lesson if it is explicitly targeted to their grade/group,
-- or if no target exists (backward-compatible public-to-grade content).
drop policy if exists lessons_student_read on public.lessons;
create policy lessons_student_read on public.lessons
for select to authenticated
using (
  status = 'published'
  and exists (
    select 1
    from public.group_members gm
    join public.groups g on g.id = gm.group_id
    join public.chapters ch on ch.id = lessons.chapter_id
    join public.courses c on c.id = ch.course_id
    where gm.student_id = auth.uid()
      and gm.ends_at is null
      and g.is_active = true
      and c.is_active = true
      and ch.is_active = true
      and g.grade_id = c.grade_id
      and (
        not exists (select 1 from public.content_targets ct where ct.lesson_id = lessons.id)
        or exists (
          select 1 from public.content_targets ct
          where ct.lesson_id = lessons.id
            and (ct.group_id = g.id or ct.grade_id = g.grade_id)
        )
      )
  )
);

-- ------------------------------------------------------------
-- Assistant RBAC
-- Existing profile role remains admin/student for compatibility; a row in
-- staff_members marks an admin profile as a restricted assistant.
-- ------------------------------------------------------------
create or replace function public.is_active_admin()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
      and p.is_active = true
      and not exists (
        select 1 from public.staff_members s
        where s.user_id = p.id and s.is_active = true
      )
  );
$$;

create or replace function public.has_staff_permission(p_permission text)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.staff_members s
    join public.profiles p on p.id = s.user_id
    where s.user_id = (select auth.uid())
      and s.is_active = true
      and p.is_active = true
      and (
        p_permission = any (select jsonb_array_elements_text(coalesce(s.permissions -> 'permissions', '[]'::jsonb)))
        or coalesce((s.permissions ->> p_permission)::boolean, false)
      )
  );
$$;

revoke all on function public.has_staff_permission(text) from public;
grant execute on function public.has_staff_permission(text) to authenticated;

-- Common assistant read/write policies. Admin policies remain authoritative for the owner.
create policy staff_lessons_manage on public.lessons
for all to authenticated
using ((select public.has_staff_permission('lessons.manage')))
with check ((select public.has_staff_permission('lessons.manage')));

create policy staff_assignments_manage on public.assignments
for all to authenticated
using ((select public.has_staff_permission('assignments.manage')))
with check ((select public.has_staff_permission('assignments.manage')));

create policy staff_exams_manage on public.exams
for all to authenticated
using ((select public.has_staff_permission('exams.manage')))
with check ((select public.has_staff_permission('exams.manage')));

create policy staff_questions_manage on public.exam_questions
for all to authenticated
using ((select public.has_staff_permission('exams.questions')))
with check ((select public.has_staff_permission('exams.questions')));

create policy staff_attendance_manage on public.attendance
for all to authenticated
using ((select public.has_staff_permission('attendance.manage')))
with check ((select public.has_staff_permission('attendance.manage')));

create policy staff_sessions_manage on public.sessions
for all to authenticated
using ((select public.has_staff_permission('attendance.manage')))
with check ((select public.has_staff_permission('attendance.manage')));

create policy staff_notifications_manage on public.notifications
for all to authenticated
using ((select public.has_staff_permission('notifications.manage')))
with check ((select public.has_staff_permission('notifications.manage')));

-- ------------------------------------------------------------
-- Audit trail
-- ------------------------------------------------------------
alter table public.audit_logs enable row level security;
drop policy if exists audit_logs_admin_read on public.audit_logs;
create policy audit_logs_admin_read on public.audit_logs
for select to authenticated
using ((select public.is_active_admin()));

drop policy if exists audit_logs_staff_read on public.audit_logs;
create policy audit_logs_staff_read on public.audit_logs
for select to authenticated
using ((select public.has_staff_permission('audit.read')));

create or replace function public.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entity_id uuid;
  v_old jsonb := case when tg_op = 'INSERT' then '{}'::jsonb else to_jsonb(old) end;
  v_new jsonb := case when tg_op = 'DELETE' then '{}'::jsonb else to_jsonb(new) end;
begin
  v_entity_id := coalesce((v_new ->> 'id')::uuid, (v_old ->> 'id')::uuid);
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values (
    (select auth.uid()),
    lower(tg_op),
    tg_table_name,
    v_entity_id,
    jsonb_build_object('old', v_old, 'new', v_new)
  );
  return coalesce(new, old);
end;
$$;

-- Do not duplicate triggers if the migration is replayed.
drop trigger if exists audit_assignments on public.assignments;
create trigger audit_assignments after insert or update or delete on public.assignments for each row execute function public.write_audit_log();
drop trigger if exists audit_exams on public.exams;
create trigger audit_exams after insert or update or delete on public.exams for each row execute function public.write_audit_log();
drop trigger if exists audit_exam_questions on public.exam_questions;
create trigger audit_exam_questions after insert or update or delete on public.exam_questions for each row execute function public.write_audit_log();
drop trigger if exists audit_attendance on public.attendance;
create trigger audit_attendance after insert or update or delete on public.attendance for each row execute function public.write_audit_log();
drop trigger if exists audit_group_members on public.group_members;
create trigger audit_group_members after insert or update or delete on public.group_members for each row execute function public.write_audit_log();

create index if not exists audit_logs_entity_time_idx on public.audit_logs(entity_type, entity_id, created_at desc);

-- ------------------------------------------------------------
-- QR attendance: teacher scans student's stable student_code.
-- The server validates the session, group membership and active student.
-- ------------------------------------------------------------
create or replace function public.mark_attendance_by_student_code(
  p_session_id uuid,
  p_student_code text,
  p_status public.attendance_status default 'present'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
volatile
as $$
declare
  v_student_id uuid;
  v_group_id uuid;
  v_result jsonb;
begin
  if not (select public.is_active_admin()) and not (select public.has_staff_permission('attendance.manage')) then
    raise exception 'Attendance permission required';
  end if;

  select sp.user_id into v_student_id
  from public.student_profiles sp
  join public.profiles p on p.id = sp.user_id
  where lower(trim(sp.student_code)) = lower(trim(p_student_code))
    and p.is_active = true
    and sp.status in ('approved','active');

  if v_student_id is null then raise exception 'Student code not found'; end if;

  select s.group_id into v_group_id
  from public.sessions s
  where s.id = p_session_id;

  if v_group_id is null then raise exception 'Session not found'; end if;

  if not exists (
    select 1 from public.group_members gm
    where gm.student_id = v_student_id and gm.group_id = v_group_id and gm.ends_at is null
  ) then
    raise exception 'Student is not an active member of this session group';
  end if;

  insert into public.attendance(session_id, student_id, status, manually_modified, modified_by, modified_at)
  values (p_session_id, v_student_id, p_status, false, (select auth.uid()), timezone('utc', now()))
  on conflict (session_id, student_id) do update
  set status = excluded.status,
      manually_modified = false,
      modified_by = (select auth.uid()),
      modified_at = timezone('utc', now()),
      marked_at = timezone('utc', now());

  select jsonb_build_object('student_id', p.id, 'full_name', p.full_name, 'student_code', sp.student_code, 'status', p_status::text)
  into v_result
  from public.profiles p
  join public.student_profiles sp on sp.user_id = p.id
  where p.id = v_student_id;

  return v_result;
end;
$$;

revoke all on function public.mark_attendance_by_student_code(uuid,text,public.attendance_status) from public;
grant execute on function public.mark_attendance_by_student_code(uuid,text,public.attendance_status) to authenticated;

-- ------------------------------------------------------------
-- Exam score notification wizard
-- ------------------------------------------------------------
create or replace function public.send_exam_score_notifications(
  p_exam_id uuid,
  p_target_type text,
  p_target_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = ''
volatile
as $$
declare
  v_count integer := 0;
  r record;
  v_message text;
begin
  if not (select public.is_active_admin()) and not (select public.has_staff_permission('notifications.manage')) then
    raise exception 'Notification permission required';
  end if;

  if p_target_type not in ('all','grade','group','student') then
    raise exception 'Invalid target type';
  end if;

  for r in
    select distinct p.id as student_id, p.full_name, e.title as exam_title, e.max_score, ea.score
    from public.exam_attempts ea
    join public.exams e on e.id = ea.exam_id
    join public.profiles p on p.id = ea.student_id
    left join public.students st on st.user_id = p.id
    left join public.group_members gm on gm.student_id = p.id and gm.ends_at is null
    where ea.exam_id = p_exam_id
      and ea.status = 'submitted'
      and ea.score is not null
      and (
        p_target_type = 'all'
        or (p_target_type = 'student' and p.id = p_target_id)
        or (p_target_type = 'group' and gm.group_id = p_target_id)
        or (p_target_type = 'grade' and exists (
          select 1 from public.groups g where g.id = gm.group_id and g.grade_id = p_target_id
        ))
      )
    order by p.id
  loop
    v_message := format('عزيزي الطالب %s، درجتك في اختبار %s هي %s من %s.', r.full_name, r.exam_title, r.score, r.max_score);
    insert into public.notifications(recipient_id, title, message, body, type, is_read, created_by, created_at)
    values (r.student_id, 'نتيجة الامتحان', v_message, v_message, 'exam_result', false, (select auth.uid()), timezone('utc', now()));
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.send_exam_score_notifications(uuid,text,uuid) from public;
grant execute on function public.send_exam_score_notifications(uuid,text,uuid) to authenticated;

-- Students can read their own in-platform notifications.
drop policy if exists notifications_student_read on public.notifications;
create policy notifications_student_read on public.notifications
for select to authenticated
using (recipient_id = (select auth.uid()));

-- Staff can read notifications addressed to them.
drop policy if exists notifications_staff_read on public.notifications;
create policy notifications_staff_read on public.notifications
for select to authenticated
using (recipient_id = (select auth.uid()) and (select public.has_staff_permission('notifications.read')));
