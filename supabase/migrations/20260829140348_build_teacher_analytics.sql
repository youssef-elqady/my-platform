-- ============================================================
-- منصة أستاذ أحمد محمد رمضان
-- PHASE 2 - Teacher Analytics Engine
-- ============================================================

-- ============================================================
-- INDEXES
-- ============================================================

create index if not exists analytics_sessions_online_idx
on public.analytics_sessions (is_online, last_seen_at desc);

create index if not exists analytics_sessions_user_started_idx
on public.analytics_sessions (user_id, started_at desc);

create index if not exists analytics_events_user_created_idx
on public.analytics_events (user_id, created_at desc);

create index if not exists analytics_events_type_created_idx
on public.analytics_events (event_type, created_at desc);

create index if not exists analytics_events_page_idx
on public.analytics_events (page_path);

create index if not exists analytics_video_watch_user_idx
on public.analytics_video_watch (user_id, last_watched_at desc);

create index if not exists analytics_video_watch_video_idx
on public.analytics_video_watch (video_id);

-- ============================================================
-- Mark stale sessions offline
-- A student is considered online when their last heartbeat
-- was received within the last 2 minutes.
-- ============================================================

create or replace function public.cleanup_stale_analytics_sessions()
returns void
language sql
security definer
set search_path = public
as $$
    update public.analytics_sessions
    set
        is_online = false,
        ended_at = coalesce(ended_at, last_seen_at),
        duration_seconds = greatest(
            0,
            extract(epoch from (
                coalesce(ended_at, last_seen_at) - started_at
            ))::integer
        )
    where is_online = true
      and last_seen_at < now() - interval '2 minutes';
$$;

-- ============================================================
-- START / UPDATE ANALYTICS SESSION
-- ============================================================

