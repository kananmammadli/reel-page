"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  addListeningSeconds,
  getAudioUrl,
  upsertPlaybackPosition,
  type AudioVariant,
  type Episode,
  type Title,
} from "@reel-and-page/shared";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

const SPEEDS = [1, 1.25, 1.5, 2, 0.75];
const SLEEP_TIMER_OPTIONS = [0, 15, 30, "end"] as const;
const POSITION_SYNC_INTERVAL_MS = 10_000;

type NowPlaying = { title: Title; episode: Episode; variant: AudioVariant };
export type SleepTimer = (typeof SLEEP_TIMER_OPTIONS)[number];

type PlayerState = {
  current: NowPlaying | null;
  playing: boolean;
  loading: boolean;
  currentTime: number;
  duration: number;
  speed: number;
  error: string | null;
  // True for one render after the current track reaches its end, so a
  // listener (e.g. auto-advance) can react to it, then reset on the next play().
  didJustFinish: boolean;
  sleepTimer: SleepTimer;
  play: (title: Title, episode: Episode, variant: AudioVariant, resumeAt?: number) => Promise<void>;
  togglePlay: () => void;
  seek: (seconds: number) => void;
  skip: (deltaSeconds: number) => void;
  cycleSpeed: () => void;
  cycleSleepTimer: () => void;
  close: () => void;
};

const PlayerContext = createContext<PlayerState | null>(null);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [current, setCurrent] = useState<NowPlaying | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [didJustFinish, setDidJustFinish] = useState(false);
  const [sleepTimer, setSleepTimer] = useState<SleepTimer>(0);
  const sleepTimerRef = useRef<SleepTimer>(0);
  const [userId, setUserId] = useState<string | null>(null);
  const userIdRef = useRef<string | null>(null);
  const currentRef = useRef<NowPlaying | null>(null);

  useEffect(() => {
    sleepTimerRef.current = sleepTimer;
  }, [sleepTimer]);

  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  useEffect(() => {
    currentRef.current = current;
  }, [current]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  const syncPosition = useCallback((positionS: number) => {
    const uid = userIdRef.current;
    const track = currentRef.current;
    // Resuming a preview mid-purchase-flow isn't meaningful -- only sync full playback.
    if (!uid || !track || track.variant !== "full") return;
    upsertPlaybackPosition(supabase, uid, track.episode.id, positionS).catch(() => {
      // Best-effort: a missed sync just means resume starts a little earlier next time.
    });
  }, []);

  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;
    const onTime = () => setCurrentTime(audio.currentTime);
    const onLoaded = () => setDuration(audio.duration || 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => {
      setPlaying(false);
      syncPosition(audio.currentTime);
    };
    const onEnded = () => {
      setPlaying(false);
      setDidJustFinish(true);
      if (sleepTimerRef.current === "end") setSleepTimer(0);
    };
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.pause();
    };
  }, [syncPosition]);

  const play = useCallback(
    async (title: Title, episode: Episode, variant: AudioVariant, resumeAt?: number) => {
      const audio = audioRef.current;
      if (!audio) return;

      const sameTrack = current?.episode.id === episode.id && current.variant === variant;
      if (sameTrack) {
        audio.play();
        return;
      }

      setError(null);
      setLoading(true);
      setDidJustFinish(false);
      try {
        const url = await getAudioUrl(supabase, episode.id, variant);
        audio.src = url;
        audio.playbackRate = speed;
        setCurrent({ title, episode, variant });
        setCurrentTime(resumeAt ?? 0);
        if (resumeAt) audio.currentTime = resumeAt;
        await audio.play();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not play this episode");
      } finally {
        setLoading(false);
      }
    },
    [current, speed],
  );

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !current) return;
    if (audio.paused) audio.play();
    else audio.pause();
  }, [current]);

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min(seconds, audio.duration || seconds));
  }, []);

  const skip = useCallback(
    (deltaSeconds: number) => {
      const audio = audioRef.current;
      if (!audio) return;
      seek(audio.currentTime + deltaSeconds);
    },
    [seek],
  );

  const cycleSpeed = useCallback(() => {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]!;
    setSpeed(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  }, [speed]);

  const cycleSleepTimer = useCallback(() => {
    setSleepTimer((prev) => SLEEP_TIMER_OPTIONS[(SLEEP_TIMER_OPTIONS.indexOf(prev) + 1) % SLEEP_TIMER_OPTIONS.length]!);
  }, []);

  useEffect(() => {
    if (typeof sleepTimer !== "number" || sleepTimer === 0) return;
    const handle = setTimeout(() => {
      audioRef.current?.pause();
      setSleepTimer(0);
    }, sleepTimer * 60 * 1000);
    return () => clearTimeout(handle);
  }, [sleepTimer]);

  const syncListeningTime = useCallback(() => {
    const uid = userIdRef.current;
    const track = currentRef.current;
    if (!uid || !track || track.variant !== "full") return;
    const today = new Date().toISOString().slice(0, 10);
    addListeningSeconds(supabase, today, POSITION_SYNC_INTERVAL_MS / 1000).catch(() => {
      // Best-effort: a missed tick just slightly undercounts today's minutes.
    });
  }, []);

  useEffect(() => {
    if (!playing) return;
    const handle = setInterval(() => {
      if (audioRef.current) syncPosition(audioRef.current.currentTime);
      syncListeningTime();
    }, POSITION_SYNC_INTERVAL_MS);
    return () => clearInterval(handle);
  }, [playing, syncPosition, syncListeningTime]);

  const close = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.src = "";
    }
    setCurrent(null);
    setCurrentTime(0);
    setDuration(0);
  }, []);

  return (
    <PlayerContext.Provider
      value={{
        current,
        playing,
        loading,
        currentTime,
        duration,
        speed,
        error,
        didJustFinish,
        sleepTimer,
        play,
        togglePlay,
        seek,
        skip,
        cycleSpeed,
        cycleSleepTimer,
        close,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer(): PlayerState {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within a PlayerProvider");
  return ctx;
}
