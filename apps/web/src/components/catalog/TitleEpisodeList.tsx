"use client";

import { useEffect, useState } from "react";
import type { Episode, Title } from "@reel-and-page/shared";
import { usePlayer } from "@/components/player/PlayerProvider";
import { TranscriptView } from "@/components/player/TranscriptView";
import { PosterCard } from "@/components/catalog/PosterCard";
import styles from "./TitleEpisodeList.module.css";

function minutes(seconds: number): string {
  return `${Math.round(seconds / 60)} min`;
}

export function TitleEpisodeList({
  title,
  episodes,
  savedPositions = {},
  owned = false,
}: {
  title: Title;
  episodes: Episode[];
  savedPositions?: Record<string, number>;
  owned?: boolean;
}) {
  const { current, play, currentTime, didJustFinish, sleepTimer } = usePlayer();
  const [buying, setBuying] = useState(false);
  const [buyError, setBuyError] = useState<string | null>(null);

  const firstEpisode = episodes[0];
  const totalSeconds = episodes.reduce((sum, e) => sum + e.duration_s, 0);
  const playingEpisode = current?.title.id === title.id ? current.episode : null;
  const hasFullAccess = title.is_free || owned;

  function episodeAccess(episode: Episode): "full" | "preview" | "locked" {
    if (hasFullAccess) return "full";
    if (episode.id === firstEpisode?.id) return "preview";
    return "locked";
  }

  async function buy() {
    setBuyError(null);
    setBuying(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "title", refId: title.id }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Checkout failed");
      window.location.href = body.url;
    } catch (err) {
      setBuyError(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setBuying(false);
    }
  }

  function playEpisode(episode: Episode, access: "full" | "preview" | "locked") {
    const variant = access === "preview" ? "preview" : "full";
    const resumeAt = variant === "full" ? savedPositions[episode.id] : undefined;
    play(title, episode, variant, resumeAt);
  }

  // Auto-advance to the next unlocked episode (SPEC.md §3.3). Previews don't
  // advance -- ending a preview should prompt a purchase, not skip ahead.
  // The "end of episode" sleep timer also suppresses this for one ending.
  useEffect(() => {
    if (!didJustFinish || !playingEpisode || current?.variant !== "full" || sleepTimer === "end") return;
    const index = episodes.findIndex((e) => e.id === playingEpisode.id);
    const next = episodes[index + 1];
    if (!next) return;
    const access = episodeAccess(next);
    if (access === "locked") return;
    playEpisode(next, access);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- episodeAccess/playEpisode are stable for this render's inputs
  }, [didJustFinish]);

  return (
    <div>
      <div className={styles.hero}>
        <PosterCard
          id={title.id}
          title={title.title}
          year={title.year}
          type={title.type}
          posterUrl={title.poster_url}
          className={styles.heroPoster}
        />
        <h1>{title.title}</h1>
        <p className={styles.muted}>
          {title.type === "film" ? "Directed by" : "By"} {title.creator} · {title.year}
        </p>
        <p>{title.description}</p>
        <p className={styles.muted}>
          {episodes.length} {episodes.length > 1 ? "episodes" : "episode"} · {minutes(totalSeconds)}
        </p>
      </div>

      {firstEpisode && (
        <div className={styles.cta}>
          <button className={styles.btn} onClick={() => playEpisode(firstEpisode, episodeAccess(firstEpisode))}>
            {!hasFullAccess
              ? "Play 5-min preview"
              : savedPositions[firstEpisode.id]
                ? "Resume"
                : "Play"}
          </button>
        </div>
      )}

      <div className={styles.parts}>
        {episodes.map((episode, i) => {
          const access = episodeAccess(episode);
          const isPlaying = playingEpisode?.id === episode.id;
          const canResume = access === "full" && !!savedPositions[episode.id];
          return (
            <button
              key={episode.id}
              className={styles.part}
              disabled={access === "locked"}
              onClick={() => playEpisode(episode, access)}
              style={isPlaying ? { borderColor: "#8a1f2d" } : undefined}
            >
              <span className={styles.n}>{String(i + 1).padStart(2, "0")}</span>
              <span>{isPlaying ? "▶ " : ""}{episode.name}</span>
              <span className={styles.muted}>
                {access === "locked"
                  ? "Locked"
                  : access === "preview"
                    ? "Preview"
                    : canResume
                      ? "Resume"
                      : minutes(episode.duration_s)}
              </span>
            </button>
          );
        })}
      </div>

      {!hasFullAccess && (
        <div className={styles.buybox}>
          <span>Own this commentary for good</span>
          <button className={`${styles.btn} ${styles.ghost}`} onClick={buy} disabled={buying}>
            {buying ? "Starting checkout…" : "Buy to unlock"}
          </button>
          {buyError && (
            <span className={styles.muted} style={{ fontSize: "0.82rem", color: "#8a1f2d" }}>
              {buyError}
            </span>
          )}
        </div>
      )}

      {playingEpisode && playingEpisode.title_id === title.id && (
        <div className={styles.parts}>
          <TranscriptView episode={playingEpisode} currentTime={currentTime} />
        </div>
      )}
    </div>
  );
}
