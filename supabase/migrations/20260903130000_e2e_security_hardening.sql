-- ============================================================
-- 360° E2E SECURITY HARDENING
-- Student exam access, assignment visibility, RBAC aliases,
-- one-time notifications, and student-safe exam question delivery.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Keep assistant permission aliases compatible server-side.
-- ------------------------------------------------------------
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
        or (p_permission = 'lessons.manage' and coalesce((s.permissions ->> 'content.read')::boolean, false))
        or (p_permission = 'content.read' and coalesce((s.permissions ->> 'lessons.manage')::boolean, false))
        or (p_permission = 'assignments.manage' and coalesce((s.permissions ->> 'assignments.read')::boolean, false))
        or (p_permission = 'assignments.read' and coalesce((s.permissions ->> 'assignments.manage')::boolean, false))
        or (p_permission = 'notifications.manage' and coalesce((s.permissions ->> 'notifications.read')::boolean, false))
        or (p_permission = 'notifications.read' and coalesce((s.permissions ->> 'notifications.manage')::boolean, false))
      )
  );
$$;
revoke all on function public.has_staff_permission(text) from public;
grant execute on function public.has_staff_permission(text) to authenticated;

-- ------------------------------------------------------------
-- 2) Students only see assignments targeted to their active group/grade.
-- ------------------------------------------------------------
alter table public.assignments enable row level security;
drop policy if exists assignments_student_read on public.assignments;
create policy assignments_student_read on public.assignments
for select to authenticated
using (
  is_published = true
  and exists (
    select 1
    from public.group_members gm
    join public.groups g on g.id = gm.group_id
    where gm.student_id = auth.uid()
      and gm.ends_at is null
      and g.is_active = true
      and (
        assignments.group_id = g.id
        or (assignments.group_id is null and assignments.grade_id = g.grade_id)
      )
  )
);

-- ------------------------------------------------------------
-- 3) Exams are visible only when published and targeted to the
-- student's current group/grade. Admin/staff policies remain separate.
-- ------------------------------------------------------------
alter table public.exams enable row level security;
drop policy if exists exams_student_read on public.exams;
create policy exams_student_read on public.exams
for select to authenticated
using (
  is_published = true
  and exists (
    select 1
    from public.group_members gm
    join public.groups g on g.id = gm.group_id
    where gm.student_id = auth.uid()
      and gm.ends_at is null
      and g.is_active = true
      and (
        exams.group_id = g.id
        or (exams.group_id is null and exams.grade_id = g.grade_id)
      )
  )
);

-- Students must never read the raw question table or choices table.
-- Questions are delivered by a SECURITY DEFINER function that strips answers.
alter table public.exam_questions enable row level security;
alter table public.exam_choices enable row level security;
drop policy if exists exam_questions_student_read on public.exam_questions;
drop policy if exists exam_choices_student_read on public.exam_choices;

