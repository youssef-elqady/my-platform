-- Assignment target hardening.
-- An assignment may target a grade, a group, or a lesson.
-- When the UI targets a lesson only, derive its grade automatically from the lesson hierarchy.

create or replace function public.normalize_assignment_target()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_grade_id uuid;
  v_course_grade_id uuid;
begin
  if new.lesson_id is not null then
    select c.grade_id
      into v_course_grade_id
    from public.lessons l
    join public.chapters ch on ch.id = l.chapter_id
    join public.courses c on c.id = ch.course_id
    where l.id = new.lesson_id;

    if v_course_grade_id is null then
      raise exception 'الدرس المحدد غير موجود أو غير مرتبط بكورس صالح';
    end if;

    if new.grade_id is null and new.group_id is null then
      new.grade_id := v_course_grade_id;
    end if;
  end if;

  if new.group_id is not null then
    select g.grade_id into v_grade_id
    from public.groups g
    where g.id = new.group_id;

    if v_grade_id is null then
      raise exception 'المجموعة المحددة غير موجودة';
    end if;

    if new.grade_id is null then
      new.grade_id := v_grade_id;
    elsif new.grade_id is distinct from v_grade_id then
      raise exception 'الصف والمجموعة المحددان غير متوافقين';
    end if;
  end if;

  if new.lesson_id is not null and new.grade_id is not null
     and new.grade_id is distinct from v_course_grade_id then
    raise exception 'الدرس لا ينتمي إلى الصف المحدد';
  end if;

  if new.grade_id is null and new.group_id is null and new.lesson_id is null then
    raise exception 'يجب تحديد الصف أو المجموعة أو الدرس المستهدف للواجب';
  end if;

  return new;
end;
$$;

drop trigger if exists assignments_normalize_target on public.assignments;
create trigger assignments_normalize_target
before insert or update on public.assignments
for each row execute function public.normalize_assignment_target();

alter table public.assignments
  drop constraint if exists assignments_target_check;

alter table public.assignments
  add constraint assignments_target_check
  check (grade_id is not null or group_id is not null or lesson_id is not null);

revoke all on function public.normalize_assignment_target() from public;
