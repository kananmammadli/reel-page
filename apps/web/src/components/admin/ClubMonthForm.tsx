"use client";

import { useActionState, useId } from "react";
import type { ClubMonth, Title } from "@reel-and-page/shared";
import { saveClubMonth, type ActionState } from "@/app/admin/club/actions";
import styles from "@/app/admin/admin.module.css";

export function ClubMonthForm({ clubMonth, titles }: { clubMonth?: ClubMonth; titles: Title[] }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(saveClubMonth, null);
  const formId = useId();

  return (
    <form action={formAction} className={styles.form}>
      <input type="hidden" name="id" value={clubMonth?.id ?? ""} />

      <div className={styles.field}>
        <label htmlFor={`${formId}-month`}>Month</label>
        <input id={`${formId}-month`} type="date" name="month" defaultValue={clubMonth?.month ?? undefined} required />
        <span className={styles.hint}>Pick any day in the target month -- only the month itself is stored.</span>
      </div>

      <div className={styles.field}>
        <label htmlFor={`${formId}-title`}>Title</label>
        <select id={`${formId}-title`} name="title_id" defaultValue={clubMonth?.title_id ?? ""} required>
          <option value="" disabled>
            Choose a title…
          </option>
          {titles.map((title) => (
            <option key={title.id} value={title.id}>
              {title.title}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.field}>
        <label htmlFor={`${formId}-pitch`}>Pitch</label>
        <textarea id={`${formId}-pitch`} name="pitch" rows={3} defaultValue={clubMonth?.pitch ?? undefined} placeholder="Shown on the home club banner" />
      </div>

      <div className={styles.field}>
        <label htmlFor={`${formId}-price_ref`}>Stripe/RevenueCat subscription price id</label>
        <input id={`${formId}-price_ref`} type="text" name="price_ref" defaultValue={clubMonth?.price_ref ?? undefined} placeholder="price_..." />
        <span className={styles.hint}>Leave blank until real pricing exists -- &ldquo;Join the club&rdquo; stays unusable until this is set.</span>
      </div>

      {state?.error && <p className={styles.error}>{state.error}</p>}

      <div className={styles.actions}>
        <button type="submit" className={styles.button} disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