-- ------------------------------------------------------------
-- 4) Strengthen claim_exam_access: unpublished exams are blocked.
-- ------------------------------------------------------------
create or replace function public.claim_exam_access(p_exam_id uuid)
returns table(access_id uuid, access_token uuid, allowed boolean, reason text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_exam public.exams%rowtype;
  v_access public.student_exam_access%rowtype;
  v_group_id uuid;
begin
  if v_uid is null then raise exception 'unauthorized'; end if;

  if not exists (
    select 1 from public.student_profiles sp
    join public.profiles p on p.id = sp.user_id
    where sp.user_id = v_uid and sp.status = 'active' and p.is_active = true
  ) then
    return query select null::uuid, null::uuid, false, 'الحساب غير مفعل'::text; return;
  end if;

  select * into v_exam from public.exams where id = p_exam_id;
  if not found then
    return query select null::uuid, null::uuid, false, 'الامتحان غير موجود'::text; return;
  end if;
  if not v_exam.is_published then
    return query select null::uuid, null::uuid, false, 'الامتحان غير متاح للطلاب'::text; return;
  end if;
  if v_exam.starts_at is not null and timezone('utc', now()) < v_exam.starts_at then
    return query select null::uuid, null::uuid, false, 'الامتحان لم يبدأ بعد'::text; return;
  end if;
  if v_exam.ends_at is not null and timezone('utc', now()) > v_exam.ends_at then
    return query select null::uuid, null::uuid, false, 'انتهى وقت الامتحان'::text; return;
  end if;

  select gm.group_id into v_group_id
  from public.group_members gm
  where gm.student_id = v_uid and gm.ends_at is null
  order by gm.starts_at desc limit 1;

  if v_group_id is null then
    return query select null::uuid, null::uuid, false, 'لا توجد مجموعة نشطة للحساب'::text; return;
  end if;
  if v_exam.group_id is not null and v_exam.group_id is distinct from v_group_id then
    return query select null::uuid, null::uuid, false, 'هذا الامتحان غير مخصص لمجموعتك'::text; return;
  end if;
  if v_exam.grade_id is not null and not exists (
    select 1 from public.groups g where g.id = v_group_id and g.grade_id = v_exam.grade_id
  ) then
    return query select null::uuid, null::uuid, false, 'هذا الامتحان غير مخصص لصفك'::text; return;
  end if;

  select * into v_access from public.student_exam_access
  where student_id = v_uid and exam_id = p_exam_id;
  if found then
    return query select v_access.id, null::uuid, false, 'تم استخدام هذا الامتحان من قبل ولا يمكن الدخول إليه مرة أخرى'::text; return;
  end if;

  insert into public.student_exam_access(student_id, exam_id)
  values (v_uid, p_exam_id)
  returning * into v_access;

  return query select v_access.id, v_access.access_token, true, 'تم فتح الامتحان بنجاح'::text;
exception when unique_violation then
  return query select null::uuid, null::uuid, false, 'تم استخدام هذا الامتحان من قبل ولا يمكن الدخول إليه مرة أخرى'::text;
end;
$$;
revoke all on function public.claim_exam_access(uuid) from public;
grant execute on function public.claim_exam_access(uuid) to authenticated;

-- ------------------------------------------------------------
-- 5) Student-safe question delivery. Correct answers and scoring
-- columns never leave PostgreSQL before submission.
-- ------------------------------------------------------------
create or replace function public.get_student_exam_questions(p_exam_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_access public.student_exam_access%rowtype;
  v_exam public.exams%rowtype;
  v_result jsonb;
begin
  if v_uid is null then raise exception 'unauthorized'; end if;

  select * into v_access from public.student_exam_access
  where student_id = v_uid and exam_id = p_exam_id;
  if not found or v_access.status <> 'claimed' then
    raise exception 'Exam access is not active';
  end if;

  select * into v_exam from public.exams where id = p_exam_id and is_published = true;
  if not found then raise exception 'Exam is not available'; end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', q.id,
      'question_text', q.question_text,
      'question_type', q.question_type,
      'points', q.points,
      'display_order', q.display_order,
      'choices', coalesce((
        select jsonb_agg(
          jsonb_build_object('id', c.id, 'choice_text', c.choice_text, 'display_order', c.display_order)
          order by c.display_order
        ) from public.exam_choices c where c.question_id = q.id
      ), '[]'::jsonb)
    ) order by q.display_order
  ), '[]'::jsonb) into v_result
  from public.exam_questions q
  where q.exam_id = p_exam_id;

  return v_result;
end;
$$;
revoke all on function public.get_student_exam_questions(uuid) from public;
grant execute on function public.get_student_exam_questions(uuid) to authenticated;

