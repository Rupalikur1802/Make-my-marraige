import styles from "./dashboard.module.css";
export default function LoadingDashboard() {
  return (
    <main className={styles.loading} aria-busy="true">
      <p role="status">Loading your wedding dashboard…</p>
      <div className={styles.skeleton} />
      <div className={styles.skeleton} />
    </main>
  );
}
