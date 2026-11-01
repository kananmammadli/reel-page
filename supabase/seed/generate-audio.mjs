#!/usr/bin/env node
// Local-dev-only tool: synthesizes placeholder spoken-word audio for every
// seeded episode (via macOS's built-in `say` + `afconvert`) and uploads it
// to the local Supabase Storage 'audio' bucket at the path seed.sql already
// assigned to that episode (<episode_id>/full.m4a and /preview.m4a).
//
// Run after `supabase db reset` (or `supabase start`):
//   pnpm seed:audio
//
// macOS only. Not used in CI, not used against a real project — these are
// throwaway dev fixtures, not production content.
//
// Seed content is Russian (SPEC.md: content language is Russian), so this
// uses macOS's ru_RU voice. Check available voices with `say -v '?'`.

import { createClient } from "@supabase/supabase-js";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

if (process.platform !== "darwin") {
  console.error("generate-audio.mjs uses macOS's `say`/`afconvert` and only runs on macOS.");
  process.exit(1);
}

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
const VOICE = "Milena"; // ru_RU

function synthesize(text, outPath) {
  const dir = mkdtempSync(join(tmpdir(), "rp-audio-"));
  const aiff = join(dir, "speech.aiff");
  const say = spawnSync("say", ["-v", VOICE, "-o", aiff, text], { stdio: "inherit" });
  if (say.status !== 0) throw new Error("say failed");
  const convert = spawnSync("afconvert", ["-f", "m4af", "-d", "aac", aiff, outPath], {
    stdio: "inherit",
  });
  if (convert.status !== 0) throw new Error("afconvert failed");
  rmSync(dir, { recursive: true, force: true });
}

async function uploadEpisodeAudio(episode) {
  const transcript = episode.transcript ?? [];
  const fullText = transcript.map((entry) => entry.text).join(" ");
  const previewText = transcript[0]?.text ?? episode.name;

  const dir = mkdtempSync(join(tmpdir(), "rp-upload-"));
  const fullPath = join(dir, "full.m4a");
  const previewPath = join(dir, "preview.m4a");

  console.log(`Synthesizing "${episode.name}"...`);
  synthesize(fullText || episode.name, fullPath);
  synthesize(previewText, previewPath);

  const uploads = [
    supabase.storage
      .from("audio")
      .upload(episode.audio_path, readFileSync(fullPath), { contentType: "audio/mp4", upsert: true }),
    supabase.storage
      .from("audio")
      .upload(episode.preview_path, readFileSync(previewPath), {
        contentType: "audio/mp4",
        upsert: true,
      }),
  ];
  for (const result of await Promise.all(uploads)) {
    if (result.error) throw result.error;
  }

  rmSync(dir, { recursive: true, force: true });
}

async function main() {
  const { data: episodes, error } = await supabase
    .from("episodes")
    .select("id, name, audio_path, preview_path, transcript");
  if (error) throw error;

  console.log(`Generating audio for ${episodes.length} episodes...`);
  for (const episode of episodes) {
    await uploadEpisodeAudio(episode);
  }
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