-- ------------------------------------------------------------
-- 6) Atomic student submission + server-side grading.
-- Input format: [{question_id, selected_choice_id, answer_text}]
-- ------------------------------------------------------------
create or replace function public.submit_student_exam(
  p_exam_id uuid,
  p_answers jsonb
)
returns table(submitted boolean, score numeric, max_score numeric, reason text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_access public.student_exam_access%rowtype;
  v_attempt public.exam_attempts%rowtype;
  v_exam public.exams%rowtype;
  v_score numeric := 0;
  v_max numeric := 0;
  v_item jsonb;
  v_question public.exam_questions%rowtype;
  v_choice public.exam_choices%rowtype;
  v_answer text;
  v_correct boolean;
  v_points numeric;
  v_attempt_number integer;
begin
  if v_uid is null then raise exception 'unauthorized'; end if;
  if jsonb_typeof(coalesce(p_answers, '[]'::jsonb)) <> 'array' then raise exception 'Invalid answers'; end if;

  select * into v_exam from public.exams where id = p_exam_id and is_published = true;
  if not found then raise exception 'Exam is not available'; end if;

  select * into v_access from public.student_exam_access
  where student_id = v_uid and exam_id = p_exam_id
  for update;
  if not found or v_access.status <> 'claimed' then
    return query select false, null::numeric, v_exam.max_score, 'الامتحان غير مفتوح أو تم تسليمه بالفعل'::text; return;
  end if;
  if v_exam.ends_at is not null and timezone('utc', now()) > v_exam.ends_at then
    update public.student_exam_access set status = 'expired' where id = v_access.id;
    return query select false, null::numeric, v_exam.max_score, 'انتهى وقت الامتحان'::text; return;
  end if;

  select coalesce(max(attempt_number),0) + 1 into v_attempt_number
  from public.exam_attempts where exam_id = p_exam_id and student_id = v_uid;
  if v_attempt_number > v_exam.max_attempts then
    return query select false, null::numeric, v_exam.max_score, 'تم استنفاد عدد المحاولات المسموح به'::text; return;
  end if;

  insert into public.exam_attempts(exam_id, student_id, attempt_number, started_at, expires_at, status)
  values (
    p_exam_id, v_uid, v_attempt_number,
    coalesce(v_access.claimed_at, timezone('utc', now())),
    least(
      coalesce(v_exam.ends_at, timezone('utc', now()) + make_interval(mins => v_exam.duration_minutes)),
      coalesce(v_access.claimed_at, timezone('utc', now())) + make_interval(mins => v_exam.duration_minutes)
    ),
    'in_progress'
  ) returning * into v_attempt;

  for v_item in select * from jsonb_array_elements(p_answers) loop
    select * into v_question from public.exam_questions
    where id = (v_item->>'question_id')::uuid and exam_id = p_exam_id;
    if not found then continue; end if;

    v_answer := nullif(trim(v_item->>'answer_text'),'');
    v_correct := false;
    v_points := v_question.points;

    if v_question.question_type = 'multiple_choice' or v_question.question_type = 'true_false' then
      select * into v_choice from public.exam_choices
      where id = nullif(v_item->>'selected_choice_id','')::uuid and question_id = v_question.id;
      if found and v_choice.is_correct then v_correct := true; end if;
    elsif v_question.question_type = 'short_answer' then
      v_correct := v_answer is not null
        and lower(regexp_replace(v_answer, '\s+', ' ', 'g')) = lower(regexp_replace(coalesce(v_question.correct_answer,''), '\s+', ' ', 'g'));
    end if;

    if v_correct then v_score := v_score + v_points; end if;
    v_max := v_max + v_points;

    insert into public.exam_answers(attempt_id, question_id, answer_text, selected_choice_id, points_awarded, is_correct, answered_at)
    values (
      v_attempt.id,
      v_question.id,
      v_answer,
      nullif(v_item->>'selected_choice_id','')::uuid,
      case when v_correct then v_points else 0 end,
      v_correct,
      timezone('utc', now())
    );
  end loop;

  update public.exam_attempts
  set status = 'submitted', submitted_at = timezone('utc', now()), score = v_score
  where id = v_attempt.id;

  update public.student_exam_access
  set status = 'submitted', submitted_at = timezone('utc', now())
  where id = v_access.id;

  return query select true, v_score, case when v_max > 0 then v_max else v_exam.max_score end, 'تم تسليم الامتحان بنجاح'::text;
end;
$$;
revoke all on function public.submit_student_exam(uuid,jsonb) from public;
grant execute on function public.submit_student_exam(uuid,jsonb) to authenticated;

-- Students can read their own attempts/results only; they cannot write them directly.
drop policy if exists exam_attempts_student_insert on public.exam_attempts;
drop policy if exists exam_attempts_student_update on public.exam_attempts;
drop policy if exists exam_attempts_student_delete on public.exam_attempts;
drop policy if exists exam_answers_student_insert on public.exam_answers;
drop policy if exists exam_answers_student_update on public.exam_answers;
drop policy if exists exam_answers_student_delete on public.exam_answers;

-- Helpful indexes for the E2E paths.
create index if not exists student_exam_access_student_status_idx
on public.student_exam_access(student_id, status, claimed_at desc);
create index if not exists assignments_target_lookup_idx
on public.assignments(group_id, grade_id, is_published, deadline);
