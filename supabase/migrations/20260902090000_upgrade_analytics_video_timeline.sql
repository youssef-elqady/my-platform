-- ============================================================
-- منصة كيمياء أستاذ أحمد محمد رمضان
-- Analytics Engine - exact video timeline
-- ============================================================

create table if not exists public.analytics_video_segments (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.users(id) on delete cascade,
    video_id uuid not null references public.lessons(id) on delete cascade,
    session_id uuid references public.analytics_sessions(id) on delete set null,
    event_type text not null default 'watch',
    start_seconds integer not null default 0,
    end_seconds integer not null default 0,
    watched_seconds integer not null default 0,
    created_at timestamptz not null default now(),

    constraint analytics_video_segments_start_nonnegative check (start_seconds >= 0),
    constraint analytics_video_segments_end_nonnegative check (end_seconds >= 0),
    constraint analytics_video_segments_watched_nonnegative check (watched_seconds >= 0),
    constraint analytics_video_segments_range_valid check (end_seconds >= start_seconds)
);

create index if not exists idx_analytics_video_segments_video_time
on public.analytics_video_segments(video_id, created_at desc);

create index if not exists idx_analytics_video_segments_user
on public.analytics_video_segments(user_id, created_at desc);

create index if not exists idx_analytics_video_segments_session
on public.analytics_video_segments(session_id, created_at desc);

alter table public.analytics_video_segments enable row level security;

drop policy if exists "students_manage_own_video_segments" on public.analytics_video_segments;
drop policy if exists "admins_read_all_video_segments" on public.analytics_video_segments;

create policy "students_manage_own_video_segments"
on public.analytics_video_segments
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "admins_read_all_video_segments"
on public.analytics_video_segments
for select
to authenticated
using (public.is_active_admin());

-- Atomic write: save an exact watched interval and update the student's aggregate.
create or replace function public.record_video_watch_segment(
    p_video_id uuid,
    p_session_id uuid,
    p_start_seconds integer,
    p_end_seconds integer,
    p_watched_seconds integer,
    p_event_type text default 'watch'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id uuid := auth.uid();
    v_watched integer := greatest(coalesce(p_watched_seconds, 0), 0);
    v_duration integer := greatest(coalesce(p_end_seconds, 0), coalesce(p_start_seconds, 0));
begin
    if v_user_id is null then
        raise exception 'Authentication required';
    end if;

    if p_video_id is null then
        raise exception 'Video id is required';
    end if;

    if p_start_seconds < 0 or p_end_seconds < p_start_seconds then
        raise exception 'Invalid video segment';
    end if;

    insert into public.analytics_video_segments (
        user_id,
        video_id,
        session_id,
        event_type,
        start_seconds,
        end_seconds,
        watched_seconds
    ) values (
        v_user_id,
        p_video_id,
        p_session_id,
        coalesce(nullif(trim(p_event_type), ''), 'watch'),
        p_start_seconds,
        p_end_seconds,
        v_watched
    );

    insert into public.analytics_video_watch (
        user_id,
        video_id,
        session_id,
        watched_seconds,
        video_duration_seconds,
        play_count,
        pause_count,
        completed,
        first_started_at,
        last_watched_at
    ) values (
        v_user_id,
        p_video_id,
        p_session_id,
        v_watched,
        v_duration,
        case when p_event_type = 'play' then 1 else 0 end,
        case when p_event_type = 'pause' then 1 else 0 end,
        false,
        now(),
        now()
    )
    on conflict (user_id, video_id)
    do update set
        watched_seconds = public.analytics_video_watch.watched_seconds + excluded.watched_seconds,
        video_duration_seconds = greatest(
            public.analytics_video_watch.video_duration_seconds,
            excluded.video_duration_seconds
        ),
        session_id = excluded.session_id,
        play_count = public.analytics_video_watch.play_count + excluded.play_count,
        pause_count = public.analytics_video_watch.pause_count + excluded.pause_count,
        last_watched_at = now();
end;
$$;

revoke all on function public.record_video_watch_segment(uuid, uuid, integer, integer, integer, text) from public;
grant execute on function public.record_video_watch_segment(uuid, uuid, integer, integer, integer, text) to authenticated;

-- Useful teacher-level timeline aggregation. A bucket represents 10 seconds.
create or replace function public.get_video_heatmap(
    p_video_id uuid,
    p_days integer default 3650
)
returns table (
    bucket_start integer,
    watch_events bigint,
    watched_seconds bigint,
    unique_students bigint,
    replay_events bigint
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
        (s.start_seconds / 10) * 10 as bucket_start,
        count(*)::bigint as watch_events,
        coalesce(sum(s.watched_seconds), 0)::bigint as watched_seconds,
        count(distinct s.user_id)::bigint as unique_students,
        count(*) filter (where s.event_type in ('rewatch', 'replay'))::bigint as replay_events
    from public.analytics_video_segments s
    where s.video_id = p_video_id
      and s.created_at >= now() - make_interval(days => greatest(p_days, 0))
    group by (s.start_seconds / 10) * 10
    order by bucket_start;
end;
$$;

grant execute on function public.get_video_heatmap(uuid, integer) to authenticated;
