-- ============================================================
-- منصة أستاذ أحمد محمد رمضان
-- PHASE 1 - Initial Database Schema
-- ============================================================

-- ============================================================
-- Extensions
-- ============================================================

create extension if not exists "pgcrypto";

-- ============================================================
-- Schemas
-- ============================================================

create schema if not exists private;

-- ============================================================
-- ENUM TYPES
-- ============================================================

do $$
begin
    if not exists (
        select 1
        from pg_type
        where typname = 'app_role'
    ) then
        create type public.app_role as enum (
            'admin',
            'student'
        );
    end if;

    if not exists (
        select 1
        from pg_type
        where typname = 'student_status'
    ) then
        create type public.student_status as enum (
            'pending',
            'approved',
            'rejected',
            'active',
            'suspended'
        );
    end if;

    if not exists (
        select 1
        from pg_type
        where typname = 'content_status'
    ) then
        create type public.content_status as enum (
            'draft',
            'published',
            'archived'
        );
    end if;

    if not exists (
        select 1
        from pg_type
        where typname = 'session_status'
    ) then
        create type public.session_status as enum (
            'scheduled',
            'active',
            'completed',
            'cancelled'
        );
    end if;

    if not exists (
        select 1
        from pg_type
        where typname = 'attendance_status'
    ) then
        create type public.attendance_status as enum (
            'present',
            'late',
            'absent',
            'excused'
        );
    end if;

    if not exists (
        select 1
        from pg_type
        where typname = 'submission_status'
    ) then
        create type public.submission_status as enum (
            'pending',
            'submitted',
            'late',
            'graded'
        );
    end if;

    if not exists (
        select 1
        from pg_type
        where typname = 'exam_attempt_status'
    ) then
        create type public.exam_attempt_status as enum (
            'in_progress',
            'submitted',
            'expired',
            'cancelled'
        );
    end if;

    if not exists (
        select 1
        from pg_type
        where typname = 'question_type'
    ) then
        create type public.question_type as enum (
            'multiple_choice',
            'true_false',
            'short_answer'
        );
    end if;
end
$$;

-- ============================================================
-- Helper function: updated_at
-- ============================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
    new.updated_at = timezone('utc', now());
    return new;
end;
$$;

-- ============================================================
-- PROFILES
-- ============================================================

create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,

    full_name text not null,

    phone text,

    role public.app_role not null default 'student',

    avatar_url text,

    is_active boolean not null default true,

    created_at timestamptz not null default timezone('utc', now()),

    updated_at timestamptz not null default timezone('utc', now()),

    constraint profiles_full_name_length
        check (char_length(trim(full_name)) between 2 and 150)
);

create unique index if not exists profiles_phone_unique_idx
on public.profiles (phone)
where phone is not null;

-- ============================================================
-- STUDENT PROFILES
-- ============================================================

create table if not exists public.student_profiles (
    user_id uuid primary key
        references public.profiles(id)
        on delete cascade,

    status public.student_status not null default 'pending',

    registration_note text,

    approved_at timestamptz,

    approved_by uuid
        references public.profiles(id)
        on delete set null,

    suspended_at timestamptz,

    suspended_by uuid
        references public.profiles(id)
        on delete set null,

    created_at timestamptz not null default timezone('utc', now()),

    updated_at timestamptz not null default timezone('utc', now())
);

-- ============================================================
-- ADMIN PROFILES
-- ============================================================

create table if not exists public.admin_profiles (
    user_id uuid primary key
        references public.profiles(id)
        on delete cascade,

    created_at timestamptz not null default timezone('utc', now()),

    updated_at timestamptz not null default timezone('utc', now())
);

-- ============================================================
-- STAGES
-- ============================================================

create table if not exists public.stages (
    id uuid primary key default gen_random_uuid(),

    name text not null unique,

    display_order integer not null,

    is_active boolean not null default true,

    created_at timestamptz not null default timezone('utc', now()),

    updated_at timestamptz not null default timezone('utc', now()),

    constraint stages_display_order_positive
        check (display_order > 0)
);

-- ============================================================
-- GRADES
-- ============================================================

create table if not exists public.grades (
    id uuid primary key default gen_random_uuid(),

    stage_id uuid not null
        references public.stages(id)
        on delete restrict,

    name text not null,

    display_order integer not null,

    is_active boolean not null default true,

    created_at timestamptz not null default timezone('utc', now()),

    updated_at timestamptz not null default timezone('utc', now()),

    constraint grades_display_order_positive
        check (display_order > 0),

    constraint grades_stage_name_unique
        unique (stage_id, name)
);

