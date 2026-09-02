import { supabase } from './supabase';

export type AnalyticsEventType =
  | 'page_view'
  | 'login'
  | 'logout'
  | 'video_start'
  | 'video_progress'
  | 'video_pause'
  | 'video_complete'
  | 'video_seek'
  | 'video_replay'
  | 'quiz_start'
  | 'quiz_submit'
  | 'lesson_open'
  | 'lesson_complete'
  | 'button_click'
  | 'session_start'
  | 'session_end';

export type DeviceType = 'mobile' | 'tablet' | 'desktop' | 'unknown';

interface TrackEventOptions {
  userId?: string | null;
  sessionId?: string | null;
  eventType: AnalyticsEventType;
  page?: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

function getUserAgent() {
  return typeof navigator === 'undefined' ? '' : navigator.userAgent;
}

export function detectDeviceType(): DeviceType {
  const ua = getUserAgent().toLowerCase();

  if (/ipad|tablet|playbook|silk/.test(ua)) return 'tablet';
  if (/mobi|android|iphone|ipod|windows phone/.test(ua)) return 'mobile';
  if (ua) return 'desktop';
  return 'unknown';
}

export function detectBrowser() {
  const ua = getUserAgent();
  if (/Edg\//.test(ua)) return 'Edge';
  if (/OPR\//.test(ua)) return 'Opera';
  if (/Chrome\//.test(ua)) return 'Chrome';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return 'Safari';
  return 'Other';
}

export function detectOperatingSystem() {
  const ua = getUserAgent();
  if (/Windows NT/.test(ua)) return 'Windows';
  if (/Android/.test(ua)) return 'Android';
  if (/iPhone|iPad|iPod/.test(ua)) return 'iOS';
  if (/Mac OS X/.test(ua)) return 'macOS';
  if (/Linux/.test(ua)) return 'Linux';
  return 'Other';
}

let activeSessionId: string | null = null;
let heartbeatTimer: number | null = null;

export function getActiveSessionId() {
  return activeSessionId;
}

export async function startAnalyticsSession(userId: string) {
  if (activeSessionId) return activeSessionId;

  const { data, error } = await supabase
    .from('analytics_sessions')
    .insert({
      user_id: userId,
      device_type: detectDeviceType(),
      browser: detectBrowser(),
      operating_system: detectOperatingSystem(),
      is_online: true,
      last_seen_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    console.error('Analytics session start error:', error);
    return null;
  }

  activeSessionId = data.id;
  await trackEvent({
    userId,
    sessionId: activeSessionId,
    eventType: 'session_start',
    page: window.location.pathname,
    metadata: {
      device_type: detectDeviceType(),
      browser: detectBrowser(),
      operating_system: detectOperatingSystem(),
    },
  });

  heartbeatTimer = window.setInterval(() => {
    void heartbeatAnalyticsSession();
  }, 30_000);

  return activeSessionId;
}

export async function heartbeatAnalyticsSession() {
  if (!activeSessionId) return;

  const { error } = await supabase
    .from('analytics_sessions')
    .update({
      last_seen_at: new Date().toISOString(),
      is_online: true,
    })
    .eq('id', activeSessionId);

  if (error) console.error('Analytics heartbeat error:', error);
}

export async function endAnalyticsSession(userId?: string | null) {
  if (!activeSessionId) return;

  const sessionId = activeSessionId;
  activeSessionId = null;

  if (heartbeatTimer) {
    window.clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }

  const { data } = await supabase
    .from('analytics_sessions')
    .select('started_at')
    .eq('id', sessionId)
    .maybeSingle();

  const durationSeconds = data?.started_at
    ? Math.max(
        0,
        Math.floor(
          (Date.now() - new Date(data.started_at).getTime()) / 1000
        )
      )
    : 0;

  await supabase
    .from('analytics_sessions')
    .update({
      ended_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
      duration_seconds: durationSeconds,
      is_online: false,
    })
    .eq('id', sessionId);

  if (userId) {
    await trackEvent({
      userId,
      sessionId,
      eventType: 'session_end',
      page: window.location.pathname,
      metadata: { duration_seconds: durationSeconds },
    });
  }
}

export async function trackEvent({
  userId,
  sessionId,
  eventType,
  page,
  entityType,
  entityId,
  metadata = {},
}: TrackEventOptions) {
  try {
    const { error } = await supabase.from('analytics_events').insert({
      user_id: userId ?? null,
      event_type: eventType,
      page_path: page ?? null,
      content_id: entityId ?? null,
      content_type: entityType ?? null,
      session_id: sessionId ?? activeSessionId,
      metadata,
    });

    if (error) console.error('Analytics event error:', error);
  } catch (error) {
    console.error('Analytics error:', error);
  }
}

export async function trackVideoSegment({
  videoId,
  sessionId,
  startSeconds,
  endSeconds,
  watchedSeconds,
  eventType = 'watch',
}: {
  videoId: string;
  sessionId?: string | null;
  startSeconds: number;
  endSeconds: number;
  watchedSeconds: number;
  eventType?: string;
}) {
  const { error } = await supabase.rpc('record_video_watch_segment', {
    p_video_id: videoId,
    p_session_id: sessionId ?? activeSessionId,
    p_start_seconds: Math.max(0, Math.floor(startSeconds)),
    p_end_seconds: Math.max(0, Math.floor(endSeconds)),
    p_watched_seconds: Math.max(0, Math.floor(watchedSeconds)),
    p_event_type: eventType,
  });

  if (error) console.error('Video segment analytics error:', error);
}

export async function trackVideoEvent({
  userId,
  videoId,
  eventType,
  currentTime,
  duration,
  metadata = {},
}: {
  userId: string;
  videoId: string;
  eventType: Extract<AnalyticsEventType, 'video_start' | 'video_pause' | 'video_complete' | 'video_seek' | 'video_replay'>;
  currentTime: number;
  duration: number;
  metadata?: Record<string, unknown>;
}) {
  await trackEvent({
    userId,
    eventType,
    entityType: 'lesson',
    entityId: videoId,
    metadata: {
      current_time_seconds: Math.floor(currentTime),
      duration_seconds: Math.floor(duration),
      ...metadata,
    },
  });
}
