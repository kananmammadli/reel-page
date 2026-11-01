"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { isHost, type TranscriptEntry } from "@reel-and-page/shared";
import { createClient } from "@/lib/supabase/server";

async function requireHost() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user || !(await isHost(supabase, userData.user.id))) {
    throw new Error("Forbidden");
  }
  return { supabase, userId: userData.user.id };
}

// Called directly from the client component (not as a <form action>) so it
// can run as one step of a multi-step upload flow -- see EpisodeForm.tsx.
export async function saveEpisode(input: {
  id?: string;
  titleId: string;
  name: string;
  position: number;
  audioPath?: string;
  transcript?: TranscriptEntry[];
}): Promise<{ id: string } | { error: string }> {
  const { supabase } = await requireHost();
  if (!input.name.trim()) return { error: "Name is required" };

  const name = input.name.trim();
  let episodeId = input.id;
  if (episodeId) {
    const { error } = await supabase
      .from("episodes")
      .update({
        title_id: input.titleId,
        name,
        position: input.position,
        ...(input.audioPath ? { audio_path: input.audioPath } : {}),
        ...(input.transcript ? { transcript: input.transcript } : {}),
      })
      .eq("id", episodeId);
    if (error) return { error: error.message };
  } else {
    if (!input.audioPath) return { error: "An audio file is required" };
    const { data, error } = await supabase
      .from("episodes")
      .insert({
        title_id: input.titleId,
        name,
        position: input.position,
        audio_path: input.audioPath,
        duration_s: 0,
        transcript: input.transcript ?? [],
      })
      .select("id")
      .single();
    if (error) return { error: error.message };
    episodeId = data.id;
  }

  revalidatePath(`/admin/titles/${input.titleId}`);
  revalidatePath(`/titles/${input.titleId}`);
  return { id: episodeId };
}

export async function deleteEpisode(id: string, titleId: string): Promise<void> {
  const { supabase } = await requireHost();
  const { error } = await supabase.from("episodes").delete().eq("id", id);
  if (error) throw error;
  revalidatePath(`/admin/titles/${titleId}`);
  revalidatePath(`/titles/${titleId}`);
  redirect(`/admin/titles/${titleId}`);
}
