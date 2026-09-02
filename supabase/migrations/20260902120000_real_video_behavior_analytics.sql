-- ============================================================
-- منصة كيمياء أستاذ أحمد محمد رمضان
-- REAL VIDEO + BEHAVIOR ANALYTICS ENGINE
-- Schema-aligned to profiles/student_profiles/lessons
-- ============================================================

-- Canonical identity in this project is public.profiles.id.
-- Student-specific state lives in public.student_profiles.
-- Video lessons are public.lessons.id.

-- ============================================================
-- 1. SESSION COMPATIBILITY / SCHEMA ALIGNMENT
-- ============================================================

create table if not exists public.analytics_sessions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    device_type text,
    os text,
    browser text,
    ip_address inet,
    started_at timestamptz not null default now(),
    last_active_at timestamptz not null default now(),
    ended_at timestamptz,
    created_at timestamptz not null default now(),
    duration_seconds integer not null default 0,
    is_online boolean not null default true,
    last_seen_at timestamptz,
    operating_system text,
    ip_hash text
);

alter table public.analytics_sessions add column if not exists os text;
alter table public.analytics_sessions add column if not exists ip_address inet;
alter table public.analytics_sessions add column if not exists last_active_at timestamptz;
alter table public.analytics_sessions add column if not exists last_seen_at timestamptz;
alter table public.analytics_sessions add column if not exists operating_system text;
alter table public.analytics_sessions add column if not exists ip_hash text;

update public.analytics_sessions
set last_active_at = coalesce(last_active_at, last_seen_at, started_at, now()),
    last_seen_at = coalesce(last_seen_at, last_active_at, started_at, now()),
    os = coalesce(os, operating_system);

alter table public.analytics_sessions alter column last_active_at set default now();

-- Remove legacy FK(s) from analytics_sessions.user_id and attach the real profile FK.
do $$
declare
    r record;
begin
    if to_regclass('public.analytics_sessions') is null then
        return;
    end if;

    for r in
        select c.conname
        from pg_constraint c
        where c.conrelid = 'public.analytics_sessions'::regclass
          and c.contype = 'f'
          and c.conkey = array[(select attnum from pg_attribute where attrelid = c.conrelid and attname = 'user_id' and not attisdropped)]
    loop
        execute format('alter table public.analytics_sessions drop constraint if exists %I', r.conname);
    end loop;

    if not exists (
        select 1 from pg_constraint
        where conrelid = 'public.analytics_sessions'::regclass
          and conname = 'analytics_sessions_user_id_profiles_fkey'
    ) then
        alter table public.analytics_sessions
            add constraint analytics_sessions_user_id_profiles_fkey
            foreign key (user_id) references public.profiles(id) on delete cascade;
    end if;
end $$;

create index if not exists analytics_sessions_user_active_idx
on public.analytics_sessions(user_id, last_active_at desc);

-- ============================================================
-- 2. REQUESTED CANONICAL VIDEO TABLES
-- ============================================================

create table if not exists public.video_watch_logs (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    lesson_id uuid not null references public.lessons(id) on delete cascade,
    session_id uuid references public.analytics_sessions(id) on delete set null,
    duration_seconds integer not null default 0,
    watched_seconds integer not null default 0,
    completion_rate numeric(5,2) not null default 0,
    speed_rate numeric(4,2) not null default 1,
    tab_switches_count integer not null default 0,
    is_muted_count integer not null default 0,
    play_count integer not null default 0,
    pause_count integer not null default 0,
    seek_forward_count integer not null default 0,
    seek_backward_count integer not null default 0,
    completed boolean not null default false,
    first_started_at timestamptz,
    last_watched_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint video_watch_logs_unique_user_lesson unique (user_id, lesson_id),
    constraint video_watch_logs_duration_nonnegative check (duration_seconds >= 0),
    constraint video_watch_logs_watched_nonnegative check (watched_seconds >= 0),
    constraint video_watch_logs_completion_valid check (completion_rate between 0 and 100),
    constraint video_watch_logs_speed_valid check (speed_rate > 0),
    constraint video_watch_logs_tab_switches_valid check (tab_switches_count >= 0),
    constraint video_watch_logs_muted_valid check (is_muted_count >= 0)
);

