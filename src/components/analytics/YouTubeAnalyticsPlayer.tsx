import React, { useEffect, useRef, useState } from 'react';
import {
  getActiveSessionId,
  trackEvent,
  trackVideoEvent,
  trackVideoSegment,
} from '../../lib/analytics';

declare global {
  interface Window {
    YT?: typeof YT;
    onYouTubeIframeAPIReady?: () => void;
  }

  namespace YT {
    interface PlayerEvent {
      target: Player;
    }
    interface OnStateChangeEvent extends PlayerEvent {
      data: number;
    }
    interface PlayerOptions {
      height?: string;
      width?: string;
      videoId: string;
      playerVars?: Record<string, number | string>;
      events?: {
        onReady?: (event: PlayerEvent) => void;
        onStateChange?: (event: OnStateChangeEvent) => void;
      };
    }
    class Player {
      constructor(element: HTMLElement, options: PlayerOptions);
      getCurrentTime(): number;
      getDuration(): number;
      destroy(): void;
    }
    const PlayerState: {
      PLAYING: number;
      PAUSED: number;
      ENDED: number;
      BUFFERING: number;
      CUED: number;
    };
  }
}

let youtubeApiPromise: Promise<void> | null = null;

function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve();
  if (youtubeApiPromise) return youtubeApiPromise;

  youtubeApiPromise = new Promise((resolve) => {
    const existing = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
    if (existing) {
      window.onYouTubeIframeAPIReady = () => resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    window.onYouTubeIframeAPIReady = () => resolve();
    document.head.appendChild(script);
  });

  return youtubeApiPromise;
}

interface Props {
  videoId: string;
  userId: string;
  title?: string;
}

export default function YouTubeAnalyticsPlayer({ videoId, userId, title }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YT.Player | null>(null);
  const lastPositionRef = useRef(0);
  const lastTickRef = useRef(0);
  const isPlayingRef = useRef(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void loadYouTubeApi().then(() => {
      if (cancelled || !containerRef.current || !window.YT?.Player) return;

      playerRef.current = new window.YT.Player(containerRef.current, {
        width: '100%',
        height: '100%',
        videoId,
        playerVars: {
          playsinline: 1,
          rel: 0,
          modestbranding: 1,
        },
        events: {
          onReady: () => setReady(true),
          onStateChange: (event) => {
            const player = event.target;
            const current = player.getCurrentTime();
            const duration = player.getDuration();
            const previous = lastPositionRef.current;

            if (event.data === window.YT!.PlayerState.PLAYING) {
              isPlayingRef.current = true;
              lastTickRef.current = Date.now();
              lastPositionRef.current = current;
              void trackVideoEvent({
                userId,
                videoId,
                eventType: 'video_start',
                currentTime: current,
                duration,
              });
            }

            if (event.data === window.YT!.PlayerState.PAUSED) {
              isPlayingRef.current = false;
              const watched = Math.max(0, (current - previous));
              if (watched > 0 && watched <= 15) {
                void trackVideoSegment({
                  videoId,
                  sessionId: getActiveSessionId(),
                  startSeconds: previous,
                  endSeconds: current,
                  watchedSeconds: watched,
                });
              }
              void trackVideoEvent({
                userId,
                videoId,
                eventType: 'video_pause',
                currentTime: current,
                duration,
              });
              lastPositionRef.current = current;
            }

            if (event.data === window.YT!.PlayerState.ENDED) {
              isPlayingRef.current = false;
              void trackVideoEvent({
                userId,
                videoId,
                eventType: 'video_complete',
                currentTime: duration,
                duration,
              });
              if (duration > 0) {
                void trackVideoSegment({
                  videoId,
                  sessionId: getActiveSessionId(),
                  startSeconds: Math.max(0, duration - 5),
                  endSeconds: duration,
                  watchedSeconds: 5,
                  eventType: 'watch',
                });
              }
            }
          },
        },
      });
    });

    return () => {
      cancelled = true;
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [userId, videoId]);

  useEffect(() => {
    if (!ready) return;

    const timer = window.setInterval(() => {
      const player = playerRef.current;
      if (!player || !isPlayingRef.current) return;

      const current = player.getCurrentTime();
      const duration = player.getDuration();
      const previous = lastPositionRef.current;
      const elapsed = Math.max(0, (Date.now() - lastTickRef.current) / 1000);
      const positionDelta = current - previous;

      if (document.visibilityState !== 'visible') {
        lastPositionRef.current = current;
        lastTickRef.current = Date.now();
        return;
      }

      if (positionDelta >= -1 && positionDelta <= 8 && elapsed > 0 && elapsed <= 8) {
        void trackVideoSegment({
          videoId,
          sessionId: getActiveSessionId(),
          startSeconds: previous,
          endSeconds: current,
          watchedSeconds: Math.min(elapsed, Math.max(0, positionDelta)),
        });
      } else if (Math.abs(positionDelta) > 8) {
        void trackVideoEvent({
          userId,
          videoId,
          eventType: positionDelta < 0 ? 'video_replay' : 'video_seek',
          currentTime: current,
          duration,
          metadata: {
            from_seconds: Math.floor(previous),
            to_seconds: Math.floor(current),
            delta_seconds: Math.floor(positionDelta),
          },
        });
      }

      lastPositionRef.current = current;
      lastTickRef.current = Date.now();
    }, 5000);

    return () => window.clearInterval(timer);
  }, [ready, userId, videoId]);

  useEffect(() => {
    if (!ready) return;
    void trackEvent({
      userId,
      eventType: 'lesson_open',
      page: window.location.pathname,
      entityType: 'lesson',
      entityId: videoId,
      metadata: { title: title ?? null },
    });
  }, [ready, userId, videoId, title]);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black shadow-2xl">
      <div ref={containerRef} className="h-full w-full" />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950 text-sm text-slate-400">
          جاري تجهيز الفيديو...
        </div>
      )}
    </div>
  );
}
