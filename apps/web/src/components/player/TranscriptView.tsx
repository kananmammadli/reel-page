"use client";

import type { Episode } from "@reel-and-page/shared";
import styles from "./TranscriptView.module.css";

export function TranscriptView({ episode, currentTime }: { episode: Episode; currentTime: number }) {
  if (episode.transcript.length === 0) return null;

  const activeIndex = episode.transcript.findIndex(
    (entry) => currentTime >= entry.start_s && currentTime < entry.end_s,
  );

  return (
    <div className={styles.transcript}>
      <span className={styles.label}>Transcript</span>
      {episode.transcript.map((entry, i) => (
        <p key={i} className={i === activeIndex ? styles.active : undefined}>
          {entry.text}
        </p>
      ))}
    </div>
  );
}
