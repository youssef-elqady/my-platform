-- ============================================================
-- منصة أستاذ أحمد محمد رمضان
-- FIX - Align Analytics with the actual profile schema
-- ============================================================

-- The canonical student identity is:
-- profiles -> student_profiles
-- NOT public.users.

-- ============================================================
-- 1. Student identity fields used by the admin UI
-- ============================================================

alter table public.student_profiles
    add column if not exists student_code text;

alter table public.student_profiles
    add column if not exists parent_phone text;

-- Generate a stable code for existing students that do not have one.
update public.student_profiles
set student_code = 'AHD-' || upper(substr(replace(user_id::text, '-', ''), 1, 8))
where student_code is null or btrim(student_code) = '';

create unique index if not exists student_profiles_student_code_unique_idx
on public.student_profiles(student_code)
where student_code is not null;

create index if not exists student_profiles_status_idx
on public.student_profiles(status);

-- ============================================================
-- 2. Safe admin check for SECURITY DEFINER analytics functions
-- ============================================================

create or replace function public.is_active_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
    select exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and p.role = 'admin'
          and p.is_active = true
    );
$$;

revoke all on function public.is_active_admin() from public;
grant execute on function public.is_active_admin() to authenticated;

-- ============================================================
-- 3. Correct Analytics RLS policies
-- ============================================================

drop policy if exists "admins_read_all_events" on public.analytics_events;
drop policy if exists "admins_read_all_sessions" on public.analytics_sessions;
drop policy if exists "admins_read_all_video_watch" on public.analytics_video_watch;

create policy "admins_read_all_events"
on public.analytics_events
for select
to authenticated
using (public.is_active_admin());

create policy "admins_read_all_sessions"
on public.analytics_sessions
for select
to authenticated
using (public.is_active_admin());

create policy "admins_read_all_video_watch"
on public.analytics_video_watch
for select
to authenticated
using (public.is_active_admin());

-- ============================================================
-- 4. Teacher dashboard summary - schema aligned
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
    if not public.is_active_admin() then
        raise exception 'Admin access required';
    end if;

    perform public.cleanup_stale_analytics_sessions();

    select jsonb_build_object(
        'online_now', (
            select count(*)
            from public.analytics_sessions
            where is_online = true
              and last_seen_at >= now() - interval '2 minutes'
        ),
        'sessions_today', (
            select count(*)
            from public.analytics_sessions
            where started_at >= date_trunc('day', now())
        ),
        'unique_students_today', (
            select count(distinct user_id)
            from public.analytics_sessions
            where started_at >= date_trunc('day', now())
        ),
        'events_today', (
            select count(*)
            from public.analytics_events
            where created_at >= date_trunc('day', now())
        ),
        'video_views_today', (
            select count(*)
            from public.analytics_video_watch
            where created_at >= date_trunc('day', now())
        ),
        'total_watch_seconds_today', (
            select coalesce(sum(watched_seconds), 0)
            from public.analytics_video_watch
            where created_at >= date_trunc('day', now())
        ),
        'active_students_last_7_days', (
            select count(distinct user_id)
            from public.analytics_events
            where created_at >= now() - interval '7 days'
        ),
        'active_students_last_30_days', (
            select count(distinct user_id)
            from public.analytics_events
            where created_at >= now() - interval '30 days'
        )
    ) into v_result;

    return v_result;
end;
$$;

-- ============================================================
-- 5. Online students - schema aligned
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
    if not public.is_active_admin() then
        raise exception 'Admin access required';
    end if;

    perform public.cleanup_stale_analytics_sessions();

    return query
    select
        s.user_id,
        p.full_name,
        sp.student_code,
        s.id,
        s.started_at,
        s.last_seen_at,
        greatest(0, extract(epoch from (now() - s.started_at))::integer),
        s.device_type,
        s.browser,
        s.operating_system
    from public.analytics_sessions s
    join public.profiles p on p.id = s.user_id
    join public.student_profiles sp on sp.user_id = s.user_id
    where p.role = 'student'
      and s.is_online = true
      and s.last_seen_at >= now() - interval '2 minutes'
    order by s.last_seen_at desc;
end;
$$;

-- ============================================================
-- 6. Most active students - avoid row multiplication
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
        p.id as user_id,
        p.full_name,
        sp.student_code,
        coalesce((
            select count(*)
            from public.analytics_sessions s
            where s.user_id = p.id
              and s.started_at >= now() - make_interval(days => greatest(p_days, 0))
        ), 0)::bigint as sessions_count,
        coalesce((
            select sum(s.duration_seconds)
            from public.analytics_sessions s
            where s.user_id = p.id
              and s.started_at >= now() - make_interval(days => greatest(p_days, 0))
        ), 0)::bigint as total_duration_seconds,
        coalesce((
            select count(*)
            from public.analytics_events e
            where e.user_id = p.id
              and e.created_at >= now() - make_interval(days => greatest(p_days, 0))
        ), 0)::bigint as events_count,
        coalesce((
            select sum(v.watched_seconds)
            from public.analytics_video_watch v
            where v.user_id = p.id
              and v.created_at >= now() - make_interval(days => greatest(p_days, 0))
        ), 0)::bigint as video_watch_seconds
    from public.profiles p
    join public.student_profiles sp on sp.user_id = p.id
    where p.role = 'student'
    order by events_count desc, video_watch_seconds desc
    limit greatest(p_limit, 1);
$$;

-- ============================================================
-- 7. Admin-only analytics breakdowns
-- ============================================================

create or replace function public.get_analytics_event_breakdown(
    p_days integer default 7
)
returns table (
    event_type text,
    event_count bigint
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
    select e.event_type, count(*)::bigint
    from public.analytics_events e
    where e.created_at >= now() - make_interval(days => greatest(p_days, 0))
    group by e.event_type
    order by count(*) desc;
end;
$$;

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
language plpgsql
security definer
set search_path = public
as $$
begin
    if not public.is_active_admin() then
        raise exception 'Admin access required';
    end if;

    return query
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
        ),
        (
            select count(*)
            from public.analytics_sessions s
            where s.started_at >= d.activity_date
              and s.started_at < d.activity_date + interval '1 day'
        ),
        (
            select count(*)
            from public.analytics_events e
            where e.created_at >= d.activity_date
              and e.created_at < d.activity_date + interval '1 day'
        ),
        (
            select count(*)
            from public.analytics_video_watch v
            where v.created_at >= d.activity_date
              and v.created_at < d.activity_date + interval '1 day'
        ),
        (
            select coalesce(sum(v.watched_seconds), 0)
            from public.analytics_video_watch v
            where v.created_at >= d.activity_date
              and v.created_at < d.activity_date + interval '1 day'
        )
    from dates d
    order by d.activity_date;
end;
$$;

-- Keep student session/event functions available to authenticated users.
-- Keep teacher analytics functions restricted by their own admin check.

grant execute on function public.get_teacher_analytics_summary() to authenticated;
grant execute on function public.get_online_students() to authenticated;
grant execute on function public.get_most_active_students(integer,integer) to authenticated;
grant execute on function public.get_analytics_event_breakdown(integer) to authenticated;
grant execute on function public.get_daily_analytics(integer) to authenticated;
