"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteAccount } from "@reel-and-page/shared";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

export function DeleteAccountButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!confirm("Delete your account? This permanently removes your purchases, quotes, and club history. This cannot be undone.")) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await deleteAccount(supabase);
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete your account");
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
      <button onClick={handleDelete} disabled={busy} style={{ color: "var(--brand)" }}>
        {busy ? "Deleting…" : "Delete account"}
      </button>
      {error && <span style={{ color: "var(--brand)", fontSize: "0.85rem" }}>{error}</span>}
    </div>
  );
}
