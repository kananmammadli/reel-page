"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import type { Episode, TranscriptEntry } from "@reel-and-page/shared";
import { saveEpisode } from "@/app/admin/titles/[id]/episodes/actions";
import { createClient } from "@/lib/supabase/client";
import styles from "@/app/admin/admin.module.css";

const supabase = createClient();

function isTranscriptArray(value: unknown): value is TranscriptEntry[] {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        entry && typeof entry === "object" && typeof entry.text === "string" && typeof entry.start_s === "number" && typeof entry.end_s === "number",
    )
  );
}

export function EpisodeForm({ titleId, episode, nextPosition }: { titleId: string; episode?: Episode; nextPosition: number }) {
  const router = useRouter();
  const formId = useId();

  const [name, setName] = useState(episode?.name ?? "");
  const [position, setPosition] = useState(episode?.position ?? nextPosition);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [transcriptFile, setTranscriptFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!episode && !audioFile) {
      setError("An audio file is required");
      return;
    }

    setSubmitting(true);
    try {
      let audioPath: string | undefined;
      if (audioFile) {
        setStatus("Uploading audio…");
        const ext = audioFile.name.includes(".") ? audioFile.name.slice(audioFile.name.lastIndexOf(".")) : ".m4a";
        audioPath = `${titleId}/${episode?.id ?? crypto.randomUUID()}-${Date.now()}${ext}`;
        const { error: uploadError } = await supabase.storage.from("audio").upload(audioPath, audioFile, { upsert: true });
        if (uploadError) throw uploadError;
      }

      let transcript: TranscriptEntry[] | undefined;
      if (transcriptFile) {
        setStatus("Reading transcript…");
        const parsed = JSON.parse(await transcriptFile.text());
        if (!isTranscriptArray(parsed)) {
          throw new Error('Transcript must be a JSON array of {"text", "start_s", "end_s"} objects');
        }
        transcript = parsed;
      }

      setStatus("Saving episode…");
      const result = await saveEpisode({ id: episode?.id, titleId, name, position, audioPath, transcript });
      if ("error" in result) throw new Error(result.error);

      if (audioPath) {
        setStatus("Generating preview…");
        const response = await fetch(`/api/admin/episodes/${result.id}/generate-preview`, { method: "POST" });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "Preview generation failed");
      }

      setStatus(null);
      router.push(`/admin/titles/${titleId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStatus(null);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <div className={styles.field}>
        <label htmlFor={`${formId}-name`}>Episode name</label>
        <input id={`${formId}-name`} type="text" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>

      <div className={styles.field}>
        <label htmlFor={`${formId}-position`}>Position</label>
        <input id={`${formId}-position`} type="number" min={1} value={position} onChange={(e) => setPosition(Number(e.target.value))} required />
      </div>

      <div className={styles.field}>
        <label htmlFor={`${formId}-audio`}>{episode ? "Replace audio file" : "Audio file"}</label>
        <input id={`${formId}-audio`} type="file" accept="audio/*" onChange={(e) => setAudioFile(e.target.files?.[0] ?? null)} />
        {episode?.audio_path && !audioFile && <span className={styles.hint}>Current: {episode.audio_path}</span>}
        <span className={styles.hint}>Uploading a new file regenerates the 5-minute preview automatically.</span>
      </div>

      <div className={styles.field}>
        <label htmlFor={`${formId}-transcript`}>Transcript (JSON)</label>
        <input id={`${formId}-transcript`} type="file" accept="application/json" onChange={(e) => setTranscriptFile(e.target.files?.[0] ?? null)} />
        <span className={styles.hint}>
          A JSON array of &#123;&ldquo;text&rdquo;, &ldquo;start_s&rdquo;, &ldquo;end_s&rdquo;&#125; objects, one per transcript line -- see SPEC.md §4.
          {episode && ` Current: ${episode.transcript.length} lines.`}
        </span>
      </div>

      {status && <p className={styles.hint}>{status}</p>}
      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.actions}>
        <button type="submit" className={styles.button} disabled={submitting}>
          {submitting ? "Saving…" : "Save episode"}
        </button>
      </div>
    </form>
  );
}
