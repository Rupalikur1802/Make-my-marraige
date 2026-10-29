import Link from "next/link";
export default function CeremonyNotFound() {
  return (
    <main className="section container">
      <h1 style={{ fontSize: "2.5rem" }}>Ceremony not found.</h1>
      <p>This ceremony was deleted or is no longer available.</p>
      <Link className="text-link" href="/ceremonies">
        Back to ceremonies
      </Link>
    </main>
  );
}
