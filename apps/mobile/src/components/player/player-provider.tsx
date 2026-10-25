import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { getAudioUrl, type AudioVariant, type Episode, type Title } from "@reel-and-page/shared";
import { supabase } from "@/lib/supabase";

const SPEEDS = [1, 1.25, 1.5, 2, 0.75];

type NowPlaying = { title: Title; episode: Episode; variant: AudioVariant };

type PlayerState = {
  current: NowPlaying | null;
  playing: boolean;
  loading: boolean;
  currentTime: number;
  duration: number;
  speed: number;
  error: string | null;
  play: (title: Title, episode: Episode, variant: AudioVariant) => Promise<void>;
  togglePlay: () => void;
  seek: (seconds: number) => void;
  skip: (deltaSeconds: number) => void;
  cycleSpeed: () => void;
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

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: "doNotMix",
    });
  }, []);

  const play = useCallback(
    async (title: Title, episode: Episode, variant: AudioVariant) => {
      const sameTrack = current?.episode.id === episode.id && current.variant === variant;
      if (sameTrack) {
        player.play();
        return;
      }

      setError(null);
      setLoading(true);
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
        play,
        togglePlay,
        seek,
        skip,
        cycleSpeed,
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
