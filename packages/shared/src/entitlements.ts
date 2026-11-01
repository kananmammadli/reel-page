import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import type { Collection, Title } from "./catalog";

type Client = SupabaseClient<Database>;

export type EntitlementRef = { titleId: string } | { collectionId: string };

// club_month entitlements exist in the schema (entitlement_kind enum) but
// club_months doesn't exist until milestone 6 -- no club-month check here yet.
export async function hasAccess(client: Client, userId: string, ref: EntitlementRef): Promise<boolean> {
  const [kind, refId] = "titleId" in ref ? (["title", ref.titleId] as const) : (["collection", ref.collectionId] as const);

  const { data, error } = await client
    .from("entitlements")
    .select("id")
    .eq("user_id", userId)
    .eq("kind", kind)
    .eq("ref_id", refId)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (data) return true;

  if (kind === "title") {
    return hasAccessViaCollection(client, userId, refId);
  }
  return false;
}

// A title can also be unlocked because the user owns a collection it's a
// member of (SPEC.md §3.4: "purchase options... collection that includes it").
async function hasAccessViaCollection(client: Client, userId: string, titleId: string): Promise<boolean> {
  const { data: memberships, error: membershipError } = await client
    .from("collection_titles")
    .select("collection_id")
    .eq("title_id", titleId);
  if (membershipError) throw membershipError;
  if (!memberships || memberships.length === 0) return false;

  const { data, error } = await client
    .from("entitlements")
    .select("id")
    .eq("user_id", userId)
    .eq("kind", "collection")
    .in(
      "ref_id",
      memberships.map((m) => m.collection_id),
    )
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

// Library screen content: titles/collections the user directly owns.
// Titles unlocked only via owning a containing collection aren't listed
// individually here -- the collection itself is (SPEC.md §3.4 "owned
// commentaries" + "collections").
export async function getOwnedTitles(client: Client, userId: string): Promise<Title[]> {
  const { data: entitlements, error } = await client.from("entitlements").select("ref_id").eq("user_id", userId).eq("kind", "title");
  if (error) throw error;
  if (!entitlements || entitlements.length === 0) return [];

  const { data, error: titlesError } = await client
    .from("titles")
    .select("*")
    .in(
      "id",
      entitlements.map((e) => e.ref_id),
    );
  if (titlesError) throw titlesError;
  return data;
}

export async function getOwnedCollections(client: Client, userId: string): Promise<Collection[]> {
  const { data: entitlements, error } = await client.from("entitlements").select("ref_id").eq("user_id", userId).eq("kind", "collection");
  if (error) throw error;
  if (!entitlements || entitlements.length === 0) return [];

  const { data, error: collectionsError } = await client
    .from("collections")
    .select("*")
    .in(
      "id",
      entitlements.map((e) => e.ref_id),
    );
  if (collectionsError) throw collectionsError;
  return data;
}