create or replace function public.start_analytics_session(
    p_device_type text default null,
    p_browser text default null,
    p_operating_system text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id uuid;
    v_session_id uuid;
begin
    v_user_id := auth.uid();

    if v_user_id is null then
        raise exception 'Authentication required';
    end if;

    -- Close old stale sessions for this user
    update public.analytics_sessions
    set
        is_online = false,
        ended_at = coalesce(ended_at, last_seen_at),
        duration_seconds = greatest(
            0,
            extract(epoch from (
                coalesce(ended_at, last_seen_at) - started_at
            ))::integer
        )
    where user_id = v_user_id
      and is_online = true
      and last_seen_at < now() - interval '2 minutes';

    insert into public.analytics_sessions (
        user_id,
        started_at,
        last_seen_at,
        is_online,
        device_type,
        browser,
        operating_system
    )
    values (
        v_user_id,
        now(),
        now(),
        true,
        p_device_type,
        p_browser,
        p_operating_system
    )
    returning id into v_session_id;

    insert into public.analytics_events (
        user_id,
        event_type,
        session_id,
        metadata
    )
    values (
        v_user_id,
        'session_started',
        v_session_id,
        jsonb_build_object(
            'device_type', p_device_type,
            'browser', p_browser,
            'operating_system', p_operating_system
        )
    );

    return v_session_id;
end;
$$;

-- ============================================================
-- HEARTBEAT
-- ============================================================

create or replace function public.analytics_heartbeat(
    p_session_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id uuid;
begin
    v_user_id := auth.uid();

    if v_user_id is null then
        return false;
    end if;

    update public.analytics_sessions
    set
        last_seen_at = now(),
        is_online = true,
        duration_seconds = greatest(
            0,
            extract(epoch from (
                now() - started_at
            ))::integer
        )
    where id = p_session_id
      and user_id = v_user_id
      and ended_at is null;

    return found;
end;
$$;

-- ============================================================
-- END SESSION
-- ============================================================

create or replace function public.end_analytics_session(
    p_session_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id uuid;
begin
    v_user_id := auth.uid();

    if v_user_id is null then
        return false;
    end if;

    update public.analytics_sessions
    set
        last_seen_at = now(),
        ended_at = now(),
        is_online = false,
        duration_seconds = greatest(
            0,
            extract(epoch from (
                now() - started_at
            ))::integer
        )
    where id = p_session_id
      and user_id = v_user_id
      and ended_at is null;

    return found;
end;
$$;

-- ============================================================
-- RECORD EVENT
-- ============================================================

create or replace function public.track_analytics_event(
    p_event_type text,
    p_page_path text default null,
    p_content_id uuid default null,
    p_content_type text default null,
    p_session_id uuid default null,
    p_metadata jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id uuid;
    v_event_id bigint;
begin
    v_user_id := auth.uid();

    if v_user_id is null then
        raise exception 'Authentication required';
    end if;

    insert into public.analytics_events (
        user_id,
        event_type,
        page_path,
        content_id,
        content_type,
        metadata,
        session_id
    )
    values (
        v_user_id,
        p_event_type,
        p_page_path,
        p_content_id,
        p_content_type,
        coalesce(p_metadata, '{}'::jsonb),
        p_session_id
    )
    returning id into v_event_id;

    return v_event_id;
end;
$$;

-- ============================================================
-- TEACHER DASHBOARD SUMMARY
-- ============================================================

create or replace function public.get_teacher_analytics_summary()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_result jsonb;
begin

    -- Remove stale users first
    perform public.cleanup_stale_analytics_sessions();

    select jsonb_build_object(

        'online_now',
        (
            select count(*)
            from public.analytics_sessions
            where is_online = true
              and last_seen_at >= now() - interval '2 minutes'
        ),

        'sessions_today',
        (
            select count(*)
            from public.analytics_sessions
            where started_at >= date_trunc('day', now())
        ),

        'unique_students_today',
        (
            select count(distinct user_id)
            from public.analytics_sessions
            where started_at >= date_trunc('day', now())
        ),

        'events_today',
        (
            select count(*)
            from public.analytics_events
            where created_at >= date_trunc('day', now())
        ),

        'video_views_today',
        (
            select count(*)
            from public.analytics_video_watch
            where created_at >= date_trunc('day', now())
        ),

        'total_watch_seconds_today',
        (
            select coalesce(sum(watched_seconds), 0)
            from public.analytics_video_watch
            where created_at >= date_trunc('day', now())
        ),

        'active_students_last_7_days',
        (
            select count(distinct user_id)
            from public.analytics_events
            where created_at >= now() - interval '7 days'
        ),

        'active_students_last_30_days',
        (
            select count(distinct user_id)
            from public.analytics_events
            where created_at >= now() - interval '30 days'
        )

    )
    into v_result;

    return v_result;
end;
$$;

-- ============================================================
-- ONLINE STUDENTS
-- ============================================================

create or replace function public.get_online_students()
returns table (
    user_id uuid,
    full_name text,
    student_code text,
    session_id uuid,
    started_at timestamptz,
    last_seen_at timestamptz,
    duration_seconds integer,
    device_type text,
    browser text,
    operating_system text
)
language plpgsql
security definer
set search_path = public
as $$
begin

    perform public.cleanup_stale_analytics_sessions();

    return query
    select
        s.user_id,
        u.full_name,
        u.student_code,
        s.id,
        s.started_at,
        s.last_seen_at,
        greatest(
            0,
            extract(epoch from (now() - s.started_at))::integer
        ),
        s.device_type,
        s.browser,
        s.operating_system

    from public.analytics_sessions s
    join public.users u
      on u.id = s.user_id

    where s.is_online = true
      and s.last_seen_at >= now() - interval '2 minutes'

    order by s.last_seen_at desc;

end;
$$;

-- ============================================================
-- MOST ACTIVE STUDENTS
-- ============================================================

create or replace function public.get_most_active_students(
    p_days integer default 7,
    p_limit integer default 10
)
returns table (
    user_id uuid,
    full_name text,
    student_code text,
    sessions_count bigint,
    total_duration_seconds bigint,
    events_count bigint,
    video_watch_seconds bigint
)
language sql
security definer
set search_path = public
as $$
    select
        u.id,
        u.full_name,
        u.student_code,

        count(distinct s.id) as sessions_count,

        coalesce(
            sum(distinct s.duration_seconds),
            0
        )::bigint as total_duration_seconds,

        count(distinct e.id) as events_count,

        coalesce(
            sum(v.watched_seconds),
            0
        )::bigint as video_watch_seconds

    from public.users u

    left join public.analytics_sessions s
      on s.user_id = u.id
     and s.started_at >= now() - make_interval(days => p_days)

    left join public.analytics_events e
      on e.user_id = u.id
     and e.created_at >= now() - make_interval(days => p_days)

    left join public.analytics_video_watch v
      on v.user_id = u.id
     and v.created_at >= now() - make_interval(days => p_days)

    where u.role = 'student'

    group by
        u.id,
        u.full_name,
        u.student_code

    order by
        events_count desc,
        video_watch_seconds desc

    limit greatest(p_limit, 1);
$$;

-- ============================================================
-- EVENT COUNTS
-- ============================================================

create or replace function public.get_analytics_event_breakdown(
    p_days integer default 7
)
returns table (
    event_type text,
    event_count bigint
)
language sql
security definer
set search_path = public
as $$
    select
        event_type,
        count(*) as event_count
    from public.analytics_events
    where created_at >= now() - make_interval(days => p_days)
    group by event_type
    order by event_count desc;
$$;

-- ============================================================
-- DAILY ACTIVITY
-- ============================================================

create or replace function public.get_daily_analytics(
    p_days integer default 30
)
returns table (
    activity_date date,
    unique_students bigint,
    sessions_count bigint,
    events_count bigint,
    video_views bigint,
    watch_seconds bigint
)
language sql
security definer
set search_path = public
as $$
    with dates as (
        select generate_series(
            current_date - greatest(p_days - 1, 0),
            current_date,
            interval '1 day'
        )::date as activity_date
    )

    select
        d.activity_date,

        (
            select count(distinct e.user_id)
            from public.analytics_events e
            where e.created_at >= d.activity_date
              and e.created_at < d.activity_date + interval '1 day'
        ) as unique_students,

        (
            select count(*)
            from public.analytics_sessions s
            where s.started_at >= d.activity_date
              and s.started_at < d.activity_date + interval '1 day'
        ) as sessions_count,

        (
            select count(*)
            from public.analytics_events e
            where e.created_at >= d.activity_date
              and e.created_at < d.activity_date + interval '1 day'
        ) as events_count,

        (
            select count(*)
            from public.analytics_video_watch v
            where v.created_at >= d.activity_date
              and v.created_at < d.activity_date + interval '1 day'
        ) as video_views,

        (
            select coalesce(sum(v.watched_seconds), 0)
            from public.analytics_video_watch v
            where v.created_at >= d.activity_date
              and v.created_at < d.activity_date + interval '1 day'
        ) as watch_seconds

    from dates d
    order by d.activity_date;
$$;

-- ============================================================
-- PERMISSIONS
-- ============================================================

revoke all on function public.start_analytics_session(text,text,text)
from public;

revoke all on function public.analytics_heartbeat(uuid)
from public;

revoke all on function public.end_analytics_session(uuid)
from public;

revoke all on function public.track_analytics_event(
    text,text,uuid,text,uuid,jsonb
)
from public;

grant execute on function public.start_analytics_session(text,text,text)
to authenticated;

grant execute on function public.analytics_heartbeat(uuid)
to authenticated;

grant execute on function public.end_analytics_session(uuid)
to authenticated;

grant execute on function public.track_analytics_event(
    text,text,uuid,text,uuid,jsonb
)
to authenticated;

-- Teacher dashboard functions are intentionally restricted
-- to authenticated users for now.
-- We will add the final admin-only authorization layer
-- when the admin dashboard is connected.

grant execute on function public.get_teacher_analytics_summary()
to authenticated;

grant execute on function public.get_online_students()
to authenticated;

grant execute on function public.get_most_active_students(integer,integer)
to authenticated;

grant execute on function public.get_analytics_event_breakdown(integer)
to authenticated;

grant execute on function public.get_daily_analytics(integer)
to authenticated;