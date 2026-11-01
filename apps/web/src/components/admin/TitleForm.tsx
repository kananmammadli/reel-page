"use client";

import { useActionState, useId, useState } from "react";
import { saveTitle, type ActionState } from "@/app/admin/titles/actions";
import { createClient } from "@/lib/supabase/client";
import styles from "@/app/admin/admin.module.css";
import type { Collection, Title } from "@reel-and-page/shared";

const supabase = createClient();

export function TitleForm({
  title,
  collections,
  selectedCollectionIds,
}: {
  title?: Title;
  collections: Collection[];
  selectedCollectionIds?: string[];
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(saveTitle, null);
  const [posterUrl, setPosterUrl] = useState(title?.poster_url ?? "");
  const [posterError, setPosterError] = useState<string | null>(null);
  const [uploadingPoster, setUploadingPoster] = useState(false);
  const formId = useId();

  async function handlePosterChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setPosterError(null);
    setUploadingPoster(true);
    try {
      const path = `${crypto.randomUUID()}-${file.name}`;
      const { error } = await supabase.storage.from("posters").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("posters").getPublicUrl(path);
      setPosterUrl(data.publicUrl);
    } catch (err) {
      setPosterError(err instanceof Error ? err.message : "Poster upload failed");
    } finally {
      setUploadingPoster(false);
    }
  }

  return (
    <form action={formAction} className={styles.form}>
      <input type="hidden" name="id" value={title?.id ?? ""} />
      <input type="hidden" name="poster_url" value={posterUrl} />

      <div className={styles.field}>
        <label htmlFor={`${formId}-type`}>Type</label>
        <select id={`${formId}-type`} name="type" defaultValue={title?.type ?? "film"}>
          <option value="film">Film</option>
          <option value="story">Story</option>
        </select>
      </div>

      <div className={styles.field}>
        <label htmlFor={`${formId}-title`}>Title</label>
        <input id={`${formId}-title`} type="text" name="title" defaultValue={title?.title} required />
      </div>

      <div className={styles.field}>
        <label htmlFor={`${formId}-creator`}>Director / author</label>
        <input id={`${formId}-creator`} type="text" name="creator" defaultValue={title?.creator} required />
      </div>

      <div className={styles.field}>
        <label htmlFor={`${formId}-year`}>Year</label>
        <input id={`${formId}-year`} type="number" name="year" defaultValue={title?.year ?? undefined} />
      </div>

      <div className={styles.field}>
        <label htmlFor={`${formId}-genre`}>Genre</label>
        <input id={`${formId}-genre`} type="text" name="genre" defaultValue={title?.genre ?? undefined} />
      </div>

      <div className={styles.field}>
        <label htmlFor={`${formId}-description`}>Description</label>
        <textarea id={`${formId}-description`} name="description" rows={4} defaultValue={title?.description ?? undefined} />
      </div>

      <div className={styles.field}>
        <label htmlFor={`${formId}-poster`}>Poster image</label>
        <input id={`${formId}-poster`} type="file" accept="image/*" onChange={handlePosterChange} />
        {uploadingPoster && <span className={styles.hint}>Uploading…</span>}
        {posterUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- just-uploaded preview, size varies
          <img src={posterUrl} alt="Poster preview" style={{ width: 80, borderRadius: 6, marginTop: 6 }} />
        )}
        {posterError && <span className={styles.error}>{posterError}</span>}
      </div>

      <div className={styles.field}>
        <label htmlFor={`${formId}-price_ref`}>Stripe/RevenueCat price id</label>
        <input id={`${formId}-price_ref`} type="text" name="price_ref" defaultValue={title?.price_ref ?? undefined} placeholder="price_..." />
        <span className={styles.hint}>Leave blank until real pricing exists -- &ldquo;Buy to unlock&rdquo; stays disabled until this is set.</span>
      </div>

      <div className={styles.checkboxRow}>
        <input id={`${formId}-is_free`} type="checkbox" name="is_free" defaultChecked={title?.is_free ?? false} />
        <label htmlFor={`${formId}-is_free`}>Free (no purchase required)</label>
      </div>

      <div className={styles.checkboxRow}>
        <input id={`${formId}-published`} type="checkbox" name="published" defaultChecked={!!title?.published_at} />
        <label htmlFor={`${formId}-published`}>Published (visible in the public catalog)</label>
      </div>

      {collections.length > 0 && (
        <div className={styles.field}>
          <label>Collections</label>
          {collections.map((collection) => (
            <div key={collection.id} className={styles.checkboxRow}>
              <input
                id={`${formId}-collection-${collection.id}`}
                type="checkbox"
                name="collections"
                value={collection.id}
                defaultChecked={selectedCollectionIds?.includes(collection.id) ?? false}
              />
              <label htmlFor={`${formId}-collection-${collection.id}`}>{collection.name}</label>
            </div>
          ))}
        </div>
      )}

      {state?.error && <p className={styles.error}>{state.error}</p>}

      <div className={styles.actions}>
        <button type="submit" className={styles.button} disabled={pending || uploadingPoster}>
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
