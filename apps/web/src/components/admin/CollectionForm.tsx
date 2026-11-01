"use client";

import { useActionState, useId } from "react";
import type { Collection, Title } from "@reel-and-page/shared";
import { saveCollection, type ActionState } from "@/app/admin/collections/actions";
import styles from "@/app/admin/admin.module.css";

export function CollectionForm({ collection, titles, selectedTitleIds }: { collection?: Collection; titles: Title[]; selectedTitleIds?: string[] }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(saveCollection, null);
  const formId = useId();

  return (
    <form action={formAction} className={styles.form}>
      <input type="hidden" name="id" value={collection?.id ?? ""} />

      <div className={styles.field}>
        <label htmlFor={`${formId}-name`}>Name</label>
        <input id={`${formId}-name`} type="text" name="name" defaultValue={collection?.name} required />
      </div>

      <div className={styles.field}>
        <label htmlFor={`${formId}-price_ref`}>Stripe/RevenueCat price id</label>
        <input id={`${formId}-price_ref`} type="text" name="price_ref" defaultValue={collection?.price_ref ?? undefined} placeholder="price_..." />
        <span className={styles.hint}>Leave blank until real pricing exists.</span>
      </div>

      {titles.length > 0 && (
        <div className={styles.field}>
          <label>Titles in this collection</label>
          {titles.map((title) => (
            <div key={title.id} className={styles.checkboxRow}>
              <input
                id={`${formId}-title-${title.id}`}
                type="checkbox"
                name="titles"
                value={title.id}
                defaultChecked={selectedTitleIds?.includes(title.id) ?? false}
              />
              <label htmlFor={`${formId}-title-${title.id}`}>{title.title}</label>
            </div>
          ))}
        </div>
      )}

      {state?.error && <p className={styles.error}>{state.error}</p>}

      <div className={styles.actions}>
        <button type="submit" className={styles.button} disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
