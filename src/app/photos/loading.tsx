import styles from "./photos.module.css";
export default function Loading() {
  return (
    <main className={styles.main} aria-busy="true">
      <h1>Wedding photos</h1>
      <p role="status">Loading your gallery…</p>
      <div className={styles.grid}>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className={styles.skeleton} />
        ))}
      </div>
    </main>
  );
}
