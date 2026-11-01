"use client";

import { useState } from "react";
import type { ClubRelease, Episode } from "@reel-and-page/shared";
import { saveReleaseSchedule } from "@/app/admin/club/actions";
import styles from "@/app/admin/admin.module.css";

function toLocalInputValue(iso: string | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function ReleaseScheduleForm({ clubMonthId, episodes, releases }: { clubMonthId: string; episodes: Episode[]; releases: ClubRelease[] }) {
  const releaseByEpisode = new Map(releases.map((r) => [r.episode_id, r.release_at]));
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(episodes.map((e) => [e.id, toLocalInputValue(releaseByEpisode.get(e.id))])),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const schedule = episodes
        .filter((e) => values[e.id])
        .map((e) => ({ episodeId: e.id, releaseAt: new Date(values[e.id]!).toISOString() }));
      const result = await saveReleaseSchedule(clubMonthId, schedule);
      if (result.error) throw new Error(result.error);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the schedule");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.form}>
      {episodes.map((episode) => (
        <div key={episode.id} className={styles.field}>
          <label htmlFor={`release-${episode.id}`}>
            {episode.position}. {episode.name}
          </label>
          <input
            id={`release-${episode.id}`}
            type="datetime-local"
            value={values[episode.id] ?? ""}
            onChange={(e) => setValues((prev) => ({ ...prev, [episode.id]: e.target.value }))}
          />
        </div>
      ))}
      {episodes.length === 0 && <p className={styles.hint}>This title has no episodes yet.</p>}
      {error && <p className={styles.error}>{error}</p>}
      {saved && <p className={styles.hint}>Saved.</p>}
      <div className={styles.actions}>
        <button type="button" className={styles.button} onClick={handleSave} disabled={saving || episodes.length === 0}>
          {saving ? "Saving…" : "Save schedule"}
        </button>
      </div>
    </div>
  );
}