create index if not exists grades_stage_id_idx
on public.grades(stage_id);

-- ============================================================
-- GROUPS
-- ============================================================

create table if not exists public.groups (
    id uuid primary key default gen_random_uuid(),

    grade_id uuid not null
        references public.grades(id)
        on delete restrict,

    name text not null,

    description text,

    location text,

    is_active boolean not null default true,

    created_at timestamptz not null default timezone('utc', now()),

    updated_at timestamptz not null default timezone('utc', now()),

    constraint groups_grade_name_unique
        unique (grade_id, name)
);

create index if not exists groups_grade_id_idx
on public.groups(grade_id);

-- ============================================================
-- GROUP MEMBERS
-- ============================================================

create table if not exists public.group_members (
    id uuid primary key default gen_random_uuid(),

    student_id uuid not null
        references public.student_profiles(user_id)
        on delete cascade,

    group_id uuid not null
        references public.groups(id)
        on delete restrict,

    starts_at timestamptz not null default timezone('utc', now()),

    ends_at timestamptz,

    created_at timestamptz not null default timezone('utc', now()),

    constraint group_members_dates_valid
        check (ends_at is null or ends_at > starts_at)
);

create unique index if not exists group_members_one_active_group_idx
on public.group_members(student_id)
where ends_at is null;

create index if not exists group_members_group_id_idx
on public.group_members(group_id);

create index if not exists group_members_student_id_idx
on public.group_members(student_id);

-- ============================================================
-- COURSES
-- ============================================================

