"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  getAudioUrl,
  type AudioVariant,
  type Episode,
  type Title,
} from "@reel-and-page/shared";
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

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [current, setCurrent] = useState<NowPlaying | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;
    const onTime = () => setCurrentTime(audio.currentTime);
    const onLoaded = () => setDuration(audio.duration || 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => setPlaying(false);
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
  }, []);

  const play = useCallback(
    async (title: Title, episode: Episode, variant: AudioVariant) => {
      const audio = audioRef.current;
      if (!audio) return;

      const sameTrack = current?.episode.id === episode.id && current.variant === variant;
      if (sameTrack) {
        audio.play();
        return;
      }

      setError(null);
      setLoading(true);
      try {
        const url = await getAudioUrl(supabase, episode.id, variant);
        audio.src = url;
        audio.playbackRate = speed;
        setCurrent({ title, episode, variant });
        setCurrentTime(0);
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
