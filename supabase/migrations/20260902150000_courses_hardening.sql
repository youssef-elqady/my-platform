-- ============================================================
-- COURSES HARDENING
-- ============================================================

alter table public.courses enable row level security;

create index if not exists courses_grade_active_order_idx
on public.courses(grade_id, is_active, display_order);

create unique index if not exists courses_grade_title_ci_unique_idx
on public.courses(grade_id, lower(trim(title)));

alter table public.courses
    drop constraint if exists courses_title_valid;

alter table public.courses
    add constraint courses_title_valid
    check (char_length(trim(title)) between 2 and 150);

alter table public.courses
    drop constraint if exists courses_display_order_positive;

alter table public.courses
    add constraint courses_display_order_positive
    check (display_order > 0);

-- Remove any older permissive policies before creating the final policy set.
drop policy if exists courses_admin_all on public.courses;
drop policy if exists courses_student_read on public.courses;

create policy courses_admin_all
on public.courses
for all
to authenticated
using ((select public.is_active_admin()))
with check ((select public.is_active_admin()));

create policy courses_student_read
on public.courses
for select
to authenticated
using (
    is_active = true
    and exists (
        select 1
        from public.group_members gm
        join public.groups g on g.id = gm.group_id
        where gm.student_id = auth.uid()
          and gm.ends_at is null
          and g.is_active = true
          and g.grade_id = courses.grade_id
    )
);

-- ============================================================
-- SECURE COURSE MUTATIONS
-- ============================================================

create or replace function public.create_course(
    p_grade_id uuid,
    p_title text,
    p_description text default null,
    p_display_order integer default 1
)
returns public.courses
language plpgsql
security definer
set search_path = ''
volatile
as $$
declare
    v_course public.courses;
begin
    if not (select public.is_active_admin()) then
        raise exception 'Only active admins can create courses';
    end if;

    if p_grade_id is null then
        raise exception 'Grade is required';
    end if;

    if p_title is null or char_length(trim(p_title)) not between 2 and 150 then
        raise exception 'Course title must be between 2 and 150 characters';
    end if;

    if p_display_order is null or p_display_order < 1 then
        raise exception 'Display order must be greater than zero';
    end if;

    if not exists (
        select 1
        from public.grades g
        where g.id = p_grade_id
          and g.is_active = true
    ) then
        raise exception 'The selected grade is not active';
    end if;

    if exists (
        select 1
        from public.courses c
        where c.grade_id = p_grade_id
          and lower(trim(c.title)) = lower(trim(p_title))
    ) then
        raise exception 'A course with this title already exists in the selected grade';
    end if;

    insert into public.courses (
        grade_id,
        title,
        description,
        display_order,
        is_active
    )
    values (
        p_grade_id,
        trim(p_title),
        nullif(trim(p_description), ''),
        p_display_order,
        true
    )
    returning * into v_course;

    return v_course;
end;
$$;

create or replace function public.update_course(
    p_course_id uuid,
    p_grade_id uuid,
    p_title text,
    p_description text default null,
    p_display_order integer default 1
)
returns public.courses
language plpgsql
security definer
set search_path = ''
volatile
as $$
declare
    v_course public.courses;
begin
    if not (select public.is_active_admin()) then
        raise exception 'Only active admins can update courses';
    end if;

    if p_course_id is null then
        raise exception 'Course id is required';
    end if;

    if p_title is null or char_length(trim(p_title)) not between 2 and 150 then
        raise exception 'Course title must be between 2 and 150 characters';
    end if;

    if p_display_order is null or p_display_order < 1 then
        raise exception 'Display order must be greater than zero';
    end if;

    if not exists (
        select 1
        from public.grades g
        where g.id = p_grade_id
          and g.is_active = true
    ) then
        raise exception 'The selected grade is not active';
    end if;

    if not exists (
        select 1
        from public.courses c
        where c.id = p_course_id
    ) then
        raise exception 'Course not found';
    end if;

    if exists (
        select 1
        from public.courses c
        where c.id <> p_course_id
          and c.grade_id = p_grade_id
          and lower(trim(c.title)) = lower(trim(p_title))
    ) then
        raise exception 'A course with this title already exists in the selected grade';
    end if;

    update public.courses
    set
        grade_id = p_grade_id,
        title = trim(p_title),
        description = nullif(trim(p_description), ''),
        display_order = p_display_order,
        updated_at = timezone('utc', now())
    where id = p_course_id
    returning * into v_course;

    return v_course;
end;
$$;

create or replace function public.set_course_active(
    p_course_id uuid,
    p_is_active boolean
)
returns public.courses
language plpgsql
security definer
set search_path = ''
volatile
as $$
declare
    v_course public.courses;
begin
    if not (select public.is_active_admin()) then
        raise exception 'Only active admins can change course status';
    end if;

    update public.courses
    set
        is_active = p_is_active,
        updated_at = timezone('utc', now())
    where id = p_course_id
    returning * into v_course;

    if not found then
        raise exception 'Course not found';
    end if;

    return v_course;
end;
$$;

create or replace function public.delete_course(
    p_course_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
volatile
as $$
begin
    if not (select public.is_active_admin()) then
        raise exception 'Only active admins can delete courses';
    end if;

    if not exists (
        select 1
        from public.courses c
        where c.id = p_course_id
    ) then
        raise exception 'Course not found';
    end if;

    if exists (
        select 1
        from public.chapters ch
        where ch.course_id = p_course_id
    ) then
        raise exception 'Cannot permanently delete a course that has chapters. Deactivate it instead.';
    end if;

    delete from public.courses
    where id = p_course_id;
end;
$$;

revoke all on function public.create_course(uuid, text, text, integer) from public;
revoke all on function public.update_course(uuid, uuid, text, text, integer) from public;
revoke all on function public.set_course_active(uuid, boolean) from public;
revoke all on function public.delete_course(uuid) from public;

grant execute on function public.create_course(uuid, text, text, integer) to authenticated;
grant execute on function public.update_course(uuid, uuid, text, text, integer) to authenticated;
grant execute on function public.set_course_active(uuid, boolean) to authenticated;
grant execute on function public.delete_course(uuid) to authenticated;

-- ============================================================
-- CHAPTER READ SECURITY FOR COURSE CONTENT
-- ============================================================

alter table public.chapters enable row level security;

drop policy if exists chapters_admin_all on public.chapters;
drop policy if exists chapters_student_read on public.chapters;

create policy chapters_admin_all
on public.chapters
for all
to authenticated
using ((select public.is_active_admin()))
with check ((select public.is_active_admin()));

create policy chapters_student_read
on public.chapters
for select
to authenticated
using (
    is_active = true
    and exists (
        select 1
        from public.courses c
        join public.group_members gm on gm.student_id = auth.uid() and gm.ends_at is null
        join public.groups g on g.id = gm.group_id and g.is_active = true and g.grade_id = c.grade_id
        where c.id = chapters.course_id
          and c.is_active = true
    )
);

create index if not exists chapters_course_active_order_idx
on public.chapters(course_id, is_active, display_order);

-- Pin SECURITY DEFINER functions to an empty search_path and expose them only to authenticated callers.
-- The function bodies use fully-qualified public object names.
