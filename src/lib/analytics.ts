import { supabase } from './supabase';

export type AnalyticsEventType =
  | 'page_view'
  | 'login'
  | 'logout'
  | 'video_start'
  | 'video_progress'
  | 'video_pause'
  | 'video_complete'
  | 'quiz_start'
  | 'quiz_submit'
  | 'lesson_open'
  | 'lesson_complete'
  | 'button_click'
  | 'session_start'
  | 'session_end';

interface TrackEventOptions {
  userId?: string | null;
  eventType: AnalyticsEventType;
  page?: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

export async function trackEvent({
  userId,
  eventType,
  page,
  entityType,
  entityId,
  metadata = {},
}: TrackEventOptions) {
  try {
    const { error } = await supabase
      .from('analytics_events')
      .insert({
        user_id: userId ?? null,
        event_type: eventType,
        page: page ?? null,
        entity_type: entityType ?? null,
        entity_id: entityId ?? null,
        metadata,
      });

    if (error) {
      console.error('Analytics event error:', error);
    }
  } catch (error) {
    console.error('Analytics error:', error);
  }
}