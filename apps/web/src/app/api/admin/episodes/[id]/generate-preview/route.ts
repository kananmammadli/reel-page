import { NextResponse } from "next/server";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import ffmpegPath from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";
import ffmpeg from "fluent-ffmpeg";
import { isHost } from "@reel-and-page/shared";
import { createClient } from "@/lib/supabase/server";

// Supabase Edge Functions run on Deno, sandboxed, with no arbitrary native
// binary execution in the hosted (non-local) runtime -- ffmpeg can't run
// there. This needs a real Node process with a filesystem, so it's a
// Next.js Route Handler (which defaults to the Node runtime) instead of an
// Edge Function. See tasks.md milestone 5, item 3.
export const runtime = "nodejs";

ffmpeg.setFfmpegPath(ffmpegPath as unknown as string);
ffmpeg.setFfprobePath((ffprobeStatic as unknown as { path: string }).path);

const PREVIEW_SECONDS = 300;

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user || !(await isHost(supabase, userData.user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: episode, error: episodeError } = await supabase.from("episodes").select("audio_path").eq("id", id).maybeSingle();
  if (episodeError) return NextResponse.json({ error: episodeError.message }, { status: 500 });
  if (!episode) return NextResponse.json({ error: "Episode not found" }, { status: 404 });

  const { data: audioBlob, error: downloadError } = await supabase.storage.from("audio").download(episode.audio_path);
  if (downloadError || !audioBlob) {
    return NextResponse.json({ error: downloadError?.message ?? "Could not download the source audio" }, { status: 500 });
  }

  const tmpDir = await mkdtemp(path.join(tmpdir(), "reel-preview-"));
  const sourceExt = path.extname(episode.audio_path) || ".m4a";
  const sourcePath = path.join(tmpDir, `source${sourceExt}`);
  const previewPath = path.join(tmpDir, "preview.m4a");

  try {
    await writeFile(sourcePath, Buffer.from(await audioBlob.arrayBuffer()));

    const durationSeconds = await new Promise<number>((resolve, reject) => {
      ffmpeg.ffprobe(sourcePath, (err, data) => {
        if (err) reject(err);
        else resolve(data.format.duration ?? 0);
      });
    });

    await new Promise<void>((resolve, reject) => {
      ffmpeg(sourcePath)
        .setDuration(Math.min(PREVIEW_SECONDS, durationSeconds))
        .audioCodec("aac")
        .audioBitrate("128k")
        .output(previewPath)
        .on("end", () => resolve())
        .on("error", reject)
        .run();
    });

    const base = episode.audio_path.slice(0, episode.audio_path.length - sourceExt.length);
    const previewStoragePath = `${base}-preview.m4a`;
    const previewBuffer = await readFile(previewPath);

    const { error: uploadError } = await supabase.storage
      .from("audio")
      .upload(previewStoragePath, previewBuffer, { contentType: "audio/mp4", upsert: true });
    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

    const roundedDuration = Math.round(durationSeconds);
    const { error: updateError } = await supabase
      .from("episodes")
      .update({ preview_path: previewStoragePath, duration_s: roundedDuration })
      .eq("id", id);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

    return NextResponse.json({ preview_path: previewStoragePath, duration_s: roundedDuration });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Preview generation failed" }, { status: 500 });
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}
