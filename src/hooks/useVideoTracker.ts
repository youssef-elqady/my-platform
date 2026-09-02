import { useCallback, useEffect, useRef } from 'react';
import { getActiveSessionId, trackVideoEvent, trackVideoSegment } from '../lib/analytics';
import { supabase } from '../lib/supabase';

export type VideoTrackerEventType =
  | 'play'
  | 'pause'
  | 'ended'
  | 'seek_forward'
  | 'seek_backward'
  | 'rate_change'
  | 'tab_blur'
  | 'tab_focus'
  | 'mute'
  | 'unmute';

interface UseVideoTrackerOptions {
  videoId: string;
  userId: string | null | undefined;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  enabled?: boolean;
}

interface PendingSegment {
  start: number;
  end: number;
  watched: number;
}

const TRACK_INTERVAL_MS = 1000;
const MIN_SEGMENT_SECONDS = 1;

export function useVideoTracker({
  videoId,
  userId,
  videoRef,
  enabled = true,
}: UseVideoTrackerOptions): void {
  const lastTrackedSecondRef = useRef<number | null>(null);
  const segmentRef = useRef<PendingSegment | null>(null);
  const previousTimeRef = useRef(0);
  const seekingRef = useRef(false);
  const lastSeekFromRef = useRef(0);
  const lastMutedRef = useRef<boolean | null>(null);
  const lastRateRef = useRef<number | null>(null);
  const flushPromiseRef = useRef<Promise<void> | null>(null);

  const recordEvent = useCallback(
    async (
      eventType: VideoTrackerEventType,
      timestamp: number,
      metadata: Record<string, unknown> = {},
    ): Promise<void> => {
      if (!userId || !videoId) return;

      try {
        await supabase.rpc('record_video_behavior_event', {
          p_lesson_id: videoId,
          p_session_id: getActiveSessionId(),
          p_event_type: eventType,
          p_video_timestamp: Math.max(0, Math.floor(timestamp)),
          p_metadata: metadata,
        });
      } catch (error) {
        console.error('Video behavior event error:', error);
      }
    },
    [userId, videoId],
  );

  const flushSegment = useCallback(async (): Promise<void> => {
    const segment = segmentRef.current;
    if (!segment || segment.watched < MIN_SEGMENT_SECONDS || !userId || !videoId) {
      segmentRef.current = null;
      return;
    }

    segmentRef.current = null;

    const promise = trackVideoSegment({
      videoId,
      sessionId: getActiveSessionId(),
      startSeconds: segment.start,
      endSeconds: segment.end,
      watchedSeconds: segment.watched,
      eventType: 'watch',
    });

    flushPromiseRef.current = promise;
    await promise;
    if (flushPromiseRef.current === promise) flushPromiseRef.current = null;
  }, [userId, videoId]);

  const flushCurrentSecond = useCallback(async (): Promise<void> => {
    const video = videoRef.current;
    if (!video || video.paused || video.ended || seekingRef.current) return;

    const currentSecond = Math.floor(video.currentTime);
    if (lastTrackedSecondRef.current === currentSecond) return;

    lastTrackedSecondRef.current = currentSecond;
    const previousSecond = previousTimeRef.current;
    previousTimeRef.current = video.currentTime;

    if (currentSecond < 0 || currentSecond > Math.ceil(video.duration || 0)) return;

    const segment = segmentRef.current;
    if (!segment) {
      segmentRef.current = {
        start: currentSecond,
        end: currentSecond + 1,
        watched: 1,
      };
    } else if (currentSecond <= segment.end + 1 && currentSecond >= previousSecond - 1) {
      segment.end = Math.max(segment.end, currentSecond + 1);
      segment.watched += 1;
    } else {
      await flushSegment();
      segmentRef.current = {
        start: currentSecond,
        end: currentSecond + 1,
        watched: 1,
      };
    }

    try {
      await supabase.rpc('record_video_watch_second', {
        p_lesson_id: videoId,
        p_session_id: getActiveSessionId(),
        p_segment_second: currentSecond,
        p_duration_seconds: Number.isFinite(video.duration) ? Math.floor(video.duration) : 0,
        p_speed_rate: video.playbackRate,
        p_delta_watched_seconds: 1,
      });
    } catch (error) {
      console.error('Video second analytics error:', error);
    }
  }, [flushSegment, userId, videoId, videoRef]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !enabled || !userId || !videoId) return;

    let intervalId: number | null = null;

    const play = (): void => {
      previousTimeRef.current = video.currentTime;
      void recordEvent('play', video.currentTime);
      void supabase.rpc('update_video_behavior_counters', {
        p_lesson_id: videoId,
        p_session_id: getActiveSessionId(),
        p_play_delta: 1,
      });
    };

    const pause = (): void => {
      void recordEvent('pause', video.currentTime);
      void supabase.rpc('update_video_behavior_counters', {
        p_lesson_id: videoId,
        p_session_id: getActiveSessionId(),
        p_pause_delta: 1,
      });
      void flushSegment();
    };

    const ended = (): void => {
      void recordEvent('ended', video.currentTime, { duration_seconds: Math.floor(video.duration || 0) });
      void flushSegment();
      void supabase.rpc('update_video_behavior_counters', {
        p_lesson_id: videoId,
        p_session_id: getActiveSessionId(),
        p_completed: true,
      });
    };

    const seeking = (): void => {
      seekingRef.current = true;
      lastSeekFromRef.current = previousTimeRef.current;
      void flushSegment();
    };

    const seeked = (): void => {
      const from = lastSeekFromRef.current;
      const to = video.currentTime;
      const difference = to - from;
      if (Math.abs(difference) >= 1) {
        const eventType: VideoTrackerEventType = difference > 0 ? 'seek_forward' : 'seek_backward';
        void recordEvent(eventType, to, {
          from_second: Math.floor(from),
          to_second: Math.floor(to),
          delta_seconds: Math.floor(Math.abs(difference)),
        });
        void supabase.rpc('update_video_behavior_counters', {
          p_lesson_id: videoId,
          p_session_id: getActiveSessionId(),
          p_seek_forward_delta: difference > 0 ? 1 : 0,
          p_seek_backward_delta: difference < 0 ? 1 : 0,
        });
      }
      previousTimeRef.current = to;
      lastTrackedSecondRef.current = Math.floor(to) - 1;
      seekingRef.current = false;
    };

    const timeupdate = (): void => {
      previousTimeRef.current = video.currentTime;
    };

    const ratechange = (): void => {
      const rate = video.playbackRate;
      if (lastRateRef.current === rate) return;
      lastRateRef.current = rate;
      void recordEvent('rate_change', video.currentTime, { playback_rate: rate });
      void supabase.rpc('update_video_behavior_counters', {
        p_lesson_id: videoId,
        p_session_id: getActiveSessionId(),
        p_speed_rate: rate,
      });
    };

    const volumechange = (): void => {
      const muted = video.muted || video.volume === 0;
      if (lastMutedRef.current === muted) return;
      lastMutedRef.current = muted;
      const eventType: VideoTrackerEventType = muted ? 'mute' : 'unmute';
      void recordEvent(eventType, video.currentTime, { volume: video.volume });
      void supabase.rpc('update_video_behavior_counters', {
        p_lesson_id: videoId,
        p_session_id: getActiveSessionId(),
        p_muted_delta: muted ? 1 : 0,
      });
    };

    const visibilitychange = (): void => {
      if (document.visibilityState === 'hidden') {
        void recordEvent('tab_blur', video.currentTime);
        void supabase.rpc('update_video_behavior_counters', {
          p_lesson_id: videoId,
          p_session_id: getActiveSessionId(),
          p_tab_switch_delta: 1,
        });
        void flushSegment();
      } else {
        void recordEvent('tab_focus', video.currentTime);
      }
    };

    video.addEventListener('play', play);
    video.addEventListener('pause', pause);
    video.addEventListener('ended', ended);
    video.addEventListener('seeking', seeking);
    video.addEventListener('seeked', seeked);
    video.addEventListener('timeupdate', timeupdate);
    video.addEventListener('ratechange', ratechange);
    video.addEventListener('volumechange', volumechange);
    document.addEventListener('visibilitychange', visibilitychange);

    intervalId = window.setInterval(() => {
      void flushCurrentSecond();
    }, TRACK_INTERVAL_MS);

    lastMutedRef.current = video.muted || video.volume === 0;
    lastRateRef.current = video.playbackRate;
    previousTimeRef.current = video.currentTime;

    return () => {
      video.removeEventListener('play', play);
      video.removeEventListener('pause', pause);
      video.removeEventListener('ended', ended);
      video.removeEventListener('seeking', seeking);
      video.removeEventListener('seeked', seeked);
      video.removeEventListener('timeupdate', timeupdate);
      video.removeEventListener('ratechange', ratechange);
      video.removeEventListener('volumechange', volumechange);
      document.removeEventListener('visibilitychange', visibilitychange);
      if (intervalId !== null) window.clearInterval(intervalId);
      void flushSegment();
    };
  }, [enabled, flushCurrentSecond, flushSegment, recordEvent, userId, videoId, videoRef]);
}
