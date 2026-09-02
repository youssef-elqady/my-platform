import React, { useEffect, useRef, useState } from 'react';
import { getActiveSessionId, trackEvent, trackVideoSegment, trackVideoEvent } from '../../lib/analytics';
import { supabase } from '../../lib/supabase';

declare global {
  interface Window { YT?: typeof YT; onYouTubeIframeAPIReady?: () => void; }
  namespace YT {
    interface PlayerEvent { target: Player; }
    interface OnStateChangeEvent extends PlayerEvent { data: number; }
    interface PlayerOptions { height?: string; width?: string; videoId: string; playerVars?: Record<string, number | string>; events?: { onReady?: (event: PlayerEvent) => void; onStateChange?: (event: OnStateChangeEvent) => void; }; }
    class Player { constructor(element: HTMLElement, options: PlayerOptions); getCurrentTime(): number; getDuration(): number; getPlaybackRate(): number; isMuted(): boolean; destroy(): void; }
    const PlayerState: { PLAYING: number; PAUSED: number; ENDED: number; BUFFERING: number; CUED: number; };
  }
}

let youtubeApiPromise: Promise<void> | null = null;
function loadYouTubeApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  if (youtubeApiPromise) return youtubeApiPromise;
  youtubeApiPromise = new Promise((resolve) => {
    const existing = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
    if (existing) { window.onYouTubeIframeAPIReady = () => resolve(); return; }
    const script = document.createElement('script'); script.src = 'https://www.youtube.com/iframe_api'; script.async = true;
    window.onYouTubeIframeAPIReady = () => resolve(); document.head.appendChild(script);
  });
  return youtubeApiPromise;
}

interface Props { videoId: string; userId: string; title?: string; }

