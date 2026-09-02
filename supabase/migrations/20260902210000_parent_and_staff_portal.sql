-- ============================================================
-- Parent portal + staff context
-- Parent access is intentionally NOT an authenticated platform session.
-- It requires the registered parent phone + student's unique code and
-- returns a limited, aggregated report only.
-- ============================================================

create table if not exists public.parent_verification_attempts (
  id uuid primary key default gen_random_uuid(),
  lookup_hash text not null,
  attempted_at timestamptz not null default timezone('utc', now())
);
create index if not exists parent_verification_attempts_hash_idx on public.parent_verification_attempts(lookup_hash, attempted_at desc);

alter table public.parent_verification_attempts enable row level security;

create or replace function public.get_my_staff_context()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.app_role;
  v_staff public.staff_members%rowtype;
begin
  if v_uid is null then
    return jsonb_build_object('is_staff',false,'is_active',false,'is_admin',false,'permissions','{}'::jsonb);
  end if;
  select role into v_role from public.profiles where id = v_uid;
  select * into v_staff from public.staff_members where user_id = v_uid limit 1;
  return jsonb_build_object(
    'is_staff', v_staff.user_id is not null,
    'is_active', coalesce(v_staff.is_active,false),
    'is_admin', v_role = 'admin' and v_staff.user_id is null,
    'display_name', coalesce(v_staff.display_name,''),
    'permissions', coalesce(v_staff.permissions,'{}'::jsonb)
  );
end;
$$;
revoke all on function public.get_my_staff_context() from public;
grant execute on function public.get_my_staff_context() to authenticated;

