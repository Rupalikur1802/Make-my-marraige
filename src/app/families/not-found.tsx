import Link from "next/link";
export default function FamilyNotFound() {
  return (
    <section>
      <h1>Family not found</h1>
      <p>This family was deleted or is no longer available.</p>
      <Link href="/families">Return to families</Link>
    </section>
  );
}
