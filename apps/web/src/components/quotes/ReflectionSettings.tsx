"use client";

import { useState } from "react";
import { setReflectionEnabled, type Reflection } from "@reel-and-page/shared";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

export function ReflectionSettings({
  userId,
  initialEnabled,
  reflections,
}: {
  userId: string;
  initialEnabled: boolean;
  reflections: Reflection[];
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle(next: boolean) {
    setBusy(true);
    setError(null);
    try {
      await setReflectionEnabled(supabase, userId, next);
      setEnabled(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update that setting");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
        Weekly, Reel &amp; Page can look for a recurring theme in the lines you&rsquo;ve saved and suggest one reflective question, with your
        listening time and quotes saved for the week. <strong>This is a prompt for reflection, not therapy or professional advice.</strong>
      </p>
      <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input type="checkbox" checked={enabled} disabled={busy} onChange={(e) => handleToggle(e.target.checked)} />
        Enable weekly reflection
      </label>
      {!enabled && reflections.length > 0 && (
        <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>Turning this off deleted your saved reflections.</p>
      )}
      {error && <p style={{ color: "var(--brand)" }}>{error}</p>}

      {enabled && reflections.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 6 }}>
          {reflections.map((r) => (
            <div key={r.id} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 12 }}>
              <div style={{ color: "var(--muted)", fontSize: "0.8rem" }}>
                Week of {r.week_start} · {r.quotes_count} quotes · {r.total_minutes} min
              </div>
              {r.main_theme && <div style={{ marginTop: 4 }}>Theme: {r.main_theme}</div>}
              {r.reflective_question && <div style={{ marginTop: 4, fontStyle: "italic" }}>{r.reflective_question}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
