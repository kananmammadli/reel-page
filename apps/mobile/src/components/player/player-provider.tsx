import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import type { AudioStatus } from "expo-audio";
import { getAudioUrl, type AudioVariant, type Episode, type Title } from "@reel-and-page/shared";
import { supabase } from "@/lib/supabase";

const SPEEDS = [1, 1.25, 1.5, 2, 0.75];
const SLEEP_TIMER_OPTIONS = [0, 15, 30, "end"] as const;

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
  // True right after the current track reaches its end, for a listener
  // (e.g. auto-advance) to react to; cleared again on the next play().
  didJustFinish: boolean;
  sleepTimer: SleepTimer;
  play: (title: Title, episode: Episode, variant: AudioVariant) => Promise<void>;
  togglePlay: () => void;
  seek: (seconds: number) => void;
  skip: (deltaSeconds: number) => void;
  cycleSpeed: () => void;
  cycleSleepTimer: () => void;
  close: () => void;
};

const PlayerContext = createContext<PlayerState | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const player = useAudioPlayer(null, { updateInterval: 500 });
  const status = useAudioPlayerStatus(player);
  const [current, setCurrent] = useState<NowPlaying | null>(null);
  const [loading, setLoading] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [didJustFinish, setDidJustFinish] = useState(false);
  const [sleepTimer, setSleepTimer] = useState<SleepTimer>(0);
  const sleepTimerRef = useRef<SleepTimer>(0);

  useEffect(() => {
    sleepTimerRef.current = sleepTimer;
  }, [sleepTimer]);

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: "doNotMix",
    });
  }, []);

  useEffect(() => {
    const subscription = player.addListener("playbackStatusUpdate", (status: AudioStatus) => {
      if (status.didJustFinish) {
        setDidJustFinish(true);
        if (sleepTimerRef.current === "end") setSleepTimer(0);
      }
    });
    return () => subscription.remove();
  }, [player]);

  useEffect(() => {
    if (typeof sleepTimer !== "number" || sleepTimer === 0) return;
    const handle = setTimeout(() => {
      player.pause();
      setSleepTimer(0);
    }, sleepTimer * 60 * 1000);
    return () => clearTimeout(handle);
  }, [sleepTimer, player]);

  const play = useCallback(
    async (title: Title, episode: Episode, variant: AudioVariant) => {
      const sameTrack = current?.episode.id === episode.id && current.variant === variant;
      if (sameTrack) {
        player.play();
        return;
      }

      setError(null);
      setLoading(true);
      setDidJustFinish(false);
      try {
        const url = await getAudioUrl(supabase, episode.id, variant);
        player.replace(url);
        player.setPlaybackRate(speed);
        setCurrent({ title, episode, variant });
        player.play();
        player.setActiveForLockScreen(true, { title: episode.name, artist: title.title });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not play this episode");
      } finally {
        setLoading(false);
      }
    },
    [current, player, speed],
  );

  const togglePlay = useCallback(() => {
    if (!current) return;
    if (status.playing) player.pause();
    else player.play();
  }, [current, player, status.playing]);

  const seek = useCallback(
    (seconds: number) => {
      player.seekTo(Math.max(0, Math.min(seconds, status.duration || seconds)));
    },
    [player, status.duration],
  );

  const skip = useCallback((deltaSeconds: number) => seek(status.currentTime + deltaSeconds), [seek, status.currentTime]);

  const cycleSpeed = useCallback(() => {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]!;
    setSpeed(next);
    player.setPlaybackRate(next);
  }, [speed, player]);

  const cycleSleepTimer = useCallback(() => {
    setSleepTimer((prev) => SLEEP_TIMER_OPTIONS[(SLEEP_TIMER_OPTIONS.indexOf(prev) + 1) % SLEEP_TIMER_OPTIONS.length]!);
  }, []);

  const close = useCallback(() => {
    player.pause();
    player.clearLockScreenControls();
    setCurrent(null);
  }, [player]);

  return (
    <PlayerContext.Provider
      value={{
        current,
        playing: status.playing,
        loading,
        currentTime: status.currentTime,
        duration: status.duration,
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
