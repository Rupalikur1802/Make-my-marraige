import styles from "./expenses.module.css";
export default function LoadingExpenses() {
  return (
    <main className={styles.main} aria-busy="true">
      <p role="status">Loading recorded spending…</p>
      <div className={styles.skeleton} />
    </main>
  );
}
