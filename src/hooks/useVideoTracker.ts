import type { RefObject } from 'react';
import { useCallback, useEffect, useRef } from 'react';
import { getActiveSessionId } from '../lib/analytics';
import { supabase } from '../lib/supabase';

export type VideoTrackerEventType = 'play' | 'pause' | 'ended' | 'seek_forward' | 'seek_backward' | 'rate_change' | 'tab_blur' | 'tab_focus' | 'mute' | 'unmute';

interface UseVideoTrackerOptions {
  videoId: string;
  userId: string | null | undefined;
  videoRef: RefObject<HTMLVideoElement | null>;
  enabled?: boolean;
}

const TRACK_INTERVAL_MS = 1000;

export function useVideoTracker({ videoId, userId, videoRef, enabled = true }: UseVideoTrackerOptions): void {
  const lastTrackedSecondRef = useRef<number | null>(null);
  const previousTimeRef = useRef(0);
  const seekingRef = useRef(false);
  const lastSeekFromRef = useRef(0);
  const lastMutedRef = useRef<boolean | null>(null);
  const lastRateRef = useRef<number | null>(null);

  const recordEvent = useCallback(async (eventType: VideoTrackerEventType, timestamp: number, metadata: Record<string, unknown> = {}): Promise<void> => {
    if (!userId || !videoId) return;
    const { error } = await supabase.rpc('record_video_behavior_event', {
      p_lesson_id: videoId,
      p_session_id: getActiveSessionId(),
      p_event_type: eventType,
      p_video_timestamp: Math.max(0, Math.floor(timestamp)),
      p_metadata: metadata,
    });
    if (error) console.error('Video behavior event error:', error);
  }, [userId, videoId]);

  const updateCounters = useCallback(async (values: Record<string, unknown>): Promise<void> => {
    if (!userId || !videoId) return;
    const { error } = await supabase.rpc('update_video_behavior_counters', {
      p_lesson_id: videoId,
      p_session_id: getActiveSessionId(),
      ...values,
    });
    if (error) console.error('Video behavior counter error:', error);
  }, [userId, videoId]);

  const recordCurrentSecond = useCallback(async (): Promise<void> => {
    const video = videoRef.current;
    if (!video || video.paused || video.ended || seekingRef.current) return;
    const currentSecond = Math.floor(video.currentTime);
    if (lastTrackedSecondRef.current === currentSecond) return;
    if (!Number.isFinite(currentSecond) || currentSecond < 0) return;
    lastTrackedSecondRef.current = currentSecond;
    previousTimeRef.current = video.currentTime;
    const { error } = await supabase.rpc('record_video_watch_second', {
      p_lesson_id: videoId,
      p_session_id: getActiveSessionId(),
      p_segment_second: currentSecond,
      p_duration_seconds: Number.isFinite(video.duration) ? Math.floor(video.duration) : 0,
      p_speed_rate: video.playbackRate,
      p_delta_watched_seconds: 1,
    });
    if (error) console.error('Video second analytics error:', error);
  }, [userId, videoId, videoRef]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !enabled || !userId || !videoId) return;

    const play = (): void => { previousTimeRef.current = video.currentTime; void recordEvent('play', video.currentTime); void updateCounters({ p_play_delta: 1 }); };
    const pause = (): void => { void recordEvent('pause', video.currentTime); void updateCounters({ p_pause_delta: 1 }); };
    const ended = (): void => { void recordEvent('ended', video.currentTime, { duration_seconds: Math.floor(video.duration || 0) }); void updateCounters({ p_completed: true }); };
    const seeking = (): void => { seekingRef.current = true; lastSeekFromRef.current = previousTimeRef.current; };
    const seeked = (): void => {
      const from = lastSeekFromRef.current;
      const to = video.currentTime;
      const difference = to - from;
      if (Math.abs(difference) >= 1) {
        const eventType: VideoTrackerEventType = difference > 0 ? 'seek_forward' : 'seek_backward';
        void recordEvent(eventType, to, { from_second: Math.floor(from), to_second: Math.floor(to), delta_seconds: Math.floor(Math.abs(difference)) });
        void updateCounters({ p_seek_forward_delta: difference > 0 ? 1 : 0, p_seek_backward_delta: difference < 0 ? 1 : 0 });
      }
      previousTimeRef.current = to;
      lastTrackedSecondRef.current = Math.floor(to) - 1;
      seekingRef.current = false;
    };
    const ratechange = (): void => {
      const rate = video.playbackRate;
      if (lastRateRef.current === rate) return;
      lastRateRef.current = rate;
      void recordEvent('rate_change', video.currentTime, { playback_rate: rate });
      void updateCounters({ p_speed_rate: rate });
    };
    const volumechange = (): void => {
      const muted = video.muted || video.volume === 0;
      if (lastMutedRef.current === muted) return;
      lastMutedRef.current = muted;
      void recordEvent(muted ? 'mute' : 'unmute', video.currentTime, { volume: video.volume });
      void updateCounters({ p_muted_delta: muted ? 1 : 0 });
    };
    const visibilitychange = (): void => {
      if (document.visibilityState === 'hidden') {
        void recordEvent('tab_blur', video.currentTime);
        void updateCounters({ p_tab_switch_delta: 1 });
      } else void recordEvent('tab_focus', video.currentTime);
    };

    video.addEventListener('play', play);
    video.addEventListener('pause', pause);
    video.addEventListener('ended', ended);
    video.addEventListener('seeking', seeking);
    video.addEventListener('seeked', seeked);
    video.addEventListener('ratechange', ratechange);
    video.addEventListener('volumechange', volumechange);
    document.addEventListener('visibilitychange', visibilitychange);
    const intervalId = window.setInterval(() => { void recordCurrentSecond(); }, TRACK_INTERVAL_MS);
    lastMutedRef.current = video.muted || video.volume === 0;
    lastRateRef.current = video.playbackRate;
    previousTimeRef.current = video.currentTime;

    return () => {
      video.removeEventListener('play', play);
      video.removeEventListener('pause', pause);
      video.removeEventListener('ended', ended);
      video.removeEventListener('seeking', seeking);
      video.removeEventListener('seeked', seeked);
      video.removeEventListener('ratechange', ratechange);
      video.removeEventListener('volumechange', volumechange);
      document.removeEventListener('visibilitychange', visibilitychange);
      window.clearInterval(intervalId);
    };
  }, [enabled, recordCurrentSecond, recordEvent, updateCounters, userId, videoId, videoRef]);
}
