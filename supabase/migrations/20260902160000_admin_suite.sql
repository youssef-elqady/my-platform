-- ============================================================
-- ADMIN SUITE HARDENING
-- Lessons / Assignments / Exams / Grades / Attendance /
-- Activation Codes / Assistants / Notifications / Settings
-- ============================================================

create table if not exists public.activation_codes (
    id uuid primary key default gen_random_uuid(),
    code text not null,
    max_uses integer not null default 1,
    used_count integer not null default 0,
    expires_at timestamptz,
    is_active boolean not null default true,
    created_by uuid references public.profiles(id) on delete set null,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint activation_codes_code_len check (char_length(trim(code)) between 6 and 64),
    constraint activation_codes_uses_valid check (max_uses > 0 and used_count >= 0 and used_count <= max_uses)
);

create unique index if not exists activation_codes_code_ci_idx on public.activation_codes(lower(trim(code)));
create index if not exists activation_codes_active_idx on public.activation_codes(is_active, expires_at);

create table if not exists public.staff_members (
    user_id uuid primary key references public.profiles(id) on delete cascade,
    display_name text not null,
    permissions jsonb not null default '{}'::jsonb,
    is_active boolean not null default true,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint staff_members_name_len check (char_length(trim(display_name)) between 2 and 150)
);

create table if not exists public.notifications (
    id uuid primary key default gen_random_uuid(),
    recipient_id uuid references public.profiles(id) on delete cascade,
    title text not null,
    message text not null,
    type text not null default 'info',
    is_read boolean not null default false,
    created_by uuid references public.profiles(id) on delete set null,
    created_at timestamptz not null default timezone('utc', now())
);

create index if not exists notifications_recipient_idx on public.notifications(recipient_id, is_read, created_at desc);
create index if not exists notifications_created_idx on public.notifications(created_at desc);

create table if not exists public.platform_settings (
    id boolean primary key default true,
    platform_name text not null default 'منصة كيمياء أستاذ أحمد محمد رمضان',
    teacher_name text not null default 'أستاذ أحمد محمد رمضان',
    support_phone text,
    support_email text,
    logo_url text,
    welcome_message text,
    maintenance_mode boolean not null default false,
    allow_registration boolean not null default true,
    updated_by uuid references public.profiles(id) on delete set null,
    updated_at timestamptz not null default timezone('utc', now()),
    constraint platform_settings_singleton check (id = true)
);

insert into public.platform_settings (id) values (true) on conflict (id) do nothing;

-- Shared trigger for newly created tables.
drop trigger if exists activation_codes_updated_at on public.activation_codes;
create trigger activation_codes_updated_at before update on public.activation_codes for each row execute function public.set_updated_at();
drop trigger if exists staff_members_updated_at on public.staff_members;
create trigger staff_members_updated_at before update on public.staff_members for each row execute function public.set_updated_at();

-- RLS: every admin mutation is server-authorized by the existing security-definer admin check.
alter table public.activation_codes enable row level security;
alter table public.staff_members enable row level security;
alter table public.notifications enable row level security;
alter table public.platform_settings enable row level security;
alter table public.lessons enable row level security;
alter table public.assignments enable row level security;
alter table public.exams enable row level security;
alter table public.exam_questions enable row level security;
alter table public.exam_attempts enable row level security;
alter table public.exam_answers enable row level security;
alter table public.attendance enable row level security;
alter table public.sessions enable row level security;

-- Remove/recreate only policies owned by this migration.
drop policy if exists activation_codes_admin_all on public.activation_codes;
create policy activation_codes_admin_all on public.activation_codes for all to authenticated using ((select public.is_active_admin())) with check ((select public.is_active_admin()));

drop policy if exists staff_members_admin_all on public.staff_members;
create policy staff_members_admin_all on public.staff_members for all to authenticated using ((select public.is_active_admin())) with check ((select public.is_active_admin()));

drop policy if exists notifications_admin_all on public.notifications;
create policy notifications_admin_all on public.notifications for all to authenticated using ((select public.is_active_admin())) with check ((select public.is_active_admin()));

drop policy if exists settings_admin_all on public.platform_settings;
create policy settings_admin_all on public.platform_settings for all to authenticated using ((select public.is_active_admin())) with check ((select public.is_active_admin()));

drop policy if exists lessons_admin_all on public.lessons;
create policy lessons_admin_all on public.lessons for all to authenticated using ((select public.is_active_admin())) with check ((select public.is_active_admin()));

drop policy if exists assignments_admin_all on public.assignments;
create policy assignments_admin_all on public.assignments for all to authenticated using ((select public.is_active_admin())) with check ((select public.is_active_admin()));