create or replace function public.parent_get_student_report(p_parent_phone text, p_student_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text := regexp_replace(coalesce(p_parent_phone,''), '\\s+', '', 'g');
  v_code text := upper(trim(coalesce(p_student_code,'')));
  v_hash text;
  v_student_id uuid;
  v_name text;
  v_grade text;
  v_group text;
  v_exam_count integer := 0;
  v_exam_avg numeric := 0;
  v_submitted integer := 0;
  v_attendance_rate numeric := 0;
  v_study_minutes integer := 0;
  v_recent jsonb := '[]'::jsonb;
  v_strengths jsonb := '[]'::jsonb;
  v_needs jsonb := '[]'::jsonb;
  v_recs jsonb := '[]'::jsonb;
  v_attempt_count integer := 0;
begin
  if char_length(v_phone) < 10 or char_length(v_code) < 6 then
    return jsonb_build_object('success',false,'error','بيانات التحقق غير صحيحة.');
  end if;

  v_hash := encode(digest(v_phone || ':' || v_code, 'sha256'), 'hex');
  select count(*) into v_attempt_count from public.parent_verification_attempts where lookup_hash = v_hash and attempted_at > timezone('utc',now()) - interval '1 hour';
  if v_attempt_count >= 20 then
    return jsonb_build_object('success',false,'error','تم تجاوز عدد محاولات التحقق. حاول مرة أخرى لاحقًا.');
  end if;
  insert into public.parent_verification_attempts(lookup_hash) values (v_hash);

  select p.id, p.full_name, sp.parent_phone
    into v_student_id, v_name, v_phone
  from public.profiles p
  join public.student_profiles sp on sp.user_id = p.id
  where p.role = 'student'
    and upper(sp.student_code) = v_code
    and sp.parent_phone = regexp_replace(coalesce(p_parent_phone,''), '\\s+', '', 'g')
    and sp.status in ('approved','active');

  if v_student_id is null then
    return jsonb_build_object('success',false,'error','بيانات التحقق غير صحيحة.');
  end if;

  select g.name, gr.name into v_group, v_grade
  from public.group_members gm
  join public.groups g on g.id = gm.group_id
  join public.grades gr on gr.id = g.grade_id
  where gm.student_id = v_student_id and gm.ends_at is null and g.is_active = true
  order by gm.started_at desc nulls last limit 1;

  select count(*), coalesce(avg((ea.score / nullif(e.max_score,0))*100),0)
    into v_exam_count, v_exam_avg
  from public.exam_attempts ea join public.exams e on e.id = ea.exam_id
  where ea.student_id = v_student_id and ea.status = 'submitted' and ea.score is not null;

  select count(*) into v_submitted from public.assignment_submissions where student_id = v_student_id and status in ('submitted','graded','late');

  select coalesce(round(100.0 * avg(case when a.status in ('present','late') then 1 else 0 end)),0)
    into v_attendance_rate
  from public.attendance a where a.student_id = v_student_id;

  select coalesce(round(sum(vp.watch_time_seconds)/60.0),0)
    into v_study_minutes
  from public.video_progress vp where vp.student_id = v_student_id;

  select coalesce(jsonb_agg(jsonb_build_object('title',x.title,'score',x.score,'max_score',x.max_score,'date',x.created_at) order by x.created_at desc),'[]'::jsonb)
    into v_recent
  from (select e.title, ea.score, e.max_score, ea.created_at from public.exam_attempts ea join public.exams e on e.id=ea.exam_id where ea.student_id=v_student_id and ea.status='submitted' order by ea.created_at desc limit 8) x;

  if v_exam_count > 0 and v_exam_avg >= 80 then v_strengths := jsonb_build_array('أداء جيد ومستقر في الاختبارات.'); end if;
  if v_attendance_rate >= 90 then v_strengths := v_strengths || jsonb_build_array('الالتزام بالحضور ممتاز.'); end if;
  if v_study_minutes >= 180 then v_strengths := v_strengths || jsonb_build_array('يوجد وقت مذاكرة ومشاهدة جيد داخل المنصة.'); end if;
  if v_exam_count > 0 and v_exam_avg < 60 then v_needs := v_needs || jsonb_build_array('متوسط الاختبارات يحتاج إلى تدخل ومراجعة منتظمة.'); end if;
  if v_attendance_rate < 75 then v_needs := v_needs || jsonb_build_array('نسبة الحضور منخفضة وتحتاج إلى متابعة.'); end if;
  if v_submitted = 0 then v_needs := v_needs || jsonb_build_array('لا توجد واجبات مسلّمة مسجلة حتى الآن.'); end if;
  if jsonb_array_length(v_needs)=0 then v_needs := jsonb_build_array('لا توجد علامة تحذير رئيسية حاليًا؛ استمر على نفس الوتيرة.'); end if;

  v_recs := jsonb_build_array('راجع التقرير أسبوعيًا بدل انتظار نتيجة الامتحان فقط.');
  if v_exam_avg < 70 then v_recs := v_recs || jsonb_build_array('خصص وقتًا ثابتًا لمراجعة الأجزاء التي أخطأ فيها الطالب ثم حل أسئلة قصيرة عليها.'); end if;
  if v_attendance_rate < 90 then v_recs := v_recs || jsonb_build_array('شجع الطالب على الالتزام بالشرح والحصص ومتابعة الدروس المنشورة.'); end if;
  if v_submitted = 0 then v_recs := v_recs || jsonb_build_array('تأكد من متابعة الواجبات وتسليمها في موعدها.'); end if;

  return jsonb_build_object('success',true,'report',jsonb_build_object(
    'student',jsonb_build_object('full_name',v_name,'student_code',v_code,'grade_name',v_grade,'group_name',v_group),
    'summary',jsonb_build_object('exam_average',round(v_exam_avg,1),'exams_count',v_exam_count,'assignments_submitted',v_submitted,'attendance_rate',round(v_attendance_rate,1),'study_minutes',v_study_minutes),
    'strengths',v_strengths,'needs_attention',v_needs,'recommendations',v_recs,'recent_exams',v_recent
  ));
end;
$$;
revoke all on function public.parent_get_student_report(text,text) from public;
grant execute on function public.parent_get_student_report(text,text) to anon, authenticated;
