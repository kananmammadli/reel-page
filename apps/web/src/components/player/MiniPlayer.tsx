"use client";

import { useEffect, useState } from "react";
import { getActiveTranscriptEntry, saveQuote } from "@reel-and-page/shared";
import { createClient } from "@/lib/supabase/client";
import { usePlayer } from "./PlayerProvider";
import styles from "./MiniPlayer.module.css";

const supabase = createClient();

function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function MiniPlayer() {
  const {
    current,
    playing,
    loading,
    currentTime,
    duration,
    speed,
    sleepTimer,
    error,
    togglePlay,
    seek,
    skip,
    cycleSpeed,
    cycleSleepTimer,
    close,
  } = usePlayer();

  const [userId, setUserId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => setUserId(session?.user?.id ?? null));
    return () => subscription.subscription.unsubscribe();
  }, []);

  if (!current) return null;

  const activeLine = getActiveTranscriptEntry(current.episode.transcript, currentTime);

  async function saveCurrentQuote() {
    if (!userId || !activeLine) return;
    try {
      await saveQuote(supabase, { userId, episodeId: current!.episode.id, text: activeLine.text, atS: activeLine.start_s });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch {
      // Best-effort -- the pen button isn't worth a visible error state for one failed save.
    }
  }

  return (
    <div className={styles.bar}>
      <div className={styles.info}>
        <span className={styles.title}>{current.title.title}</span>
        <span className={styles.sub}>
          {current.episode.name} · {formatTime(currentTime)} / {formatTime(duration)}
          {current.variant === "preview" ? " · preview" : ""}
        </span>
      </div>
      {userId && (
        <button className={styles.btn} onClick={saveCurrentQuote} disabled={!activeLine} aria-label="Save this line as a quote" title={activeLine?.text}>
          {saved ? "✓" : "✎"}
        </button>
      )}
      <button className={styles.btn} onClick={() => skip(-15)} aria-label="Back 15 seconds">
        −15
      </button>
      <button
        className={`${styles.btn} ${styles.main}`}
        onClick={togglePlay}
        disabled={loading}
        aria-label={playing ? "Pause" : "Play"}
      >
        {loading ? "…" : playing ? "❚❚" : "▶"}
      </button>
      <button className={styles.btn} onClick={() => skip(30)} aria-label="Forward 30 seconds">
        +30
      </button>
      <button className={styles.btn} onClick={cycleSpeed} aria-label="Playback speed">
        {speed}×
      </button>
      <button className={styles.btn} onClick={cycleSleepTimer} aria-label="Sleep timer">
        {sleepTimer === 0 ? "😴" : sleepTimer === "end" ? "end" : `${sleepTimer}m`}
      </button>
      <input
        className={styles.scrub}
        type="range"
        min={0}
        max={duration || 0}
        step={1}
        value={currentTime}
        onChange={(e) => seek(Number(e.target.value))}
        aria-label="Seek"
      />
      {error && (
        <span className={styles.error}>
          {error} <button onClick={close}>Close</button>
        </span>
      )}
    </div>
  );
}