drop policy if exists exams_admin_all on public.exams;
create policy exams_admin_all on public.exams for all to authenticated using ((select public.is_active_admin())) with check ((select public.is_active_admin()));

drop policy if exists exam_questions_admin_all on public.exam_questions;
create policy exam_questions_admin_all on public.exam_questions for all to authenticated using ((select public.is_active_admin())) with check ((select public.is_active_admin()));

drop policy if exists exam_attempts_admin_all on public.exam_attempts;
create policy exam_attempts_admin_all on public.exam_attempts for all to authenticated using ((select public.is_active_admin())) with check ((select public.is_active_admin()));

drop policy if exists exam_answers_admin_all on public.exam_answers;
create policy exam_answers_admin_all on public.exam_answers for all to authenticated using ((select public.is_active_admin())) with check ((select public.is_active_admin()));

drop policy if exists attendance_admin_all on public.attendance;
create policy attendance_admin_all on public.attendance for all to authenticated using ((select public.is_active_admin())) with check ((select public.is_active_admin()));

drop policy if exists sessions_admin_all on public.sessions;
create policy sessions_admin_all on public.sessions for all to authenticated using ((select public.is_active_admin())) with check ((select public.is_active_admin()));

-- Students need read access to published content and their own academic records.
drop policy if exists lessons_student_read on public.lessons;
create policy lessons_student_read on public.lessons for select to authenticated using (
    status = 'published' and exists (
        select 1 from public.group_members gm
        join public.groups g on g.id = gm.group_id
        join public.chapters ch on ch.id = lessons.chapter_id
        join public.courses c on c.id = ch.course_id
        where gm.student_id = auth.uid() and gm.ends_at is null and g.is_active = true and c.is_active = true and ch.is_active = true and g.grade_id = c.grade_id
    )
);

drop policy if exists exam_attempts_student_own on public.exam_attempts;
create policy exam_attempts_student_own on public.exam_attempts for select to authenticated using (student_id = auth.uid());
drop policy if exists exam_answers_student_own on public.exam_answers;
create policy exam_answers_student_own on public.exam_answers for select to authenticated using (exists (select 1 from public.exam_attempts ea where ea.id = exam_answers.attempt_id and ea.student_id = auth.uid()));
drop policy if exists attendance_student_own on public.attendance;
create policy attendance_student_own on public.attendance for select to authenticated using (student_id = auth.uid());

-- Secure helper for activation code generation. The raw code is returned once to the admin UI.
create or replace function public.create_activation_code(p_max_uses integer default 1, p_expires_at timestamptz default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
    v_code text;
begin
    if not public.is_active_admin() then raise exception 'Administrator access required'; end if;
    if p_max_uses < 1 or p_max_uses > 10000 then raise exception 'Invalid maximum uses'; end if;
    v_code := upper(substr(encode(gen_random_bytes(9), 'hex'), 1, 12));
    insert into public.activation_codes(code, max_uses, expires_at, created_by) values (v_code, p_max_uses, p_expires_at, auth.uid());
    return v_code;
end;
$$;

create or replace function public.revoke_activation_code(p_code_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if not public.is_active_admin() then raise exception 'Administrator access required'; end if;
    update public.activation_codes set is_active = false, updated_at = timezone('utc', now()) where id = p_code_id;
end;
$$;

create or replace function public.mark_attendance(p_session_id uuid, p_student_id uuid, p_status public.attendance_status)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if not public.is_active_admin() then raise exception 'Administrator access required'; end if;
    insert into public.attendance(session_id, student_id, status, manually_modified, modified_by, modified_at)
    values (p_session_id, p_student_id, p_status, true, auth.uid(), timezone('utc', now()))
    on conflict (session_id, student_id) do update set status = excluded.status, manually_modified = true, modified_by = auth.uid(), modified_at = timezone('utc', now()), marked_at = timezone('utc', now());
end;
$$;

revoke all on function public.create_activation_code(integer, timestamptz) from public;
revoke all on function public.revoke_activation_code(uuid) from public;
revoke all on function public.mark_attendance(uuid, uuid, public.attendance_status) from public;
grant execute on function public.create_activation_code(integer, timestamptz) to authenticated;
grant execute on function public.revoke_activation_code(uuid) to authenticated;
grant execute on function public.mark_attendance(uuid, uuid, public.attendance_status) to authenticated;

create index if not exists lessons_chapter_order_idx on public.lessons(chapter_id, display_order);
create index if not exists assignments_grade_deadline_idx on public.assignments(grade_id, deadline);
create index if not exists exams_group_window_idx on public.exams(group_id, starts_at, ends_at);
create index if not exists exam_questions_exam_order_idx on public.exam_questions(exam_id, display_order);
create index if not exists attendance_session_status_idx on public.attendance(session_id, status);