create table if not exists public.video_segment_heatmaps (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    lesson_id uuid not null references public.lessons(id) on delete cascade,
    segment_second integer not null,
    watch_count integer not null default 0,
    updated_at timestamptz not null default now(),
    constraint video_segment_heatmaps_unique unique (user_id, lesson_id, segment_second),
    constraint video_segment_heatmaps_second_valid check (segment_second >= 0),
    constraint video_segment_heatmaps_count_valid check (watch_count >= 0)
);

create table if not exists public.video_events (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    lesson_id uuid not null references public.lessons(id) on delete cascade,
    session_id uuid references public.analytics_sessions(id) on delete set null,
    event_type text not null,
    video_timestamp integer not null default 0,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    constraint video_events_timestamp_valid check (video_timestamp >= 0),
    constraint video_events_type_valid check (
        event_type in (
            'play', 'pause', 'ended', 'seek_forward', 'seek_backward',
            'rate_change', 'tab_blur', 'tab_focus', 'mute', 'unmute'
        )
    )
);

create index if not exists video_watch_logs_user_idx
on public.video_watch_logs(user_id, last_watched_at desc);

create index if not exists video_watch_logs_lesson_idx
on public.video_watch_logs(lesson_id, completion_rate desc);

create index if not exists video_segment_heatmaps_lesson_time_idx
on public.video_segment_heatmaps(lesson_id, segment_second);

create index if not exists video_segment_heatmaps_user_lesson_idx
on public.video_segment_heatmaps(user_id, lesson_id, segment_second);

create index if not exists video_events_lesson_time_idx
on public.video_events(lesson_id, video_timestamp, created_at);

create index if not exists video_events_user_time_idx
on public.video_events(user_id, created_at desc);

-- ============================================================
-- 3. EXAM -> VIDEO DIAGNOSTIC ANCHORS
-- ============================================================

alter table public.exam_questions add column if not exists video_lesson_id uuid;
alter table public.exam_questions add column if not exists video_start_second integer;
alter table public.exam_questions add column if not exists video_end_second integer;

create index if not exists exam_questions_video_lesson_idx
on public.exam_questions(video_lesson_id);

-- Only attach the FK when the column exists and the constraint is absent.
do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conrelid = 'public.exam_questions'::regclass
          and conname = 'exam_questions_video_lesson_id_fkey'
    ) then
        alter table public.exam_questions
            add constraint exam_questions_video_lesson_id_fkey
            foreign key (video_lesson_id) references public.lessons(id) on delete set null;
    end if;
end $$;

-- ============================================================
-- 4. SECURITY
-- ============================================================

alter table public.video_watch_logs enable row level security;
alter table public.video_segment_heatmaps enable row level security;
alter table public.video_events enable row level security;

 drop policy if exists "students_read_own_video_watch_logs" on public.video_watch_logs;
 drop policy if exists "admins_read_all_video_watch_logs" on public.video_watch_logs;
 drop policy if exists "students_read_own_video_heatmaps" on public.video_segment_heatmaps;
 drop policy if exists "admins_read_all_video_heatmaps" on public.video_segment_heatmaps;
 drop policy if exists "students_read_own_video_events" on public.video_events;
 drop policy if exists "admins_read_all_video_events" on public.video_events;

create policy "students_read_own_video_watch_logs"
on public.video_watch_logs for select to authenticated
using (auth.uid() = user_id);

create policy "admins_read_all_video_watch_logs"
on public.video_watch_logs for select to authenticated
using (public.is_active_admin());

create policy "students_read_own_video_heatmaps"
on public.video_segment_heatmaps for select to authenticated
using (auth.uid() = user_id);

create policy "admins_read_all_video_heatmaps"
on public.video_segment_heatmaps for select to authenticated
using (public.is_active_admin());

create policy "students_read_own_video_events"
on public.video_events for select to authenticated
using (auth.uid() = user_id);

create policy "admins_read_all_video_events"
on public.video_events for select to authenticated
using (public.is_active_admin());

-- Writes are intentionally performed through SECURITY DEFINER RPCs so a student
-- can never choose another student's user_id.

-- ============================================================
-- 5. ATOMIC EVENT RECORDING
-- ============================================================