create table if not exists public.courses (
    id uuid primary key default gen_random_uuid(),

    grade_id uuid not null
        references public.grades(id)
        on delete restrict,

    title text not null,

    description text,

    display_order integer not null default 1,

    is_active boolean not null default true,

    created_at timestamptz not null default timezone('utc', now()),

    updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists courses_grade_id_idx
on public.courses(grade_id);

-- ============================================================
-- CHAPTERS
-- ============================================================

create table if not exists public.chapters (
    id uuid primary key default gen_random_uuid(),

    course_id uuid not null
        references public.courses(id)
        on delete cascade,

    title text not null,

    description text,

    display_order integer not null default 1,

    is_active boolean not null default true,

    created_at timestamptz not null default timezone('utc', now()),

    updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists chapters_course_id_idx
on public.chapters(course_id);

-- ============================================================
-- LESSONS
-- ============================================================

create table if not exists public.lessons (
    id uuid primary key default gen_random_uuid(),

    chapter_id uuid not null
        references public.chapters(id)
        on delete cascade,

    title text not null,

    description text,

    content text,

    video_provider text,

    video_asset_id text,

    pdf_storage_path text,

    status public.content_status not null default 'draft',

    display_order integer not null default 1,

    published_at timestamptz,

    created_at timestamptz not null default timezone('utc', now()),

    updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists lessons_chapter_id_idx
on public.lessons(chapter_id);

create index if not exists lessons_status_idx
on public.lessons(status);

-- ============================================================
-- CONTENT TARGETS
-- ============================================================

create table if not exists public.content_targets (
    id uuid primary key default gen_random_uuid(),

    lesson_id uuid not null
        references public.lessons(id)
        on delete cascade,

    grade_id uuid
        references public.grades(id)
        on delete cascade,

    group_id uuid
        references public.groups(id)
        on delete cascade,

    created_at timestamptz not null default timezone('utc', now()),

    constraint content_target_scope_check
        check (
            grade_id is not null
            or group_id is not null
        )
);

create unique index if not exists content_targets_lesson_grade_unique_idx
on public.content_targets(lesson_id, grade_id)
where grade_id is not null;

create unique index if not exists content_targets_lesson_group_unique_idx
on public.content_targets(lesson_id, group_id)
where group_id is not null;

create index if not exists content_targets_lesson_id_idx
on public.content_targets(lesson_id);

create index if not exists content_targets_grade_id_idx
on public.content_targets(grade_id);

create index if not exists content_targets_group_id_idx
on public.content_targets(group_id);

-- ============================================================
-- SCHEDULES
-- ============================================================

create table if not exists public.schedules (
    id uuid primary key default gen_random_uuid(),

    group_id uuid not null
        references public.groups(id)
        on delete restrict,

    day_of_week smallint not null,

    start_time time not null,

    end_time time not null,

    location text,

    is_active boolean not null default true,

    created_at timestamptz not null default timezone('utc', now()),

    updated_at timestamptz not null default timezone('utc', now()),

    constraint schedules_day_valid
        check (day_of_week between 0 and 6),

    constraint schedules_time_valid
        check (end_time > start_time)
);

create index if not exists schedules_group_id_idx
on public.schedules(group_id);

-- ============================================================
-- SESSIONS
-- ============================================================

create table if not exists public.sessions (
    id uuid primary key default gen_random_uuid(),

    group_id uuid not null
        references public.groups(id)
        on delete restrict,

    schedule_id uuid
        references public.schedules(id)
        on delete set null,

    session_date date not null,

    start_time time not null,

    end_time time not null,

    status public.session_status not null default 'scheduled',

    topic text,

    notes text,

    attendance_window_start timestamptz,

    attendance_window_end timestamptz,

    created_at timestamptz not null default timezone('utc', now()),

    updated_at timestamptz not null default timezone('utc', now()),

    constraint sessions_time_valid
        check (end_time > start_time),

    constraint sessions_attendance_window_valid
        check (
            attendance_window_end is null
            or attendance_window_start is null
            or attendance_window_end > attendance_window_start
        )
);

create index if not exists sessions_group_date_idx
on public.sessions(group_id, session_date);

create index if not exists sessions_status_idx
on public.sessions(status);

-- ============================================================
-- ATTENDANCE TOKENS
-- ============================================================

create table if not exists public.attendance_tokens (
    id uuid primary key default gen_random_uuid(),

    session_id uuid not null
        references public.sessions(id)
        on delete cascade,

    token_hash text not null,

    expires_at timestamptz not null,

    revoked_at timestamptz,

    created_at timestamptz not null default timezone('utc', now())
);

create index if not exists attendance_tokens_session_id_idx
on public.attendance_tokens(session_id);

create index if not exists attendance_tokens_expires_at_idx
on public.attendance_tokens(expires_at);

create unique index if not exists attendance_tokens_hash_unique_idx
on public.attendance_tokens(token_hash);

-- ============================================================
-- ATTENDANCE
-- ============================================================

create table if not exists public.attendance (
    id uuid primary key default gen_random_uuid(),

    session_id uuid not null
        references public.sessions(id)
        on delete cascade,

    student_id uuid not null
        references public.student_profiles(user_id)
        on delete cascade,

    status public.attendance_status not null default 'present',

    marked_at timestamptz not null default timezone('utc', now()),

    attendance_token_id uuid
        references public.attendance_tokens(id)
        on delete set null,

    manually_modified boolean not null default false,

    modified_by uuid
        references public.profiles(id)
        on delete set null,

    modified_at timestamptz,

    created_at timestamptz not null default timezone('utc', now()),

    constraint attendance_student_session_unique
        unique (session_id, student_id)
);

create index if not exists attendance_student_id_idx
on public.attendance(student_id);

create index if not exists attendance_session_id_idx
on public.attendance(session_id);

create index if not exists attendance_marked_at_idx
on public.attendance(marked_at);

-- ============================================================
-- VIDEO PROGRESS
-- ============================================================

create table if not exists public.video_progress (
    id uuid primary key default gen_random_uuid(),

    student_id uuid not null
        references public.student_profiles(user_id)
        on delete cascade,

    lesson_id uuid not null
        references public.lessons(id)
        on delete cascade,

    last_position_seconds integer not null default 0,

    watch_time_seconds integer not null default 0,

    completion_percentage numeric(5,2) not null default 0,

    completed boolean not null default false,

    open_count integer not null default 0,

    last_watched_at timestamptz,

    created_at timestamptz not null default timezone('utc', now()),

    updated_at timestamptz not null default timezone('utc', now()),

    constraint video_progress_position_positive
        check (last_position_seconds >= 0),

    constraint video_progress_watch_time_positive
        check (watch_time_seconds >= 0),

    constraint video_progress_completion_valid
        check (
            completion_percentage >= 0
            and completion_percentage <= 100
        ),

    constraint video_progress_open_count_valid
        check (open_count >= 0),

    constraint video_progress_student_lesson_unique
        unique (student_id, lesson_id)
);

create index if not exists video_progress_student_id_idx
on public.video_progress(student_id);

create index if not exists video_progress_lesson_id_idx
on public.video_progress(lesson_id);

-- ============================================================
-- ASSIGNMENTS
-- ============================================================

create table if not exists public.assignments (
    id uuid primary key default gen_random_uuid(),

    title text not null,

    description text,

    instructions text,

    grade_id uuid
        references public.grades(id)
        on delete restrict,

    group_id uuid
        references public.groups(id)
        on delete restrict,

    lesson_id uuid
        references public.lessons(id)
        on delete set null,

    attachment_path text,

    deadline timestamptz,

    max_score numeric(8,2) not null default 100,

    allow_resubmission boolean not null default false,

    is_published boolean not null default false,

    created_at timestamptz not null default timezone('utc', now()),

    updated_at timestamptz not null default timezone('utc', now()),

    constraint assignments_target_check
        check (
            grade_id is not null
            or group_id is not null
        ),

    constraint assignments_max_score_positive
        check (max_score > 0)
);

create index if not exists assignments_grade_id_idx
on public.assignments(grade_id);

create index if not exists assignments_group_id_idx
on public.assignments(group_id);

create index if not exists assignments_deadline_idx
on public.assignments(deadline);

-- ============================================================
-- ASSIGNMENT SUBMISSIONS
-- ============================================================

create table if not exists public.assignment_submissions (
    id uuid primary key default gen_random_uuid(),

    assignment_id uuid not null
        references public.assignments(id)
        on delete cascade,

    student_id uuid not null
        references public.student_profiles(user_id)
        on delete cascade,

    submission_number integer not null default 1,

    answer_text text,

    attachment_path text,

    status public.submission_status not null default 'pending',

    submitted_at timestamptz,

    score numeric(8,2),

    teacher_feedback text,

    graded_by uuid
        references public.profiles(id)
        on delete set null,

    graded_at timestamptz,

    created_at timestamptz not null default timezone('utc', now()),

    updated_at timestamptz not null default timezone('utc', now()),

    constraint assignment_submission_number_positive
        check (submission_number > 0),

    constraint assignment_submission_score_valid
        check (score is null or score >= 0),

    constraint assignment_submission_unique_number
        unique (assignment_id, student_id, submission_number)
);

create index if not exists assignment_submissions_student_id_idx
on public.assignment_submissions(student_id);

create index if not exists assignment_submissions_assignment_id_idx
on public.assignment_submissions(assignment_id);

-- ============================================================
-- EXAMS
-- ============================================================

create table if not exists public.exams (
    id uuid primary key default gen_random_uuid(),

    title text not null,

    description text,

    grade_id uuid
        references public.grades(id)
        on delete restrict,

    group_id uuid
        references public.groups(id)
        on delete restrict,

    duration_minutes integer not null,

    starts_at timestamptz,

    ends_at timestamptz,

    max_attempts integer not null default 1,

    max_score numeric(8,2) not null default 100,

    is_published boolean not null default false,

    created_at timestamptz not null default timezone('utc', now()),

    updated_at timestamptz not null default timezone('utc', now()),

    constraint exams_target_check
        check (
            grade_id is not null
            or group_id is not null
        ),

    constraint exams_duration_positive
        check (duration_minutes > 0),

    constraint exams_max_attempts_positive
        check (max_attempts > 0),

    constraint exams_max_score_positive
        check (max_score > 0),

    constraint exams_time_window_valid
        check (
            ends_at is null
            or starts_at is null
            or ends_at > starts_at
        )
);

create index if not exists exams_grade_id_idx
on public.exams(grade_id);

create index if not exists exams_group_id_idx
on public.exams(group_id);

create index if not exists exams_starts_at_idx
on public.exams(starts_at);

-- ============================================================
-- EXAM QUESTIONS
-- ============================================================

create table if not exists public.exam_questions (
    id uuid primary key default gen_random_uuid(),

    exam_id uuid not null
        references public.exams(id)
        on delete cascade,

    question_text text not null,

    question_type public.question_type not null,

    points numeric(8,2) not null default 1,

    display_order integer not null default 1,

    correct_answer text,

    created_at timestamptz not null default timezone('utc', now()),

    updated_at timestamptz not null default timezone('utc', now()),

    constraint exam_questions_points_positive
        check (points > 0)
);

create index if not exists exam_questions_exam_id_idx
on public.exam_questions(exam_id);

-- ============================================================
-- EXAM CHOICES
-- ============================================================

create table if not exists public.exam_choices (
    id uuid primary key default gen_random_uuid(),

    question_id uuid not null
        references public.exam_questions(id)
        on delete cascade,

    choice_text text not null,

    display_order integer not null default 1,

    is_correct boolean not null default false,

    created_at timestamptz not null default timezone('utc', now())
);

create index if not exists exam_choices_question_id_idx
on public.exam_choices(question_id);

-- ============================================================
-- EXAM ATTEMPTS
-- ============================================================

create table if not exists public.exam_attempts (
    id uuid primary key default gen_random_uuid(),

    exam_id uuid not null
        references public.exams(id)
        on delete cascade,

    student_id uuid not null
        references public.student_profiles(user_id)
        on delete cascade,

    attempt_number integer not null,

    started_at timestamptz not null,

    expires_at timestamptz not null,

    submitted_at timestamptz,

    status public.exam_attempt_status not null default 'in_progress',

    score numeric(8,2),

    created_at timestamptz not null default timezone('utc', now()),

    updated_at timestamptz not null default timezone('utc', now()),

    constraint exam_attempt_number_positive
        check (attempt_number > 0),

    constraint exam_attempt_time_valid
        check (expires_at > started_at),

    constraint exam_attempt_score_valid
        check (score is null or score >= 0),

    constraint exam_attempt_unique_number
        unique (exam_id, student_id, attempt_number)
);

create index if not exists exam_attempts_student_id_idx
on public.exam_attempts(student_id);

create index if not exists exam_attempts_exam_id_idx
on public.exam_attempts(exam_id);

create index if not exists exam_attempts_status_idx
on public.exam_attempts(status);

-- ============================================================
-- EXAM ANSWERS
-- ============================================================

create table if not exists public.exam_answers (
    id uuid primary key default gen_random_uuid(),

    attempt_id uuid not null
        references public.exam_attempts(id)
        on delete cascade,

    question_id uuid not null
        references public.exam_questions(id)
        on delete cascade,

    answer_text text,

    selected_choice_id uuid
        references public.exam_choices(id)
        on delete set null,

    points_awarded numeric(8,2),

    is_correct boolean,

    answered_at timestamptz,

    created_at timestamptz not null default timezone('utc', now()),

    updated_at timestamptz not null default timezone('utc', now()),

    constraint exam_answers_attempt_question_unique
        unique (attempt_id, question_id),

    constraint exam_answers_points_valid
        check (points_awarded is null or points_awarded >= 0)
);

create index if not exists exam_answers_attempt_id_idx
on public.exam_answers(attempt_id);

create index if not exists exam_answers_question_id_idx
on public.exam_answers(question_id);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

create table if not exists public.notifications (
    id uuid primary key default gen_random_uuid(),

    recipient_id uuid not null
        references public.profiles(id)
        on delete cascade,

    type text not null,

    title text not null,

    body text not null,

    data jsonb not null default '{}'::jsonb,

    event_key text,

    created_at timestamptz not null default timezone('utc', now()),

    read_at timestamptz
);

create unique index if not exists notifications_event_key_unique_idx
on public.notifications(recipient_id, event_key)
where event_key is not null;

create index if not exists notifications_recipient_created_idx
on public.notifications(recipient_id, created_at desc);

create index if not exists notifications_unread_idx
on public.notifications(recipient_id)
where read_at is null;

-- ============================================================
-- AUDIT LOGS
-- ============================================================

create table if not exists public.audit_logs (
    id uuid primary key default gen_random_uuid(),

    actor_id uuid
        references public.profiles(id)
        on delete set null,

    action text not null,

    entity_type text not null,

    entity_id uuid,

    metadata jsonb not null default '{}'::jsonb,

    created_at timestamptz not null default timezone('utc', now())
);

create index if not exists audit_logs_actor_id_idx
on public.audit_logs(actor_id);

create index if not exists audit_logs_entity_idx
on public.audit_logs(entity_type, entity_id);

create index if not exists audit_logs_created_at_idx
on public.audit_logs(created_at desc);

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================

drop trigger if exists profiles_updated_at on public.profiles;

create trigger profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();


drop trigger if exists student_profiles_updated_at
on public.student_profiles;

create trigger student_profiles_updated_at
before update on public.student_profiles
for each row
execute function public.set_updated_at();


drop trigger if exists admin_profiles_updated_at
on public.admin_profiles;

create trigger admin_profiles_updated_at
before update on public.admin_profiles
for each row
execute function public.set_updated_at();


drop trigger if exists stages_updated_at
on public.stages;

create trigger stages_updated_at
before update on public.stages
for each row
execute function public.set_updated_at();


drop trigger if exists grades_updated_at
on public.grades;

create trigger grades_updated_at
before update on public.grades
for each row
execute function public.set_updated_at();


drop trigger if exists groups_updated_at
on public.groups;

create trigger groups_updated_at
before update on public.groups
for each row
execute function public.set_updated_at();


drop trigger if exists courses_updated_at
on public.courses;

create trigger courses_updated_at
before update on public.courses
for each row
execute function public.set_updated_at();


drop trigger if exists chapters_updated_at
on public.chapters;

create trigger chapters_updated_at
before update on public.chapters
for each row
execute function public.set_updated_at();


drop trigger if exists lessons_updated_at
on public.lessons;

create trigger lessons_updated_at
before update on public.lessons
for each row
execute function public.set_updated_at();


drop trigger if exists schedules_updated_at
on public.schedules;

create trigger schedules_updated_at
before update on public.schedules
for each row
execute function public.set_updated_at();


drop trigger if exists sessions_updated_at
on public.sessions;

create trigger sessions_updated_at
before update on public.sessions
for each row
execute function public.set_updated_at();


drop trigger if exists video_progress_updated_at
on public.video_progress;

create trigger video_progress_updated_at
before update on public.video_progress
for each row
execute function public.set_updated_at();


drop trigger if exists assignments_updated_at
on public.assignments;

create trigger assignments_updated_at
before update on public.assignments
for each row
execute function public.set_updated_at();


drop trigger if exists assignment_submissions_updated_at
on public.assignment_submissions;

create trigger assignment_submissions_updated_at
before update on public.assignment_submissions
for each row
execute function public.set_updated_at();


drop trigger if exists exams_updated_at
on public.exams;

create trigger exams_updated_at
before update on public.exams
for each row
execute function public.set_updated_at();


drop trigger if exists exam_questions_updated_at
on public.exam_questions;

create trigger exam_questions_updated_at
before update on public.exam_questions
for each row
execute function public.set_updated_at();


drop trigger if exists exam_attempts_updated_at
on public.exam_attempts;

create trigger exam_attempts_updated_at
before update on public.exam_attempts
for each row
execute function public.set_updated_at();


drop trigger if exists exam_answers_updated_at
on public.exam_answers;

create trigger exam_answers_updated_at
before update on public.exam_answers
for each row
execute function public.set_updated_at();

-- ============================================================
-- AUTH PROFILE CREATION
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin

    insert into public.profiles (
        id,
        full_name,
        phone,
        role,
        is_active
    )
    values (
        new.id,

        coalesce(
            nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
            'طالب جديد'
        ),

        new.phone,

        'student',

        true
    )
    on conflict (id) do nothing;

    insert into public.student_profiles (
        user_id,
        status
    )
    values (
        new.id,
        'pending'
    )
    on conflict (user_id) do nothing;

    return new;
end;
$$;

drop trigger if exists on_auth_user_created
on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

-- ============================================================
-- BASIC SEED DATA
-- ============================================================

insert into public.stages (
    name,
    display_order
)
values
    ('المرحلة الثانوية', 1)
on conflict (name) do nothing;

-- ============================================================
-- COMMENTS
-- ============================================================

comment on table public.profiles is
'Base application profile linked to Supabase Auth user.';

comment on table public.student_profiles is
'Student-specific state and approval lifecycle.';

comment on table public.admin_profiles is
'Application administrators.';

comment on table public.group_members is
'Historical and current group memberships. Only one active membership is allowed per student.';

comment on table public.attendance_tokens is
'Short-lived hashed tokens used by the secure attendance flow.';

comment on table public.attendance is
'Attendance records. Unique per student and session.';

comment on table public.exam_attempts is
'Server-controlled exam attempts and timing state.';

comment on table public.audit_logs is
'Immutable application security and activity audit trail.';