export default function YouTubeAnalyticsPlayer({ videoId, userId, title }: Props): React.ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YT.Player | null>(null);
  const lastPositionRef = useRef(0);
  const lastTickRef = useRef(0);
  const isPlayingRef = useRef(false);
  const lastRateRef = useRef<number | null>(null);
  const lastMutedRef = useRef<boolean | null>(null);
  const [ready, setReady] = useState(false);

  const recordBehavior = async (eventType: string, timestamp: number, metadata: Record<string, unknown> = {}): Promise<void> => {
    const { error } = await supabase.rpc('record_video_behavior_event', {
      p_lesson_id: videoId,
      p_session_id: getActiveSessionId(),
      p_event_type: eventType,
      p_video_timestamp: Math.max(0, Math.floor(timestamp)),
      p_metadata: metadata,
    });
    if (error) console.error('YouTube behavior event error:', error);
  };

  const updateCounters = async (values: Record<string, unknown>): Promise<void> => {
    const { error } = await supabase.rpc('update_video_behavior_counters', {
      p_lesson_id: videoId,
      p_session_id: getActiveSessionId(),
      ...values,
    });
    if (error) console.error('YouTube behavior counter error:', error);
  };

  useEffect(() => {
    let cancelled = false;
    void loadYouTubeApi().then(() => {
      if (cancelled || !containerRef.current || !window.YT?.Player) return;
      playerRef.current = new window.YT.Player(containerRef.current, {
        width: '100%', height: '100%', videoId,
        playerVars: { playsinline: 1, rel: 0, modestbranding: 1 },
        events: {
          onReady: () => setReady(true),
          onStateChange: (event) => {
            const player = event.target; const current = player.getCurrentTime(); const duration = player.getDuration();
            if (event.data === window.YT!.PlayerState.PLAYING) {
              isPlayingRef.current = true; lastTickRef.current = Date.now(); lastPositionRef.current = current;
              void recordBehavior('play', current); void trackVideoEvent({ userId, videoId, eventType: 'video_start', currentTime: current, duration }); void updateCounters({ p_play_delta: 1 });
            } else if (event.data === window.YT!.PlayerState.PAUSED) {
              isPlayingRef.current = false; void recordBehavior('pause', current); void trackVideoEvent({ userId, videoId, eventType: 'video_pause', currentTime: current, duration }); void updateCounters({ p_pause_delta: 1 });
              const watched = Math.max(0, current - lastPositionRef.current);
              if (watched > 0 && watched <= 15) void trackVideoSegment({ videoId, sessionId: getActiveSessionId(), startSeconds: lastPositionRef.current, endSeconds: current, watchedSeconds: watched });
              lastPositionRef.current = current;
            } else if (event.data === window.YT!.PlayerState.ENDED) {
              isPlayingRef.current = false; void recordBehavior('ended', duration, { duration_seconds: Math.floor(duration) }); void trackVideoEvent({ userId, videoId, eventType: 'video_complete', currentTime: duration, duration }); void updateCounters({ p_completed: true });
            }
          },
        },
      });
    });
    return () => { cancelled = true; playerRef.current?.destroy(); playerRef.current = null; };
  }, [userId, videoId]);

  useEffect(() => {
    if (!ready) return;
    const timer = window.setInterval(() => {
      const player = playerRef.current; if (!player || !isPlayingRef.current) return;
      const current = player.getCurrentTime(); const duration = player.getDuration(); const previous = lastPositionRef.current;
      const elapsed = Math.max(0, (Date.now() - lastTickRef.current) / 1000); const delta = current - previous;
      if (document.visibilityState === 'visible' && delta >= -1 && delta <= 8 && elapsed > 0 && elapsed <= 8) {
        void trackVideoSegment({ videoId, sessionId: getActiveSessionId(), startSeconds: previous, endSeconds: current, watchedSeconds: Math.min(elapsed, Math.max(0, delta)) });
      } else if (Math.abs(delta) > 8) {
        const eventType = delta > 0 ? 'seek_forward' : 'seek_backward';
        void recordBehavior(eventType, current, { from_second: Math.floor(previous), to_second: Math.floor(current), delta_seconds: Math.floor(Math.abs(delta)) });
        void trackVideoEvent({ userId, videoId, eventType: delta < 0 ? 'video_replay' : 'video_seek', currentTime: current, duration, metadata: { from_seconds: Math.floor(previous), to_seconds: Math.floor(current), delta_seconds: Math.floor(delta) } });
        void updateCounters({ p_seek_forward_delta: delta > 0 ? 1 : 0, p_seek_backward_delta: delta < 0 ? 1 : 0 });
      }
      const rate = player.getPlaybackRate();
      if (lastRateRef.current !== null && rate !== lastRateRef.current) { void recordBehavior('rate_change', current, { playback_rate: rate }); void updateCounters({ p_speed_rate: rate }); }
      lastRateRef.current = rate;
      const muted = player.isMuted();
      if (lastMutedRef.current !== null && muted !== lastMutedRef.current) { void recordBehavior(muted ? 'mute' : 'unmute', current); void updateCounters({ p_muted_delta: muted ? 1 : 0 }); }
      lastMutedRef.current = muted;
      lastPositionRef.current = current; lastTickRef.current = Date.now();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [ready, userId, videoId]);

  useEffect(() => {
    if (!ready) return;
    void trackEvent({ userId, eventType: 'lesson_open', page: window.location.pathname, entityType: 'lesson', entityId: videoId, metadata: { title: title ?? null } });
    const onVisibility = (): void => { const player = playerRef.current; if (!player) return; const current = player.getCurrentTime(); if (document.visibilityState === 'hidden') { void recordBehavior('tab_blur', current); void updateCounters({ p_tab_switch_delta: 1 }); } else void recordBehavior('tab_focus', current); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [ready, userId, videoId, title]);

  return <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black shadow-2xl"><div ref={containerRef} className="h-full w-full" />{!ready && <div className="absolute inset-0 flex items-center justify-center bg-slate-950 text-sm text-slate-400">جاري تجهيز الفيديو...</div>}</div>;
}
