"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { isHost } from "@reel-and-page/shared";
import { createClient } from "@/lib/supabase/server";

async function requireHost() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user || !(await isHost(supabase, userData.user.id))) {
    throw new Error("Forbidden");
  }
  return { supabase };
}

function str(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

export type ActionState = { error: string } | null;

export async function saveCollection(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireHost();

  const id = str(formData, "id");
  const name = str(formData, "name");
  const priceRef = str(formData, "price_ref");
  if (!name) return { error: "Name is required" };

  let collectionId = id;
  if (collectionId) {
    const { error } = await supabase.from("collections").update({ name, price_ref: priceRef }).eq("id", collectionId);
    if (error) return { error: error.message };
  } else {
    const { data, error } = await supabase.from("collections").insert({ name, price_ref: priceRef }).select("id").single();
    if (error) return { error: error.message };
    collectionId = data.id;
  }

  const selectedTitles = formData.getAll("titles").filter((v): v is string => typeof v === "string");
  const { error: deleteError } = await supabase.from("collection_titles").delete().eq("collection_id", collectionId);
  if (deleteError) return { error: deleteError.message };
  if (selectedTitles.length > 0) {
    const { error: insertError } = await supabase
      .from("collection_titles")
      .insert(selectedTitles.map((titleId) => ({ collection_id: collectionId!, title_id: titleId })));
    if (insertError) return { error: insertError.message };
  }

  revalidatePath("/admin/collections");
  revalidatePath("/catalog");
  redirect(`/admin/collections/${collectionId}`);
}

export async function deleteCollection(id: string): Promise<void> {
  const { supabase } = await requireHost();
  const { error } = await supabase.from("collections").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/admin/collections");
  revalidatePath("/catalog");
  redirect("/admin/collections");
}
