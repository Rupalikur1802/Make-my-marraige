import styles from "./tasks.module.css";
export default function LoadingTasks() {
  return (
    <main className={styles.main} aria-busy="true">
      <p role="status">Loading wedding tasks…</p>
      <div className={styles.skeleton} />
    </main>
  );
}
