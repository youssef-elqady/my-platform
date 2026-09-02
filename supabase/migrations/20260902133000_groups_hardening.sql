-- ============================================================
-- منصة كيمياء أستاذ أحمد محمد رمضان
-- GROUPS HARDENING
-- ============================================================

-- Optional capacity. NULL means unlimited.
alter table public.groups
    add column if not exists max_students integer;

alter table public.groups
    drop constraint if exists groups_max_students_positive;

alter table public.groups
    add constraint groups_max_students_positive
    check (max_students is null or max_students > 0);

create index if not exists groups_active_grade_idx
on public.groups(grade_id, is_active);

create index if not exists group_members_active_group_idx
on public.group_members(group_id)
where ends_at is null;

-- ============================================================
-- RLS
-- ============================================================

alter table public.groups enable row level security;
alter table public.group_members enable row level security;

drop policy if exists groups_admin_all on public.groups;
create policy groups_admin_all
on public.groups
for all
to authenticated
using (public.is_active_admin())
with check (public.is_active_admin());

drop policy if exists groups_student_read_current on public.groups;
create policy groups_student_read_current
on public.groups
for select
to authenticated
using (
    exists (
        select 1
        from public.group_members gm
        where gm.group_id = public.groups.id
          and gm.student_id = auth.uid()
          and gm.ends_at is null
    )
);

-- Admin reads only current memberships through the table.
-- Historical memberships remain stored in the database and are handled by RPCs.
drop policy if exists group_members_admin_all on public.group_members;
drop policy if exists group_members_admin_select_current on public.group_members;
drop policy if exists group_members_admin_insert on public.group_members;
drop policy if exists group_members_admin_update on public.group_members;
drop policy if exists group_members_admin_delete on public.group_members;

create policy group_members_admin_select_current
on public.group_members
for select
to authenticated
using (
    public.is_active_admin()
    and ends_at is null
);

create policy group_members_admin_insert
on public.group_members
for insert
to authenticated
with check (public.is_active_admin());

create policy group_members_admin_update
on public.group_members
for update
to authenticated
using (public.is_active_admin())
with check (public.is_active_admin());

create policy group_members_admin_delete
on public.group_members
for delete
to authenticated
using (public.is_active_admin());

drop policy if exists group_members_student_read_current on public.group_members;
create policy group_members_student_read_current
on public.group_members
for select
to authenticated
using (
    student_id = auth.uid()
    and ends_at is null
);

-- ============================================================
-- ADD STUDENT TO GROUP
-- ============================================================

create or replace function public.add_student_to_group(
    p_group_id uuid,
    p_student_id uuid
)
returns public.group_members
language plpgsql
security definer
set search_path = public
as $$
declare
    v_group public.groups%rowtype;
    v_member_count bigint;
    v_existing public.group_members%rowtype;
    v_result public.group_members%rowtype;
begin
    if not public.is_active_admin() then
        raise exception 'Admin access required';
    end if;

    select *
    into v_group
    from public.groups
    where id = p_group_id
    for update;

    if not found then
        raise exception 'Group not found';
    end if;

    if not v_group.is_active then
        raise exception 'Cannot add students to an inactive group';
    end if;

    select *
    into v_existing
    from public.group_members
    where student_id = p_student_id
      and ends_at is null
    limit 1;

    if found then
        if v_existing.group_id = p_group_id then
            raise exception 'Student is already in this group';
        end if;

        raise exception 'Student already belongs to another active group';
    end if;

    if not exists (
        select 1
        from public.profiles p
        join public.student_profiles sp on sp.user_id = p.id
        where p.id = p_student_id
          and p.role = 'student'
          and p.is_active = true
          and sp.status = 'active'
    ) then
        raise exception 'Only active students can be added to a group';
    end if;

    select count(*)
    into v_member_count
    from public.group_members
    where group_id = p_group_id
      and ends_at is null;

    if v_group.max_students is not null
       and v_member_count >= v_group.max_students then
        raise exception 'Group capacity has been reached';
    end if;

    insert into public.group_members (
        student_id,
        group_id,
        starts_at,
        ends_at
    )
    values (
        p_student_id,
        p_group_id,
        timezone('utc', now()),
        null
    )
    returning * into v_result;

    return v_result;
end;
$$;

-- ============================================================
-- REMOVE STUDENT FROM GROUP
-- Keeps membership history instead of deleting it.
-- ============================================================

create or replace function public.remove_student_from_group(
    p_group_member_id uuid
)
returns public.group_members
language plpgsql
security definer
set search_path = public
as $$
declare
    v_result public.group_members%rowtype;
begin
    if not public.is_active_admin() then
        raise exception 'Admin access required';
    end if;

    update public.group_members
    set ends_at = timezone('utc', now())
    where id = p_group_member_id
      and ends_at is null
    returning * into v_result;

    if not found then
        raise exception 'Active group membership not found';
    end if;

    return v_result;
end;
$$;

-- ============================================================
-- DELETE GROUP SAFELY
-- Only groups with no dependent records can be physically deleted.
-- In normal operation, deactivation is preferred.
-- ============================================================

create or replace function public.delete_group(
    p_group_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if not public.is_active_admin() then
        raise exception 'Admin access required';
    end if;

    if exists (
        select 1 from public.group_members where group_id = p_group_id
    ) then
        raise exception 'Cannot delete a group with membership history. Deactivate it instead.';
    end if;

    if exists (
        select 1 from public.schedules where group_id = p_group_id
    ) then
        raise exception 'Cannot delete a group that has schedules. Deactivate it instead.';
    end if;

    if exists (
        select 1 from public.sessions where group_id = p_group_id
    ) then
        raise exception 'Cannot delete a group that has sessions. Deactivate it instead.';
    end if;

    if exists (
        select 1 from public.content_targets where group_id = p_group_id
    ) then
        raise exception 'Cannot delete a group targeted by content. Deactivate it instead.';
    end if;

    if exists (
        select 1 from public.exams where group_id = p_group_id
    ) then
        raise exception 'Cannot delete a group linked to exams. Deactivate it instead.';
    end if;

    delete from public.groups
    where id = p_group_id;

    if not found then
        raise exception 'Group not found';
    end if;
end;
$$;

revoke all on function public.add_student_to_group(uuid, uuid) from public;
revoke all on function public.remove_student_from_group(uuid) from public;
revoke all on function public.delete_group(uuid) from public;

grant execute on function public.add_student_to_group(uuid, uuid) to authenticated;
grant execute on function public.remove_student_from_group(uuid) to authenticated;
grant execute on function public.delete_group(uuid) to authenticated;

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

drop trigger if exists groups_set_updated_at on public.groups;
create trigger groups_set_updated_at
before update on public.groups
for each row
execute function public.set_updated_at();
