"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { isHost } from "@reel-and-page/shared";
import { createClient } from "@/lib/supabase/server";

// Every action re-checks host status itself (RLS enforces the same thing
// at the DB layer, but "render-time gating is not a security boundary" --
// this is an untrusted POST endpoint regardless of what rendered the form
// that called it).
async function requireHost() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user || !(await isHost(supabase, userData.user.id))) {
    throw new Error("Forbidden");
  }
  return { supabase, userId: userData.user.id };
}

function str(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

export type ActionState = { error: string } | null;

export async function saveTitle(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireHost();

  const id = str(formData, "id");
  const yearRaw = str(formData, "year");
  const fields = {
    type: str(formData, "type") === "story" ? ("story" as const) : ("film" as const),
    title: str(formData, "title") ?? "",
    creator: str(formData, "creator") ?? "",
    year: yearRaw ? Number(yearRaw) : null,
    genre: str(formData, "genre"),
    description: str(formData, "description"),
    poster_url: str(formData, "poster_url"),
    is_free: formData.get("is_free") === "on",
    price_ref: str(formData, "price_ref"),
    published_at: formData.get("published") === "on" ? new Date().toISOString() : null,
  };

  if (!fields.title || !fields.creator) {
    return { error: "Title and creator are required" };
  }

  let titleId = id;
  if (titleId) {
    const { error } = await supabase.from("titles").update(fields).eq("id", titleId);
    if (error) throw error;
  } else {
    const { data, error } = await supabase.from("titles").insert(fields).select("id").single();
    if (error) throw error;
    titleId = data.id;
  }

  const selectedCollections = formData.getAll("collections").filter((v): v is string => typeof v === "string");
  const { error: deleteError } = await supabase.from("collection_titles").delete().eq("title_id", titleId);
  if (deleteError) throw deleteError;
  if (selectedCollections.length > 0) {
    const { error: insertError } = await supabase
      .from("collection_titles")
      .insert(selectedCollections.map((collectionId) => ({ title_id: titleId!, collection_id: collectionId })));
    if (insertError) throw insertError;
  }

  revalidatePath("/admin/titles");
  revalidatePath("/catalog");
  redirect(`/admin/titles/${titleId}`);
}

export async function deleteTitle(id: string): Promise<void> {
  const { supabase } = await requireHost();
  const { error } = await supabase.from("titles").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/admin/titles");
  revalidatePath("/catalog");
  redirect("/admin/titles");
}
