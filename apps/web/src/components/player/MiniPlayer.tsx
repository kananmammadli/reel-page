"use client";

import { usePlayer } from "./PlayerProvider";
import styles from "./MiniPlayer.module.css";

function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function MiniPlayer() {
  const { current, playing, loading, currentTime, duration, speed, error, togglePlay, seek, skip, cycleSpeed, close } =
    usePlayer();

  if (!current) return null;

  return (
    <div className={styles.bar}>
      <div className={styles.info}>
        <span className={styles.title}>{current.title.title}</span>
        <span className={styles.sub}>
          {current.episode.name} · {formatTime(currentTime)} / {formatTime(duration)}
          {current.variant === "preview" ? " · preview" : ""}
        </span>
      </div>
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
