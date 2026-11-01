"use client";

import styles from "@/app/admin/admin.module.css";

export function DeleteButton({ action, confirmText, label }: { action: () => Promise<void>; confirmText: string; label: string }) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!confirm(confirmText)) event.preventDefault();
      }}
    >
      <button type="submit" className={styles.dangerButton}>
        {label}
      </button>
    </form>
  );
}
