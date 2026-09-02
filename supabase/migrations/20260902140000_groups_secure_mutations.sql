-- ============================================================
-- منصة كيمياء أستاذ أحمد محمد رمضان
-- GROUPS SECURE MUTATIONS
-- ============================================================

-- All sensitive group mutations go through SECURITY DEFINER functions.
-- RLS remains enabled on the underlying tables.

create or replace function public.create_group(
    p_grade_id uuid,
    p_name text,
    p_description text default null,
    p_location text default null,
    p_max_students integer default null
)
returns public.groups
language plpgsql
security definer
set search_path = public
as $$
declare
    v_result public.groups%rowtype;
    v_name text := trim(coalesce(p_name, ''));
begin
    if not public.is_active_admin() then
        raise exception 'Admin access required';
    end if;

    if char_length(v_name) < 2 or char_length(v_name) > 150 then
        raise exception 'Group name must contain between 2 and 150 characters';
    end if;

    if p_max_students is not null and p_max_students <= 0 then
        raise exception 'Group capacity must be greater than zero';
    end if;

    if not exists (
        select 1 from public.grades
        where id = p_grade_id
          and is_active = true
    ) then
        raise exception 'Active grade not found';
    end if;

    if exists (
        select 1 from public.groups
        where grade_id = p_grade_id
          and lower(trim(name)) = lower(v_name)
    ) then
        raise exception 'A group with this name already exists for this grade';
    end if;

    insert into public.groups (
        grade_id,
        name,
        description,
        location,
        max_students,
        is_active
    )
    values (
        p_grade_id,
        v_name,
        nullif(trim(p_description), ''),
        nullif(trim(p_location), ''),
        p_max_students,
        true
    )
    returning * into v_result;

    return v_result;
end;
$$;

create or replace function public.update_group(
    p_group_id uuid,
    p_grade_id uuid,
    p_name text,
    p_description text default null,
    p_location text default null,
    p_max_students integer default null
)
returns public.groups
language plpgsql
security definer
set search_path = public
as $$
declare
    v_result public.groups%rowtype;
    v_name text := trim(coalesce(p_name, ''));
    v_member_count bigint;
begin
    if not public.is_active_admin() then
        raise exception 'Admin access required';
    end if;

    if char_length(v_name) < 2 or char_length(v_name) > 150 then
        raise exception 'Group name must contain between 2 and 150 characters';
    end if;

    if p_max_students is not null and p_max_students <= 0 then
        raise exception 'Group capacity must be greater than zero';
    end if;

    if not exists (
        select 1 from public.groups where id = p_group_id
    ) then
        raise exception 'Group not found';
    end if;

    if not exists (
        select 1 from public.grades
        where id = p_grade_id
          and is_active = true
    ) then
        raise exception 'Active grade not found';
    end if;

    if p_max_students is not null then
        select count(*)
        into v_member_count
        from public.group_members
        where group_id = p_group_id
          and ends_at is null;

        if p_max_students < v_member_count then
            raise exception 'Group capacity cannot be lower than its current active members';
        end if;
    end if;

    if exists (
        select 1 from public.groups
        where id <> p_group_id
          and grade_id = p_grade_id
          and lower(trim(name)) = lower(v_name)
    ) then
        raise exception 'A group with this name already exists for this grade';
    end if;

    update public.groups
    set
        grade_id = p_grade_id,
        name = v_name,
        description = nullif(trim(p_description), ''),
        location = nullif(trim(p_location), ''),
        max_students = p_max_students
    where id = p_group_id
    returning * into v_result;

    return v_result;
end;
$$;

create or replace function public.set_group_active(
    p_group_id uuid,
    p_is_active boolean
)
returns public.groups
language plpgsql
security definer
set search_path = public
as $$
declare
    v_result public.groups%rowtype;
begin
    if not public.is_active_admin() then
        raise exception 'Admin access required';
    end if;

    update public.groups
    set is_active = p_is_active
    where id = p_group_id
    returning * into v_result;

    if not found then
        raise exception 'Group not found';
    end if;

    return v_result;
end;
$$;

revoke all on function public.create_group(uuid, text, text, text, integer) from public;
revoke all on function public.update_group(uuid, uuid, text, text, text, integer) from public;
revoke all on function public.set_group_active(uuid, boolean) from public;

grant execute on function public.create_group(uuid, text, text, text, integer) to authenticated;
grant execute on function public.update_group(uuid, uuid, text, text, text, integer) to authenticated;
grant execute on function public.set_group_active(uuid, boolean) to authenticated;

-- Defense-in-depth: keep the case-insensitive business rule unique at DB level.
create unique index if not exists groups_grade_name_ci_unique_idx
on public.groups (grade_id, lower(trim(name)));