create or replace function public.record_video_behavior_event(
    p_lesson_id uuid,
    p_session_id uuid,
    p_event_type text,
    p_video_timestamp integer,
    p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id uuid := auth.uid();
    v_event_id uuid;
begin
    if v_user_id is null then
        raise exception 'Authentication required';
    end if;

    if not exists (select 1 from public.lessons where id = p_lesson_id) then
        raise exception 'Lesson not found';
    end if;

    if p_event_type not in (
        'play', 'pause', 'ended', 'seek_forward', 'seek_backward',
        'rate_change', 'tab_blur', 'tab_focus', 'mute', 'unmute'
    ) then
        raise exception 'Unsupported video event type';
    end if;

    insert into public.video_events (
        user_id, lesson_id, session_id, event_type, video_timestamp, metadata
    ) values (
        v_user_id,
        p_lesson_id,
        p_session_id,
        p_event_type,
        greatest(coalesce(p_video_timestamp, 0), 0),
        coalesce(p_metadata, '{}'::jsonb)
    ) returning id into v_event_id;

    return v_event_id;
end;
$$;

revoke all on function public.record_video_behavior_event(uuid, uuid, text, integer, jsonb) from public;
grant execute on function public.record_video_behavior_event(uuid, uuid, text, integer, jsonb) to authenticated;

-- ============================================================
-- 6. ATOMIC SECOND + AGGREGATE RECORDING
-- ============================================================

create or replace function public.record_video_watch_second(
    p_lesson_id uuid,
    p_session_id uuid,
    p_segment_second integer,
    p_duration_seconds integer,
    p_speed_rate numeric default 1,
    p_delta_watched_seconds integer default 1
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id uuid := auth.uid();
    v_second integer := greatest(coalesce(p_segment_second, 0), 0);
    v_duration integer := greatest(coalesce(p_duration_seconds, 0), 0);
    v_delta integer := greatest(coalesce(p_delta_watched_seconds, 1), 0);
    v_speed numeric := greatest(coalesce(p_speed_rate, 1), 0.25);
begin
    if v_user_id is null then
        raise exception 'Authentication required';
    end if;

    if not exists (select 1 from public.lessons where id = p_lesson_id) then
        raise exception 'Lesson not found';
    end if;

    insert into public.video_segment_heatmaps (
        user_id, lesson_id, segment_second, watch_count, updated_at
    ) values (
        v_user_id, p_lesson_id, v_second, 1, now()
    )
    on conflict (user_id, lesson_id, segment_second)
    do update set
        watch_count = public.video_segment_heatmaps.watch_count + 1,
        updated_at = now();

    insert into public.video_watch_logs (
        user_id,
        lesson_id,
        session_id,
        duration_seconds,
        watched_seconds,
        completion_rate,
        speed_rate,
        last_watched_at,
        updated_at
    ) values (
        v_user_id,
        p_lesson_id,
        p_session_id,
        v_duration,
        v_delta,
        case when v_duration > 0 then least(100, round(((v_second + 1)::numeric / v_duration::numeric) * 100, 2)) else 0 end,
        v_speed,
        now(),
        now()
    )
    on conflict (user_id, lesson_id)
    do update set
        session_id = excluded.session_id,
        duration_seconds = greatest(public.video_watch_logs.duration_seconds, excluded.duration_seconds),
        watched_seconds = public.video_watch_logs.watched_seconds + excluded.watched_seconds,
        completion_rate = greatest(public.video_watch_logs.completion_rate, excluded.completion_rate),
        speed_rate = round(((public.video_watch_logs.speed_rate + excluded.speed_rate) / 2), 2),
        last_watched_at = now(),
        updated_at = now();
end;
$$;

revoke all on function public.record_video_watch_second(uuid, uuid, integer, integer, numeric, integer) from public;
grant execute on function public.record_video_watch_second(uuid, uuid, integer, integer, numeric, integer) to authenticated;

-- ============================================================
-- 7. ATOMIC COUNTER UPDATE
-- ============================================================

create or replace function public.update_video_behavior_counters(
    p_lesson_id uuid,
    p_session_id uuid,
    p_play_delta integer default 0,
    p_pause_delta integer default 0,
    p_seek_forward_delta integer default 0,
    p_seek_backward_delta integer default 0,
    p_tab_switch_delta integer default 0,
    p_muted_delta integer default 0,
    p_speed_rate numeric default null,
    p_completed boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id uuid := auth.uid();
    v_play integer := greatest(coalesce(p_play_delta, 0), 0);
    v_pause integer := greatest(coalesce(p_pause_delta, 0), 0);
    v_forward integer := greatest(coalesce(p_seek_forward_delta, 0), 0);
    v_backward integer := greatest(coalesce(p_seek_backward_delta, 0), 0);
    v_tabs integer := greatest(coalesce(p_tab_switch_delta, 0), 0);
    v_muted integer := greatest(coalesce(p_muted_delta, 0), 0);
begin
    if v_user_id is null then
        raise exception 'Authentication required';
    end if;

    insert into public.video_watch_logs (
        user_id, lesson_id, session_id, play_count, pause_count,
        seek_forward_count, seek_backward_count, tab_switches_count,
        is_muted_count, speed_rate, completed, first_started_at,
        last_watched_at, updated_at
    ) values (
        v_user_id, p_lesson_id, p_session_id, v_play, v_pause,
        v_forward, v_backward, v_tabs, v_muted,
        greatest(coalesce(p_speed_rate, 1), 0.25),
        coalesce(p_completed, false),
        case when v_play > 0 then now() else null end,
        now(), now()
    )
    on conflict (user_id, lesson_id)
    do update set
        session_id = excluded.session_id,
        play_count = public.video_watch_logs.play_count + excluded.play_count,
        pause_count = public.video_watch_logs.pause_count + excluded.pause_count,
        seek_forward_count = public.video_watch_logs.seek_forward_count + excluded.seek_forward_count,
        seek_backward_count = public.video_watch_logs.seek_backward_count + excluded.seek_backward_count,
        tab_switches_count = public.video_watch_logs.tab_switches_count + excluded.tab_switches_count,
        is_muted_count = public.video_watch_logs.is_muted_count + excluded.is_muted_count,
        speed_rate = case when p_speed_rate is null then public.video_watch_logs.speed_rate else round(((public.video_watch_logs.speed_rate + excluded.speed_rate) / 2), 2) end,
        completed = public.video_watch_logs.completed or excluded.completed,
        first_started_at = coalesce(public.video_watch_logs.first_started_at, excluded.first_started_at),
        last_watched_at = now(),
        updated_at = now();
end;
$$;

revoke all on function public.update_video_behavior_counters(uuid, uuid, integer, integer, integer, integer, integer, integer, numeric, boolean) from public;
grant execute on function public.update_video_behavior_counters(uuid, uuid, integer, integer, integer, integer, integer, integer, numeric, boolean) to authenticated;

-- ============================================================
-- 8. ADMIN RPCs
-- ============================================================

create or replace function public.get_video_global_heatmap(
    p_lesson_id uuid
)
returns table (
    segment_second integer,
    watch_count bigint,
    unique_students bigint,
    replay_count bigint,
    skipped_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
    if not public.is_active_admin() then
        raise exception 'Admin access required';
    end if;

    return query
    with watched as (
        select h.segment_second,
               sum(h.watch_count)::bigint as watch_count,
               count(distinct h.user_id)::bigint as unique_students,
               sum(greatest(h.watch_count - 1, 0))::bigint as replay_count
        from public.video_segment_heatmaps h
        where h.lesson_id = p_lesson_id
        group by h.segment_second
    ), skipped as (
        select s.segment_second,
               count(*)::bigint as skipped_count
        from generate_series(
            0,
            coalesce((select max(v.duration_seconds) from public.video_watch_logs v where v.lesson_id = p_lesson_id), 0),
            1
        ) s(segment_second)
        left join public.video_events e
          on e.lesson_id = p_lesson_id
         and e.event_type = 'seek_forward'
         and s.segment_second >= greatest(0, (e.metadata ->> 'from_second')::integer)
         and s.segment_second < greatest(0, (e.metadata ->> 'to_second')::integer)
        group by s.segment_second
        having count(e.id) > 0
    )
    select coalesce(w.segment_second, s.segment_second),
           coalesce(w.watch_count, 0),
           coalesce(w.unique_students, 0),
           coalesce(w.replay_count, 0),
           coalesce(s.skipped_count, 0)
    from watched w
    full join skipped s on s.segment_second = w.segment_second
    order by coalesce(w.segment_second, s.segment_second);
end;
$$;

grant execute on function public.get_video_global_heatmap(uuid) to authenticated;

create or replace function public.get_video_performance(
    p_limit integer default 50
)
returns table (
    lesson_id uuid,
    lesson_title text,
    completion_rate numeric,
    total_watched_seconds bigint,
    total_replays bigint,
    students_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
    if not public.is_active_admin() then
        raise exception 'Admin access required';
    end if;

    return query
    select
        l.id,
        l.title,
        coalesce(round(avg(w.completion_rate), 2), 0),
        coalesce(sum(w.watched_seconds), 0)::bigint,
        coalesce(sum(w.play_count - 1) filter (where w.play_count > 1), 0)::bigint,
        count(distinct w.user_id)::bigint
    from public.lessons l
    left join public.video_watch_logs w on w.lesson_id = l.id
    group by l.id, l.title
    order by completion_rate desc, total_replays desc
    limit greatest(p_limit, 1);
end;
$$;

grant execute on function public.get_video_performance(integer) to authenticated;

-- ============================================================
-- 9. STUDENT BEHAVIOR RPC
-- ============================================================

create or replace function public.get_student_video_behavior(
    p_student_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_result jsonb;
begin
    if not public.is_active_admin() and auth.uid() <> p_student_id then
        raise exception 'Access denied';
    end if;

    select jsonb_build_object(
        'watch_seconds', coalesce(sum(watched_seconds), 0),
        'average_speed', coalesce(round(avg(speed_rate), 2), 1),
        'tab_switches', coalesce(sum(tab_switches_count), 0),
        'muted_count', coalesce(sum(is_muted_count), 0),
        'play_count', coalesce(sum(play_count), 0),
        'pause_count', coalesce(sum(pause_count), 0),
        'video_count', count(*),
        'completed_count', count(*) filter (where completed),
        'average_completion_rate', coalesce(round(avg(completion_rate), 2), 0),
        'replay_actions', coalesce(sum(greatest(play_count - 1, 0)), 0)
    ) into v_result
    from public.video_watch_logs w
    where w.user_id = p_student_id;

    return coalesce(v_result, '{}'::jsonb);
end;
$$;

grant execute on function public.get_student_video_behavior(uuid) to authenticated;

-- ============================================================
-- 10. TIMESTAMP ANCHOR CORRELATION
-- ============================================================

create or replace function public.get_student_quiz_video_correlation(
    p_student_id uuid
)
returns table (
    question_id uuid,
    exam_title text,
    question_text text,
    lesson_id uuid,
    lesson_title text,
    video_start_second integer,
    video_end_second integer,
    was_wrong boolean,
    watched_anchor boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
    if not public.is_active_admin() and auth.uid() <> p_student_id then
        raise exception 'Access denied';
    end if;

    return query
    select
        q.id,
        e.title,
        q.question_text,
        q.video_lesson_id,
        l.title,
        q.video_start_second,
        q.video_end_second,
        coalesce(a.is_correct, false) = false,
        exists (
            select 1
            from public.video_segment_heatmaps h
            where h.user_id = p_student_id
              and h.lesson_id = q.video_lesson_id
              and h.segment_second between coalesce(q.video_start_second, 0) and coalesce(q.video_end_second, q.video_start_second, 0)
              and h.watch_count > 0
        )
    from public.exam_answers a
    join public.exam_attempts at on at.id = a.attempt_id and at.student_id = p_student_id
    join public.exam_questions q on q.id = a.question_id
    join public.exams e on e.id = at.exam_id
    left join public.lessons l on l.id = q.video_lesson_id
    where a.is_correct = false
      and q.video_lesson_id is not null
    order by at.submitted_at desc nulls last, q.display_order;
end;
$$;

grant execute on function public.get_student_quiz_video_correlation(uuid) to authenticated;

-- ============================================================
-- 11. REALTIME
-- ============================================================

alter table public.video_events replica identity full;
alter table public.video_watch_logs replica identity full;

-- ============================================================
-- 12. UPDATED_AT TRIGGER
-- ============================================================

drop trigger if exists video_watch_logs_updated_at on public.video_watch_logs;
create trigger video_watch_logs_updated_at
before update on public.video_watch_logs
for each row execute function public.set_updated_at();

-- ============================================================
-- END
-- ============================================================
