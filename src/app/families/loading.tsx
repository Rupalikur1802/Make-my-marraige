import styles from "./families.module.css";
export default function FamiliesLoading() {
  return (
    <div role="status" aria-live="polite">
      <p>Loading family records…</p>
      <div className={styles.skeleton} />
      <div className={styles.skeleton} />
    </div>
  );
}
