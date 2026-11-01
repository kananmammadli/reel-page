import Link from "next/link";
import styles from "./admin.module.css";

export default function AdminHome() {
  return (
    <div className={styles.main}>
      <h1>Admin</h1>
      <div className={styles.list}>
        <Link className={styles.card} href="/admin/titles">
          Titles &amp; episodes
          <div className={styles.rowMeta}>Create titles, upload episode audio, generate previews, attach transcripts.</div>
        </Link>
        <Link className={styles.card} href="/admin/collections">
          Collections
          <div className={styles.rowMeta}>Group titles into a purchasable collection.</div>
        </Link>
        <Link className={styles.card} href="/admin/sales">
          Sales
          <div className={styles.rowMeta}>Revenue by title, collection, and club, from confirmed payments.</div>
        </Link>
      </div>
    </div>
  );
}
